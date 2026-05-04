import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateChatResponse } from '../lib/gemini';
import { Mic, Send, Volume2, MessageSquare, ExternalLink, Settings, Phone } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';

// Detect if running in a browser that supports speech
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function ChatInterface() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [lastLang, setLastLang] = useState('ml');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sessionId = useRef(uuidv4());

  useEffect(() => {
    async function loadConfig() {
      try {
        const generalDoc = await getDoc(doc(db, 'settings', 'general'));
        const brandingDoc = await getDoc(doc(db, 'settings', 'branding'));
        
        const genData = generalDoc.exists() ? generalDoc.data() : {
          welcomeMessage: "നമസ്കാരം! ഞാൻ RUDSETI Sahayi ആണ്. നിങ്ങളുടെ കരിയർ സ്വപ്നങ്ങൾ യാഥാർഥ്യമാക്കാൻ ഞാൻ ഇവിടെ ഉണ്ട്. എന്ത് സഹായം വേണം?",
          whatsappEnabled: false,
          whatsappNumber: ""
        };
        
        setSettings(genData);
        setBranding(brandingDoc.exists() ? brandingDoc.data() : { logoURL: "", showCredits: true });
        
        setMessages([{
          id: 'welcome',
          role: 'bot',
          text: genData.welcomeMessage || "നമസ്കാരം! ഞാൻ RUDSETI Sahayi ആണ്.",
          timestamp: new Date()
        }]);
      } catch (e) {
        console.warn("Using offline fallback for settings:", e);
        const fallbackGen = {
          welcomeMessage: "നമസ്കാരം! ഞാൻ RUDSETI Sahayi ആണ്. (Offline Mode)",
          whatsappEnabled: false,
          whatsappNumber: ""
        };
        setSettings(fallbackGen);
        setBranding({ logoURL: "", showCredits: true });
        setMessages([{
          id: 'welcome-offline',
          role: 'bot',
          text: fallbackGen.welcomeMessage,
          timestamp: new Date()
        }]);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const detectLanguage = (text: string) => {
    const malayalamPattern = /[\u0D00-\u0D7F]/;
    if (malayalamPattern.test(text)) return 'ml';
    const manglishWords = ['njan', 'ningal', 'ente', 'adipoli', 'enthanu', 'evide', 'evideyanu', 'paranju', 'course', 'undoo', 'undo', 'aano', 'alle'];
    const lower = text.toLowerCase();
    if (manglishWords.some(w => lower.includes(w))) return 'ml';
    return 'en';
  };

  const speak = (text: string, lang: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ml' ? 'ml-IN' : 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (customInput?: string) => {
    const text = customInput || input;
    if (!text.trim() || loading) return;

    const userEntry = { id: Date.now().toString(), role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userEntry]);
    setInput('');
    setLoading(true);

    try {
      const currentLang = detectLanguage(text);
      setLastLang(currentLang);

      // Fetch RAG Context
      const qCourses = query(collection(db, 'courses'), where('status', 'in', ['Ongoing', 'Upcoming']));
      const qAnn = query(collection(db, 'announcements'), where('visible', '==', true));
      
      let coursesSnap, announcementsSnap;
      try {
        [coursesSnap, announcementsSnap] = await Promise.all([
          getDocs(qCourses),
          getDocs(qAnn)
        ]);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'courses/announcements');
        return;
      }

      const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const announcements = announcementsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const systemInstruction = `
        You are RUDSETI Sahayi, the official AI assistant for RUDSETI Institute Kannur (also called RUDSET Institute Kannur). 
        Created by SANEESH MP, Domain Skill Trainer at RUDSETI Institute Kannur.

        [LIVE FIRESTORE DATA]
        COURSES: ${JSON.stringify(courses)}
        ANNOUNCEMENTS: ${JSON.stringify(announcements)}
        CONTACT: ${JSON.stringify(settings?.contact || {})}
        [END LIVE DATA]

        IDENTITY RULES:
        - Age limit: 18 to 49 years.
        - All courses are FREE.
        - Managed by Canara Bank and SDME Trust.
        - If query is about applying, use: https://apply.rudsetitraining.org/application/

        LANGUAGE RULES:
        - Detect language: ${currentLang}.
        - If 'ml' or Manglish, reply ONLY in Malayalam script.
        - If 'en', reply in English.
        - Never mix languages.

        COURSE LISTING:
        Always list these 7 primary courses when asked about what is available:
        1. Computer Hardware & Networking, 2. Cell Phone Repairs & Service, 3. Two-Wheeler Mechanic, 4. Photography and Videography, 5. Dress Designing for Women, 6. Beauty Parlor Management, 7. Installation & Servicing of CCTV, Security Alarms and Smoke Detectors.
      `;

      const botReply = await generateChatResponse(text, systemInstruction);
      
      const botEntry = { id: (Date.now() + 1).toString(), role: 'bot', text: botReply, timestamp: new Date() };
      setMessages(prev => [...prev, botEntry]);
      
      // Save log (defensive)
      try {
        await addDoc(collection(db, 'chat_logs'), {
          timestamp: serverTimestamp(),
          sessionId: sessionId.current,
          userMessage: text,
          botReply: botReply,
          detectedLanguage: currentLang
        });
      } catch (e) {
        console.warn("Could not save chat log (offline):", e);
      }

      // Auto-speak
      speak(botReply.replace(/[#*]/g, ''), currentLang);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: 'err', role: 'bot', text: "Sorry, I'm having trouble connecting right now.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (!SpeechRecognition) return alert("Your browser does not support speech recognition.");
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = lastLang === 'ml' ? 'ml-IN' : 'en-IN';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };
    recognitionRef.current.start();
  };

  return (
    <div className="flex flex-col h-screen max-w-[1280px] mx-auto bg-[var(--bg-editorial)] shadow-2xl relative overflow-hidden font-sans border-x border-[#1A1A1A]/10">
      {/* Navigation */}
      <nav className="h-20 border-b border-[#1A1A1A]/10 px-6 md:px-12 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-4">
          {branding?.logoURL ? (
            <img src={branding.logoURL} alt="Logo" className="w-10 h-10 object-contain bg-white border border-[#2E7D32]/20 p-1" />
          ) : (
            <div className="w-10 h-10 bg-[#2E7D32] flex items-center justify-center text-white font-bold text-xl">R</div>
          )}
          <div>
            <h1 className="text-sm md:text-lg font-bold tracking-tight uppercase leading-none">RUDSETI Institute Kannur</h1>
            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-[#2E7D32] font-semibold">Your Career Guidance Assistant</p>
          </div>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] font-bold uppercase tracking-widest text-[#1A1A1A]/60">
          <a href={settings?.websiteURL} target="_blank" className="hover:text-[#2E7D32] transition-colors">Courses</a>
          <a href="#" className="hover:text-[#2E7D32] transition-colors">Facilities</a>
          <a href={settings?.applyURL} target="_blank" className="hover:text-[#2E7D32] transition-colors">Apply Now</a>
          <button onClick={() => window.location.href = '/login'} className="p-1 hover:text-[#2E7D32]">
            <Settings size={16} />
          </button>
        </div>
        <div className="md:hidden">
          <button onClick={() => window.location.href = '/login'} className="p-2 text-[#1A1A1A]/60">
            <Settings size={20} />
          </button>
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        {/* Editorial Sidebar */}
        <section className="hidden lg:flex w-[400px] p-12 border-r border-[#1A1A1A]/10 flex-col justify-between bg-[var(--bg-sidebar)]">
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="px-3 py-1 bg-[#2E7D32] text-white text-[10px] font-bold uppercase rounded-full">Skill India</span>
              <h2 className="text-6xl font-serif leading-[0.9] text-[#1A1A1A]">
                Shape Your <br /><span className="italic text-[#2E7D32]">Future</span>.
              </h2>
              <p className="text-sm text-gray-600 max-w-[280px] leading-relaxed">
                Official AI assistant for NCVET certified vocational training. Empowering youth through free professional education and residential facilities.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="border-t border-[#1A1A1A]/20 pt-4">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Eligibility</p>
                <p className="text-xl font-serif">18—49 Years</p>
              </div>
              <div className="border-t border-[#1A1A1A]/20 pt-4">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Fees</p>
                <p className="text-xl font-serif">₹0 (Free)</p>
              </div>
              <div className="border-t border-[#1A1A1A]/20 pt-4">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Duration</p>
                <p className="text-xl font-serif">45 Days</p>
              </div>
              <div className="border-t border-[#1A1A1A]/20 pt-4">
                <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Certification</p>
                <p className="text-xl font-serif">NCVET</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-[#2E7D32]/20 shadow-sm">
            <p className="text-[11px] font-bold uppercase mb-3 tracking-tighter text-[#2E7D32]">Primary Courses</p>
            <ul className="text-[13px] space-y-2 text-gray-700 font-medium">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#2E7D32] rounded-full"></div> Computer Hardware & Networking</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#2E7D32] rounded-full"></div> Beauty Parlor Management</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#2E7D32] rounded-full"></div> Two-Wheeler Mechanic Repair</li>
            </ul>
          </div>
        </section>

        {/* Chat Area */}
        <section className="flex-1 flex flex-col bg-white relative">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#2E7D32 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8 scroll-smooth z-10">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'bot' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] border border-[#2E7D32]/20 text-[10px] font-bold">AI</div>
                  )}
                  
                  <div 
                    className={cn(
                      "p-4 rounded-2xl shadow-sm relative markdown-body",
                      m.role === 'user' 
                        ? 'bg-[var(--user-bubble)] text-white rounded-tr-none max-w-[80%] shadow-lg' 
                        : 'bg-[var(--bot-bubble)] text-[#1A1A1A] rounded-tl-none max-w-[85%] border border-[#1A1A1A]/5'
                    )}
                  >
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                    
                    {m.role === 'bot' && (
                      <div className="flex gap-2 items-center mt-3 pt-3 border-t border-[#1A1A1A]/5">
                        <button 
                          onClick={() => speak(m.text.replace(/[#*]/g, ''), detectLanguage(m.text))}
                          className="w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-[#2E7D32] transition-colors"
                        >
                          <Volume2 size={12} />
                        </button>
                        <span className="text-[9px] uppercase font-bold text-gray-400 tracking-widest">Audio Available</span>
                      </div>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-tighter">YOU</div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-full bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32] border border-[#2E7D32]/20 text-[10px] font-bold animate-pulse">AI</div>
                <div className="bg-[var(--bot-bubble)] p-4 rounded-2xl rounded-tl-none border border-[#1A1A1A]/5 flex items-center gap-1 text-[var(--primary)]">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 md:p-12 pt-0 z-10">
            <div className="relative flex items-center group">
              <input
                type="text"
                placeholder={isListening ? "Listening..." : "Type your query in Malayalam or English..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                className="w-full bg-[#F1F5F1] border-none rounded-full py-4 pl-8 pr-32 focus:ring-2 focus:ring-[#2E7D32] text-sm transition-all shadow-inner placeholder:text-gray-400"
              />
              <div className="absolute right-4 flex gap-2">
                <button
                  onClick={startListening}
                  className={cn(
                    "p-2 transition-all",
                    isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-[#2E7D32]'
                  )}
                >
                  <Mic size={24} />
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="bg-[#2E7D32] text-white px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  SEND
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Editorial Footer */}
      <footer className="h-12 border-t border-[#1A1A1A]/10 px-6 md:px-12 flex items-center justify-between text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold bg-white">
        <div className="flex gap-6">
          <span className="text-gray-400">Powered by RUDSETI Sahayi</span>
          <span className="text-[#2E7D32] hidden sm:inline">NCVET Certified Training Centre</span>
        </div>
        {branding?.showCredits && (
          <div className="opacity-40 tracking-[0.3em] font-medium">
            Created by <span className="text-[#1A1A1A]">SANEESH MP</span>
          </div>
        )}
      </footer>

      {/* Floating WhatsApp */}
      {settings?.whatsappEnabled && settings?.whatsappNumber && (
        <a
          href={`https://wa.me/${settings.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-32 right-8 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all z-50 flex items-center justify-center border-4 border-white"
        >
          <Phone size={24} fill="currentColor" />
        </a>
      )}
    </div>
  );
}
