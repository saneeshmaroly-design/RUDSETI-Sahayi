import React, { useState, useEffect } from 'react';
import { db, storage, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, orderBy, 
  where, Timestamp, onSnapshot, limit, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, Bell, Settings, History, 
  Plus, Edit2, Trash2, Save, LogOut, Image, Palette, 
  Check, X, Download, Share2, MessageCircle, RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('branding');
  const [courses, setCourses] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [branding, setBranding] = useState<any>({});
  const [theme, setTheme] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<null | 'course' | 'announcement'>(null);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Initial fetch and check for seed data
    const initApp = async () => {
      setLoading(true);
      try {
        // Load settings
        const getSet = async (id: string, setter: any) => {
          const docRef = doc(db, 'settings', id);
          try {
            const d = await getDoc(docRef);
            if (d.exists()) {
              setter(d.data());
              return d.data();
            }
          } catch (e) {
            console.warn(`Setting ${id} load failed (possibly offline):`, e);
          }
          return null;
        };

        const [gen, brand, thm] = await Promise.all([
          getSet('general', setSettings),
          getSet('branding', setBranding),
          getSet('theme', setTheme)
        ]);

        // SEED DATA LOGIC
        if (!gen) {
          const defaultGeneral = {
            welcomeMessage: "നമസ്കാരം! ഞാൻ RUDSETI Sahayi ആണ്. നിങ്ങളുടെ കരിയർ സ്വപ്നങ്ങൾ യാഥാർഥ്യമാക്കാൻ ഞാൻ ഇവിടെ ഉണ്ട്. എന്ത് സഹായം വേണം?",
            websiteURL: "https://rudsetitraining.org/web/kannur/",
            applyURL: "https://apply.rudsetitraining.org/application/",
            contact: { name: "RUDSETI Institute Kannur", phone: "", designation: "Enquiry" },
            whatsappEnabled: false,
            whatsappNumber: ""
          };
          await setDoc(doc(db, 'settings', 'general'), defaultGeneral);
          setSettings(defaultGeneral);
        }

        if (!brand) {
          const defaultBranding = { logoURL: "", showCredits: true };
          await setDoc(doc(db, 'settings', 'branding'), defaultBranding);
          setBranding(defaultBranding);
        }

        if (!thm) {
          const defaultTheme = { primaryColor: "#2E7D32", secondaryColor: "#1a1a1a" };
          await setDoc(doc(db, 'settings', 'theme'), defaultTheme);
          setTheme(defaultTheme);
        }

        // Seed courses if empty
        const coursesSnap = await getDocs(query(collection(db, 'courses'), limit(1)));
        if (coursesSnap.empty) {
          const defaultCourses = [
            "Computer Hardware & Networking",
            "Cell Phone Repairs & Service",
            "Two-Wheeler Mechanic",
            "Photography and Videography",
            "Dress Designing for Women",
            "Beauty Parlor Management",
            "Installation & Servicing of CCTV, Security Alarms and Smoke Detectors"
          ];
          for (const name of defaultCourses) {
            await addDoc(collection(db, 'courses'), {
              name,
              category: name.includes('Beauty') ? 'Beauty' : 'Technical',
              duration: '45 Days',
              status: 'Ongoing',
              fee: 'Free',
              startDate: new Date().toISOString().split('T')[0],
              registrationLink: 'https://apply.rudsetitraining.org/application/'
            });
          }
        }

      } catch (e) {
        console.error("Initialization failed", e);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    // Realtime listeners
    const unsubCourses = onSnapshot(query(collection(db, 'courses'), orderBy('name')), (snap) => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => handleFirestoreError(e, OperationType.GET, 'courses'));
    
    const unsubAnn = onSnapshot(query(collection(db, 'announcements'), orderBy('date', 'desc')), (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => handleFirestoreError(e, OperationType.GET, 'announcements'));
    
    const unsubLogs = onSnapshot(query(collection(db, 'chat_logs'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => handleFirestoreError(e, OperationType.GET, 'chat_logs'));

    return () => {
      unsubCourses();
      unsubAnn();
      unsubLogs();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.removeItem('adminBypass');
    navigate('/login');
  };

  const handleSaveSettings = async (collectionId: string, data: any) => {
    setLoading(true);
    const path = `settings/${collectionId}`;
    try {
      await setDoc(doc(db, 'settings', collectionId), data, { merge: true });
      alert('Settings saved successfully!');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setLoading(true);
    try {
      const sRef = ref(storage, `logos/branding_logo_${Date.now()}`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await setDoc(doc(db, 'settings', 'branding'), { logoURL: url }, { merge: true });
      setBranding((prev: any) => ({ ...prev, logoURL: url }));
    } catch (e) {
      console.error(e);
      alert('Logo upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    
    // Normalize data
    if (modalType === 'announcement') {
      data.visible = (e.target as any).visible.checked;
    }

    const col = modalType === 'course' ? 'courses' : 'announcements';
    try {
      if (currentItem?.id) {
        await updateDoc(doc(db, col, currentItem.id), data);
      } else {
        await addDoc(collection(db, col), data);
      }
      setModalType(null);
      setCurrentItem(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, col);
    }
  };

  const deleteItem = async (col: string, id: string) => {
    if (confirm('Are you sure you want to delete this?')) {
      try {
        await deleteDoc(doc(db, col, id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, col);
      }
    }
  };

  const exportLogs = () => {
    const headers = ['Timestamp', 'User', 'Bot', 'Lang', 'Session'];
    const csv = [
      headers.join(','),
      ...logs.map(l => [
        l.timestamp?.toDate().toISOString() || '',
        `"${l.userMessage}"`,
        `"${l.botReply.replace(/"/g, '""')}"`,
        l.detectedLanguage,
        l.sessionId
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_logs_${new Date().toISOString()}.csv`;
    a.click();
  };

  const deleteAllLogs = async () => {
    if (confirm('REALLY delete ALL logs? This cannot be undone.')) {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'chat_logs'));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, 'chat_logs');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="bg-green-600 p-2 rounded-lg">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">Admin Dashboard</h1>
            <p className="text-[10px] text-gray-400">RUDSETI Sahayi</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {[
            { id: 'branding', label: 'Branding', icon: Image },
            { id: 'courses', label: 'Courses', icon: BookOpen },
            { id: 'announcements', label: 'Updates', icon: Bell },
            { id: 'settings', label: 'General', icon: Settings },
            { id: 'logs', label: 'Chat Logs', icon: History },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                activeTab === t.id ? "bg-green-600 text-white shadow-lg shadow-green-600/20" : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <RefreshCw className="animate-spin text-green-600" />
          </div>
        )}

        {/* Tab 1: Branding */}
        {activeTab === 'branding' && (
          <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-white p-6 rounded-2xl shadow-sm space-y-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Image className="text-green-600" /> Branding & Media
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-3">Institute Logo</label>
                  <div className="flex flex-col items-center gap-4 border-2 border-dashed border-gray-100 p-6 rounded-2xl bg-gray-50/50">
                    {branding?.logoURL ? (
                      <div className="relative group">
                        <img src={branding.logoURL} alt="Logo" className="w-32 h-32 object-contain bg-white rounded-lg p-2 shadow-sm" />
                        <button 
                          onClick={() => handleSaveSettings('branding', { logoURL: '' })}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center text-gray-300">No Logo</div>
                    )}
                    <input 
                      type="file" 
                      id="logoUpload" 
                      className="hidden" 
                      onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} 
                    />
                    <label htmlFor="logoUpload" className="cursor-pointer bg-white border border-gray-200 px-6 py-2 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
                      Upload New
                    </label>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-3">Theme Colors</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] uppercase text-gray-400 block mb-1">Primary</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={theme?.primaryColor || '#2E7D32'} 
                            onChange={(e) => setTheme({...theme, primaryColor: e.target.value})}
                            className="w-10 h-10 border-0 bg-transparent cursor-pointer"
                          />
                          <input type="text" className="text-xs border-b border-gray-200 w-16 focus:outline-none" value={theme?.primaryColor || ''} readOnly />
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-gray-400 block mb-1">Secondary</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={theme?.secondaryColor || '#1a1a1a'} 
                            onChange={(e) => setTheme({...theme, secondaryColor: e.target.value})}
                            className="w-10 h-10 border-0 bg-transparent cursor-pointer"
                          />
                          <input type="text" className="text-xs border-b border-gray-200 w-16 focus:outline-none" value={theme?.secondaryColor || ''} readOnly />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <h4 className="text-sm font-semibold">Show Credits</h4>
                      <p className="text-[10px] text-gray-500">Visible in chatbot footer</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={branding?.showCredits} 
                        onChange={(e) => setBranding({...branding, showCredits: e.target.checked})}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                  <button 
                    onClick={() => {
                       handleSaveSettings('branding', branding);
                       handleSaveSettings('theme', theme);
                    }}
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                  >
                    <Save size={18} /> Save Branding & Theme
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: Courses */}
        {activeTab === 'courses' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="text-green-600" /> Courses Management
              </h2>
              <button 
                onClick={() => { setCurrentItem(null); setModalType('course'); }}
                className="bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-green-600/20 hover:scale-105 transition-all"
              >
                <Plus size={18} /> Add Course
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs uppercase text-gray-400 font-semibold tracking-wider">
                    <th className="px-6 py-4">Course Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Fee</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {courses.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{c.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{c.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{c.duration}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                          c.status === 'Ongoing' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{c.fee}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => { setCurrentItem(c); setModalType('course'); }}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => deleteItem('courses', c.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {courses.length === 0 && <div className="p-12 text-center text-gray-400 italic">No courses added yet.</div>}
            </div>
          </div>
        )}

        {/* Tab 3: Announcements */}
        {activeTab === 'announcements' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Bell className="text-green-600" /> News & Announcements
              </h2>
              <button 
                onClick={() => { setCurrentItem(null); setModalType('announcement'); }}
                className="bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-green-600/20 hover:scale-105 transition-all"
              >
                <Plus size={18} /> Add News
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {announcements.map(a => (
                <div key={a.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group relative">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{a.date}</span>
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      a.visible ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-gray-300"
                    )}></span>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2">{a.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-3 mb-4">{a.body}</p>
                  <div className="flex justify-end gap-2 pt-4 border-t border-gray-50">
                    <button 
                      onClick={() => { setCurrentItem(a); setModalType('announcement'); }}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteItem('announcements', a.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && <div className="col-span-full p-12 text-center text-gray-400 italic">No announcements.</div>}
            </div>
          </div>
        )}

        {/* Tab 4: Settings */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="bg-white p-6 rounded-2xl shadow-sm space-y-8">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b border-gray-50 pb-4">
                <Settings className="text-green-600" /> General Settings
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Welcome Message</label>
                    <textarea 
                      value={settings?.welcomeMessage || ''}
                      onChange={(e) => setSettings({...settings, welcomeMessage: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-green-500 outline-none h-32"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Institute Website URL</label>
                    <input 
                      type="url"
                      value={settings?.websiteURL || ''}
                      onChange={(e) => setSettings({...settings, websiteURL: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg p-3 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Contact Name</label>
                      <input 
                        type="text"
                        value={settings?.contact?.name || ''}
                        onChange={(e) => setSettings({...settings, contact: {...settings.contact, name: e.target.value}})}
                        className="w-full border border-gray-200 rounded-lg p-3 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Phone No.</label>
                      <input 
                        type="text"
                        value={settings?.contact?.phone || ''}
                        onChange={(e) => setSettings({...settings, contact: {...settings.contact, phone: e.target.value}})}
                        className="w-full border border-gray-200 rounded-lg p-3 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                         <MessageCircle className="text-[#25D366]" size={20} />
                         <span className="text-sm font-bold">WhatsApp Button</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings?.whatsappEnabled} 
                          onChange={(e) => setSettings({...settings, whatsappEnabled: e.target.checked})}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                    <input 
                      type="text"
                      placeholder="WhatsApp Number (e.g. 919876543210)"
                      value={settings?.whatsappNumber || ''}
                      onChange={(e) => setSettings({...settings, whatsappNumber: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg p-3 text-xs"
                      disabled={!settings?.whatsappEnabled}
                    />
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleSaveSettings('general', settings)}
                className="w-full md:w-auto bg-slate-900 text-white px-10 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} /> Update General Settings
              </button>
            </section>
          </div>
        )}

        {/* Tab 5: Logs */}
        {activeTab === 'logs' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <History className="text-green-600" /> Interaction History
              </h2>
              <div className="flex gap-3">
                <button 
                  onClick={exportLogs}
                  className="bg-white border border-gray-200 px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                >
                  <Download size={18} /> Export CSV
                </button>
                <button 
                  onClick={deleteAllLogs}
                  className="bg-red-50 text-red-600 px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-red-100 transition-all"
                >
                  <Trash2 size={18} /> Purge Logs
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-[10px] uppercase text-gray-400 font-bold tracking-widest leading-loose">
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">User Input</th>
                    <th className="px-6 py-4">Bot AI Reply</th>
                    <th className="px-6 py-4 text-center">Lang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors text-xs">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                        {l.timestamp?.toDate().toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700 max-w-xs truncate">{l.userMessage}</td>
                      <td className="px-6 py-4 text-gray-500 max-w-md truncate">{l.botReply}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-gray-100 px-2 py-1 rounded text-[9px] uppercase font-bold">{l.detectedLanguage}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && <div className="p-12 text-center text-gray-400 italic">No chat history available.</div>}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-lg">{currentItem ? 'Edit' : 'Add New'} {modalType === 'course' ? 'Course' : 'News'}</h3>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-gray-600"><X /></button>
            </div>
            <form onSubmit={handleItemSubmit} className="p-6 space-y-4">
              {modalType === 'course' ? (
                <>
                  <input type="text" name="name" defaultValue={currentItem?.name} placeholder="Course Name" required className="w-full border p-3 rounded-xl" />
                  <div className="grid grid-cols-2 gap-4">
                    <select name="category" defaultValue={currentItem?.category || 'Skill'} className="w-full border p-3 rounded-xl bg-white focus:outline-none">
                      <option value="Skill">Skill Development</option>
                      <option value="Technical">Technical</option>
                      <option value="Beauty">Beauty</option>
                      <option value="Others">Others</option>
                    </select>
                    <select name="status" defaultValue={currentItem?.status || 'Ongoing'} className="w-full border p-3 rounded-xl bg-white focus:outline-none">
                      <option value="Ongoing">Ongoing</option>
                      <option value="Upcoming">Upcoming</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Duration</label>
                      <input type="text" name="duration" defaultValue={currentItem?.duration} placeholder="e.g. 45 Days" className="w-full border p-3 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] uppercase font-bold text-gray-400">Fees</label>
                       <input type="text" name="fee" defaultValue={currentItem?.fee || 'Free'} placeholder="Course Fee" className="w-full border p-3 rounded-xl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Course Start</label>
                      <input type="date" name="startDate" defaultValue={currentItem?.startDate} className="w-full border p-3 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-gray-400">Course End</label>
                      <input type="date" name="endDate" defaultValue={currentItem?.endDate} className="w-full border p-3 rounded-xl" />
                    </div>
                  </div>
                  <input type="url" name="registrationLink" defaultValue={currentItem?.registrationLink || 'https://apply.rudsetitraining.org/application/'} placeholder="Registration Link" className="w-full border p-3 rounded-xl" />
                </>
              ) : (
                <>
                  <input type="text" name="title" defaultValue={currentItem?.title} placeholder="Announcement Title" required className="w-full border p-3 rounded-xl" />
                  <textarea name="body" defaultValue={currentItem?.body} placeholder="Details..." required className="w-full border p-3 rounded-xl h-32"></textarea>
                  <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                    <input type="date" name="date" defaultValue={currentItem?.date || new Date().toISOString().split('T')[0]} className="border-0 bg-transparent text-sm focus:outline-none underline" />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-bold text-gray-500 uppercase">Visible</span>
                      <input type="checkbox" name="visible" defaultChecked={currentItem?.visible !== false} className="w-5 h-5 rounded accent-green-600" />
                    </label>
                  </div>
                </>
              )}
              <div className="pt-4 flex gap-3">
                 <button type="button" onClick={() => setModalType(null)} className="flex-1 border border-gray-200 py-3 rounded-xl hover:bg-gray-50 text-sm font-bold">Cancel</button>
                 <button type="submit" className="flex-1 bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 text-sm font-bold shadow-lg shadow-green-600/20">Save {modalType === 'course' ? 'Course' : 'News'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
