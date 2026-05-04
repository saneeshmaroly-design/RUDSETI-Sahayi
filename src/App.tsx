/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ChatInterface from './components/ChatInterface';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function App() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState({ primary: '#2E7D32', secondary: '#1a1a1a' });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    async function loadTheme() {
      const path = 'settings/theme';
      try {
        const themeDoc = await getDoc(doc(db, 'settings', 'theme'));
        if (themeDoc.exists()) {
          const data = themeDoc.data();
          setTheme({
            primary: data.primaryColor || '#2E7D32',
            secondary: data.secondaryColor || '#1a1a1a'
          });
        }
      } catch (e) {
        console.warn("Theme load skipped or failed (likely offline):", e);
      }
    }
    loadTheme();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', theme.primary);
    document.documentElement.style.setProperty('--secondary', theme.secondary);
  }, [theme]);

  if (loading) return <div className="flex items-center justify-center h-screen font-sans">Loading RUDSETI Sahayi...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatInterface />} />
        <Route path="/login" element={<Login />} />
        <Route 
          path="/admin/*" 
          element={isAdmin ? <AdminDashboard /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </Router>
  );
}
