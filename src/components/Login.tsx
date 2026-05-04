import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Login() {
  const [email, setEmail] = useState('rudseti@kannur.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || 
          err.code === 'auth/user-not-found' ||
          err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password.');
      } else {
        setError('Login failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FBF9] p-6 font-sans">
      <div className="max-w-md w-full bg-white border border-[#1A1A1A]/10 shadow-[20px_20px_0px_rgba(46,125,50,0.05)] p-10 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#2E7D32]/5 -mr-16 -mt-16 rounded-full" />
        
        <div className="flex flex-col items-center mb-10 relative">
          <div className="w-12 h-12 bg-[#2E7D32] flex items-center justify-center text-white font-bold text-2xl mb-4">R</div>
          <h2 className="text-4xl font-serif text-[#1A1A1A] leading-none mb-2">Admin <span className="italic">Login</span></h2>
          <div className="h-0.5 w-12 bg-[#2E7D32] mt-2"></div>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 relative">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Email Address</label>
            <div className="relative group">
              <User className="absolute left-0 top-3 text-gray-300 w-4 h-4 group-focus-within:text-[#2E7D32] transition-colors" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-gray-200 pl-6 py-2 text-sm focus:outline-none focus:border-[#2E7D32] transition-colors"
                placeholder="rudseti@kannur.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Password</label>
            <div className="relative group">
              <Lock className="absolute left-0 top-3 text-gray-300 w-4 h-4 group-focus-within:text-[#2E7D32] transition-colors" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-gray-200 pl-6 py-2 text-sm focus:outline-none focus:border-[#2E7D32] transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-4 rounded-lg text-xs leading-relaxed border-l-4 border-red-500 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#1A1A1A] text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#2E7D32] transition-all flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Sign In'}
            </button>
          </div>
        </form>
        
        <div className="mt-10 text-center">
          <button 
            onClick={() => navigate('/')}
            className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#2E7D32] transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeft size={12} /> Return to Chatbot
          </button>
        </div>
      </div>
    </div>
  );
}
