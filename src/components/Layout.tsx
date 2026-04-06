import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Users, User, Inbox } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      if (!auth.currentUser) {
        navigate('/');
        return;
      }
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists() || !docSnap.data().onboardingCompleted) {
          navigate('/onboarding');
        }
      } catch (err) {
        console.error("Error checking profile:", err);
      } finally {
        setChecking(false);
      }
    };
    checkProfile();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { name: '匹配', path: '/matches', icon: Users },
    { name: '信箱', path: '/mailbox', icon: Inbox },
    { name: '我的', path: '/profile', icon: User },
  ];

  if (checking) return null;

  return (
    <div 
      className="min-h-screen flex flex-col font-sans text-black bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: 'url("/match-bg.webp")', backgroundColor: 'transparent' }}
    >
      {/* Desktop Header */}
      <header className="hidden sm:block z-50 py-6 bg-transparent">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link to="/matches" className="text-2xl font-extrabold tracking-tight hover:opacity-70 transition-opacity">
              lzu date.
            </Link>
            <div className="flex items-center space-x-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-sm font-bold transition-colors",
                      isActive 
                        ? "bg-black text-white" 
                        : "text-gray-500 hover:text-black hover:bg-gray-100"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <div className="w-px h-4 bg-gray-300 mx-3"></div>
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 rounded-full text-sm font-bold text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-black" : "text-gray-400 hover:text-black"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-bold">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
