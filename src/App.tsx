import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import Landing from './components/Landing';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import Layout from './components/Layout';
import Matches from './components/Matches';
import Profile from './components/Profile';
import Mailbox from './components/Mailbox';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"></div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/matches" /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to="/matches" /> : <Auth />} />
        <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/" />} />
        
        <Route element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/matches" element={<Matches />} />
          <Route path="/mailbox" element={<Mailbox />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
