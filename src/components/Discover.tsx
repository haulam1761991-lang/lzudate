import React, { useState, useEffect } from 'react';
import { db, auth } from '../cloudbase';
import { Heart, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateMatchScore } from '../utils/matching';

interface UserProfile {
  uid: string;
  name: string;
  gender: string;
  bio: string;
  avatarUrl: string;
  questionnaire?: any;
  matchScore?: number;
}

export default function Discover() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchNotification, setMatchNotification] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const loginState = await auth.getLoginState();
      if (!loginState) return;
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;

      try {
        // Fetch current user's profile to get their questionnaire
        const currentUserDoc = await db.collection('users').doc(currentUid).get();
        const currentUserData = currentUserDoc.data && currentUserDoc.data.length > 0 ? currentUserDoc.data[0] : null;
        const myQuestionnaire = currentUserData?.questionnaire;

        const querySnapshot = await db.collection('users').limit(100).get();
        const fetchedUsers: UserProfile[] = [];
        
        for (const docSnap of querySnapshot.data || []) {
          if (docSnap._id !== currentUid && docSnap.uid !== currentUid) {
            const targetUid = docSnap.uid || docSnap._id;
            const likeRes = await db.collection('likes').doc(`${currentUid}_${targetUid}`).get();
            const passRes = await db.collection('passes').doc(`${currentUid}_${targetUid}`).get();
            
            const hasLiked = likeRes.data && likeRes.data.length > 0;
            const hasPassed = passRes.data && passRes.data.length > 0;

            if (!hasLiked && !hasPassed) {
              const targetData = docSnap as UserProfile;
              
              // Calculate match score if both have questionnaires
              let score = 0;
              if (myQuestionnaire && targetData.questionnaire) {
                score = calculateMatchScore(myQuestionnaire, targetData.questionnaire);
              }
              
              // Only add if score > 0 (0 means hard filter failed)
              if (score > 0 || (!myQuestionnaire || !targetData.questionnaire)) {
                fetchedUsers.push({
                  ...targetData,
                  uid: targetUid,
                  matchScore: score
                });
              }
            }
          }
        }
        
        // Sort by match score descending
        setUsers(fetchedUsers.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)));
      } catch (err) {
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleAction = async (action: 'like' | 'pass') => {
    const loginState = await auth.getLoginState();
    if (!loginState || currentIndex >= users.length) return;
    
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    const targetUser = users[currentIndex];
    const targetUid = targetUser.uid;

    try {
      if (action === 'like') {
        await db.collection('likes').doc(`${currentUid}_${targetUid}`).set({
          fromUserId: currentUid,
          toUserId: targetUid,
          createdAt: new Date().toISOString()
        });

        // Check mutual like
        const reverseLikeRes = await db.collection('likes').doc(`${targetUid}_${currentUid}`).get();
        
        if (reverseLikeRes.data && reverseLikeRes.data.length > 0) {
          const matchId = [currentUid, targetUid].sort().join('_');
          await db.collection('matches').doc(matchId).set({
            users: [currentUid, targetUid],
            createdAt: new Date().toISOString()
          });
          
          setMatchNotification(`匹配成功！你和 ${targetUser.name} 互相喜欢了`);
          setTimeout(() => setMatchNotification(null), 3000);
        }
      } else {
        await db.collection('passes').doc(`${currentUid}_${targetUid}`).set({
          fromUserId: currentUid,
          toUserId: targetUid,
          createdAt: new Date().toISOString()
        });
      }
      
      setCurrentIndex(prev => prev + 1);
    } catch (err) {
      console.error("Error recording action:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[70vh]">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (currentIndex >= users.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <h3 className="text-3xl font-extrabold text-black mb-2">暂无更多推荐</h3>
        <p className="text-gray-500 font-medium">稍后再来看看吧，或者去完善一下个人主页。</p>
      </div>
    );
  }

  const currentUser = users[currentIndex];

  return (
    <div className="max-w-md mx-auto relative h-[calc(100vh-12rem)] sm:h-[700px] flex flex-col">
      <AnimatePresence>
        {matchNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 left-4 right-4 z-50 bg-black text-white p-4 rounded-2xl shadow-xl text-center font-bold"
          >
            {matchNotification}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        key={currentUser.uid}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, x: -100 }}
        className="flex-1 bg-white rounded-3xl shadow-sm border-2 border-gray-100 overflow-hidden relative flex flex-col"
      >
        <div className="h-[60%] relative bg-gray-100">
          <img 
            src={currentUser.avatarUrl} 
            alt={currentUser.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="p-6 flex-1 overflow-y-auto bg-white">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="text-3xl font-extrabold text-black inline-block mr-3">
                {currentUser.name}
              </h2>
              {currentUser.matchScore !== undefined && currentUser.matchScore > 0 && (
                <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-bold align-middle">
                  {currentUser.matchScore}% 匹配
                </span>
              )}
            </div>
            <span className="text-gray-400 font-bold uppercase tracking-wider text-sm">
              {currentUser.gender === 'male' || currentUser.gender === '男' ? '男生' : currentUser.gender === 'female' || currentUser.gender === '女' ? '女生' : '其他'}
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">关于我</h3>
              <p className="text-black text-lg font-medium leading-relaxed whitespace-pre-wrap">
                {currentUser.bio || "这个人很神秘，什么都没写~"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-center items-center space-x-6 mt-6 mb-4">
        <button 
          onClick={() => handleAction('pass')}
          className="w-16 h-16 bg-white rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-black hover:text-black transition-colors"
        >
          <X className="w-8 h-8" strokeWidth={2.5} />
        </button>
        <button 
          onClick={() => handleAction('like')}
          className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-colors shadow-lg shadow-black/20"
        >
          <Heart className="w-8 h-8 fill-current" />
        </button>
      </div>
    </div>
  );
}
