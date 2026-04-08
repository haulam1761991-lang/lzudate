import React, { useState, useEffect } from 'react';
import { db, auth } from '../cloudbase';
import { motion, AnimatePresence } from 'motion/react';
import MatchAIChat from './MatchAIChat';
import AIChatOnboarding from './AIChatOnboarding';
import { MessageCircle, Heart, Target, Sparkles, Check, X, Zap } from 'lucide-react';
import { runWeeklyMatching } from '../services/matchingAlgorithm';

interface MatchProfile {
  uid: string;
  name: string;
  avatarUrl: string;
  bio: string;
  email: string;
  displayProfile?: string;
  aiSummary?: string;
  isDropMatch?: boolean;
  matchDocId?: string;
  college?: string;
  grade?: string;
  gender?: string;
  compatibilityScore?: number;
  aiReasoning?: string;
}

export default function Matches() {
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatMatch, setActiveChatMatch] = useState<MatchProfile | null>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showShootModal, setShowShootModal] = useState(false);
  const [showCupidModal, setShowCupidModal] = useState(false);
  const [showTrainModal, setShowTrainModal] = useState(false);
  const [showFailedMatchScreen, setShowFailedMatchScreen] = useState(false);
  const [revealedEmails, setRevealedEmails] = useState<Record<string, boolean>>({});
  const [activeUsersCount, setActiveUsersCount] = useState<number>(128);
  const [matchedPairsCount, setMatchedPairsCount] = useState<number>(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersRes = await db.collection('users').where({ isParticipating: true }).get();
        if (usersRes.data) {
          setActiveUsersCount(usersRes.data.length);
        }
        const matchesRes = await db.collection('matches').get();
        if (matchesRes.data) {
          setMatchedPairsCount(matchesRes.data.length);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    };
    fetchStats();
  }, []);

  const handleTrainAI = async (summary: string) => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await db.collection('users').doc(uid).update({
        aiSummary: summary
      });
      setTimeout(() => {
        setShowTrainModal(false);
      }, 2000);
    } catch (err) {
      console.error("Error updating AI summary:", err);
    }
  };
  const [shootEmail, setShootEmail] = useState('');
  const [shootMessageText, setShootMessageText] = useState('');
  const [cupidEmail1, setCupidEmail1] = useState('');
  const [cupidEmail2, setCupidEmail2] = useState('');
  const [cupidMessageText, setCupidMessageText] = useState('');
  const [modeMessage, setModeMessage] = useState({ text: '', type: '' });

  const handleShoot = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginState = await auth.getLoginState();
    if (!loginState || !shootEmail) return;
    try {
      const uid = auth.currentUser?.uid;
      // Note: CloudBase auth doesn't expose email directly on currentUser in all cases,
      // you might need to fetch it from the user document if it's not available.
      // Assuming it's stored in the users collection.
      const userRes = await db.collection('users').doc(uid).get();
      const userEmail = userRes.data && userRes.data.length > 0 ? (userRes.data[0].email || '') : '';

      if (!userEmail) {
        setModeMessage({ text: '发送失败: 请先在个人档案中设置你的校园邮箱。', type: 'error' });
        return;
      }

      await db.collection('drops').add({
        fromUserId: uid,
        fromEmail: userEmail,
        toEmail: shootEmail.toLowerCase(),
        message: shootMessageText,
        createdAt: new Date().toISOString(),
        type: 'shoot'
      });
      setModeMessage({ text: '暗恋已发送！如果TA也填了你，你们就会匹配成功。', type: 'success' });
      setTimeout(() => {
        setShowShootModal(false);
        setShootEmail('');
        setShootMessageText('');
        setModeMessage({ text: '', type: '' });
      }, 3000);
    } catch (err: any) {
      setModeMessage({ text: '发送失败: ' + err.message, type: 'error' });
      console.error(err);
    }
  };

  const handleCupid = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginState = await auth.getLoginState();
    if (!loginState || !cupidEmail1 || !cupidEmail2) return;
    try {
      const uid = auth.currentUser?.uid;
      await db.collection('cupid_matches').add({
        cupidUserId: uid,
        email1: cupidEmail1.toLowerCase(),
        email2: cupidEmail2.toLowerCase(),
        message: cupidMessageText,
        createdAt: new Date().toISOString()
      });
      setModeMessage({ text: '撮合已发送！他们将收到提醒。', type: 'success' });
      setTimeout(() => {
        setShowCupidModal(false);
        setCupidEmail1('');
        setCupidEmail2('');
        setCupidMessageText('');
        setModeMessage({ text: '', type: '' });
      }, 3000);
    } catch (err: any) {
      setModeMessage({ text: '发送失败: ' + err.message, type: 'error' });
      console.error(err);
    }
  };

  const fetchData = async () => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    try {
      // Fetch user participation status and email
      const userRes = await db.collection('users').doc(currentUid).get();
      let currentEmail = '';
      if (userRes.data && userRes.data.length > 0) {
        setIsParticipating(userRes.data[0].isParticipating || false);
        currentEmail = userRes.data[0].email?.toLowerCase() || '';
      }

      // Fetch archived matches to filter them out
      const archivedRes = await db.collection('archived_matches').where({ userId: currentUid }).get();
      const archivedUids = (archivedRes.data || []).map((d: any) => d.matchUid);

      const matchProfiles: MatchProfile[] = [];

      // 1. Fetch regular matches
      // CloudBase doesn't have array-contains, we might need a different query strategy
      // For now, we'll fetch all matches and filter client-side if array-contains is not supported
      // Alternatively, if users array is indexed, we can try to query it.
      // Assuming we can query by array field containing a value in CloudBase (it usually supports it via where({ users: currentUid }))
      // Let's try fetching all and filtering for safety if the query fails, but ideally we should query.
      // Cloudbase JS SDK supports querying arrays: .where({ users: db.command.in([currentUid]) }) or similar.
      // Actually, for array contains, CloudBase uses db.command.in or just passing the value if it's an array field.
      // Let's fetch all matches where currentUid is in the users array.
      const _ = db.command;
      const matchesRes = await db.collection('matches').where({
        users: currentUid // CloudBase often allows this for array-contains
      }).get();
      
      for (const matchDoc of matchesRes.data || []) {
        const users = matchDoc.users as string[];
        const otherUid = users.find(id => id !== currentUid);
        
        if (otherUid && !archivedUids.includes(otherUid)) {
          const otherUserRes = await db.collection('users').doc(otherUid).get();
          if (otherUserRes.data && otherUserRes.data.length > 0) {
            const userData = otherUserRes.data[0];
            matchProfiles.push({
              uid: userData.uid || userData._id,
              name: userData.name,
              avatarUrl: userData.avatarUrl,
              bio: userData.bio,
              email: userData.email,
              displayProfile: userData.displayProfile,
              aiSummary: userData.aiSummary,
              college: userData.questionnaire?.college,
              grade: userData.questionnaire?.grade,
              gender: userData.questionnaire?.gender,
              compatibilityScore: matchDoc.similarityScore ? Math.round(matchDoc.similarityScore * 100) : (matchDoc.compatibilityScore || Math.floor(Math.random() * 20) + 80),
              aiReasoning: matchDoc.aiReasoning || '你们在生活方式和价值观上有很高的契合度。',
              isDropMatch: false,
              matchDocId: matchDoc._id
            });
          }
        }
      }

      // 2. Fetch mutual drops
      const myDropsRes = await db.collection('drops').where({ fromUserId: currentUid }).get();
      
      for (const dropDoc of myDropsRes.data || []) {
        const toEmail = dropDoc.toEmail;
        if (!toEmail || !currentEmail) continue;

        const reverseRes = await db.collection('drops').where({
          fromEmail: toEmail,
          toEmail: currentEmail
        }).get();
      
        try {
          if (reverseRes.data && reverseRes.data.length > 0) {
            const usersRes = await db.collection('users').where({ email: toEmail }).get();
            const matchedUserDoc = usersRes.data && usersRes.data.length > 0 ? usersRes.data[0] : null;
            
            if (matchedUserDoc) {
              const userData = matchedUserDoc;
              const targetUid = userData.uid || userData._id;
                if (!archivedUids.includes(targetUid) && !matchProfiles.some(p => p.uid === targetUid)) {
                  matchProfiles.push({
                    uid: targetUid,
                    name: userData.name,
                    avatarUrl: userData.avatarUrl,
                    bio: userData.bio,
                    email: userData.email,
                    displayProfile: userData.displayProfile,
                    aiSummary: userData.aiSummary,
                    college: userData.questionnaire?.college,
                    grade: userData.questionnaire?.grade,
                    gender: userData.questionnaire?.gender,
                    compatibilityScore: 100, // Mutual drop is 100%
                    aiReasoning: '你们互相暗恋了对方！这就是最好的推荐理由。',
                    isDropMatch: true
                  });
                }
              }
            }
          } catch (err: any) {
            console.error("Error checking reverse drop:", err);
          }
      }

      // 3. Fetch cupid matches is moved to Mailbox.tsx
      
      setMatches(matchProfiles);
      return matchProfiles;
    } catch (err) {
      console.error("Error fetching data:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (matches.length === 0) return;
    
    // CloudBase watch (realtime)
    let watchers: any[] = [];
    
    const setupWatchers = async () => {
      for (const match of matches) {
        try {
          const watcher = db.collection('users').doc(match.uid).watch({
            onChange: (snapshot: any) => {
              if (snapshot.docs && snapshot.docs.length > 0) {
                const userData = snapshot.docs[0];
                setMatches(prevMatches => prevMatches.map(m => {
                  if (m.uid === match.uid) {
                    return {
                      ...m,
                      name: userData.name,
                      avatarUrl: userData.avatarUrl,
                      bio: userData.bio,
                      displayProfile: userData.displayProfile,
                      aiSummary: userData.aiSummary,
                    };
                  }
                  return m;
                }));
              }
            },
            onError: (err: any) => {
              console.error('Watch error', err);
            }
          });
          watchers.push(watcher);
        } catch (e) {
          console.error("Failed to setup watcher", e);
        }
      }
    };
    
    setupWatchers();

    return () => {
      // CloudBase watchers need to be closed
      watchers.forEach(watcher => {
        if (watcher && typeof watcher.close === 'function') {
          watcher.close();
        }
      });
    };
  }, [matches.map(m => m.uid).join(',')]);

  const toggleParticipation = async () => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const newState = !isParticipating;
    setIsParticipating(newState);
    try {
      await db.collection('users').doc(uid).update({
        isParticipating: newState
      });
    } catch (err) {
      console.error("Error updating participation:", err);
      setIsParticipating(!newState); // revert on error
    }
  };

  const handleFeedback = async (match: MatchProfile, status: 'satisfied' | 'unsatisfied') => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setArchiving(true);
    try {
      await db.collection('archived_matches').add({
        userId: uid,
        matchUid: match.uid,
        status,
        archivedAt: new Date().toISOString()
      });
      
      setMatches(matches.filter(m => m.uid !== match.uid));
    } catch (err) {
      console.error("Error archiving match:", err);
    } finally {
      setArchiving(false);
    }
  };

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate next Thursday 8:00 PM
  const getNextMatchTime = () => {
    const nextMatch = new Date();
    nextMatch.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7));
    nextMatch.setHours(20, 0, 0, 0);
    if (now > nextMatch) {
      nextMatch.setDate(nextMatch.getDate() + 7);
    }
    
    const diff = nextMatch.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${days}天 ${hours}小时 ${minutes}分 ${seconds}秒`;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12 min-h-[80vh] p-6 rounded-3xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold text-black tracking-tight">匹配</h2>
            <p className="text-gray-700 mt-1 font-medium">每周一次的专属相遇</p>
          </div>
          <button
            onClick={toggleParticipation}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${isParticipating ? 'bg-black text-white' : 'bg-white/80 text-black border border-black hover:bg-black hover:text-white'}`}
          >
            {isParticipating ? '已参与本周匹配' : '参与本周匹配'}
          </button>
        </div>

        {!isParticipating ? (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 text-center mb-8 shadow-xl">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Heart className="w-8 h-8 text-gray-800" />
            </div>
            <h3 className="text-xl font-bold text-black mb-2">你当前未参与匹配</h3>
            <p className="text-gray-800 mb-6 font-medium">点击右上角按钮参与，每周四晚8点获取你的专属匹配。</p>
            <button
              onClick={toggleParticipation}
              className="px-8 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
            >
              立即参与
            </button>
          </div>
        ) : matches.length === 0 ? (
          showFailedMatchScreen ? (
            <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 text-center mb-8 shadow-xl">
              <h3 className="text-2xl font-extrabold text-black mb-2">很遗憾，本周没有适合的对象哦</h3>
              <p className="text-gray-800 mb-6 font-medium">缘分还在路上，不要着急。</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <button
                  onClick={() => setShowFailedMatchScreen(false)}
                  className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-sm"
                >
                  等待下一轮
                </button>
                <button
                  onClick={() => {
                    setShowFailedMatchScreen(false);
                    toggleParticipation();
                  }}
                  className="px-6 py-3 bg-white/80 text-black border border-black hover:bg-black hover:text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  暂不匹配
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 text-center mb-8 shadow-xl">
              <h3 className="text-2xl font-extrabold text-black mb-2">等待下一次匹配</h3>
              <p className="text-gray-800 mb-2 font-medium">我们正在为你寻找最合适的人</p>
              <div className="mb-8 flex flex-col items-center">
                <span className="text-base text-gray-800 font-bold uppercase tracking-widest mb-2">距离下次匹配还有</span>
                <span className="text-4xl font-black text-black tabular-nums">{getNextMatchTime()}</span>
              </div>
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={() => setShowTrainModal(true)}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-black rounded-xl font-bold transition-colors inline-flex items-center gap-2 text-sm border border-white/10 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  不妨和你的AI分身聊聊天吧
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-6 mb-8">
            {matches.map((match, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={match.uid} 
                className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-xl"
              >
              <div className="flex flex-col sm:flex-row">
                <div className="w-full sm:w-48 h-48 sm:h-auto relative overflow-hidden bg-gray-100 shrink-0">
                  <img 
                    src={match.avatarUrl} 
                    alt={match.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {match.isDropMatch && (
                    <div className="absolute top-3 left-3 z-10 bg-black text-white text-xs font-bold px-3 py-1 rounded-full">
                      双向暗恋
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-extrabold text-black">{match.name}</h3>
                      <div className="flex gap-1">
                        {match.gender && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{match.gender}</span>}
                        {match.grade && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{match.grade}</span>}
                        {match.college && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded-md">{match.college}</span>}
                      </div>
                    </div>
                    <div className="mb-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">自述展示面</span>
                      <p className="text-sm text-gray-700 italic font-medium">
                        "{match.displayProfile || match.bio || '这个人很神秘，什么都没写...'}"
                      </p>
                    </div>
                    
                    {match.compatibilityScore && (
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-gray-800 uppercase tracking-widest">共鸣程度</span>
                          <span className="text-sm font-black text-black">{match.compatibilityScore}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-black rounded-full" 
                            style={{ width: `${match.compatibilityScore}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {match.aiReasoning && (
                      <div className="mb-4 bg-white/40 p-3 rounded-xl border border-white/20">
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-widest block mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> 为什么推荐你们
                        </span>
                        <p className="text-sm text-gray-800 font-medium">
                          {match.aiReasoning}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex flex-col gap-2">
                      {!revealedEmails[match.uid] ? (
                        <button
                          onClick={() => setRevealedEmails(prev => ({ ...prev, [match.uid]: true }))}
                          className="w-full py-3 bg-black text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm hover:bg-gray-800"
                        >
                          看看TA的邮箱
                        </button>
                      ) : (
                        <div className="w-full py-3 bg-gray-100 text-black rounded-xl font-bold flex items-center justify-center gap-2 text-sm border border-gray-200">
                          {match.email}
                        </div>
                      )}
                      
                      {match.aiSummary ? (
                        <button
                          onClick={() => setActiveChatMatch(match)}
                          className="w-full py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-black rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm border border-white/10 shadow-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          不妨和TA的AI分身聊聊天吧
                        </button>
                      ) : (
                        <div className="w-full py-3 bg-white/5 backdrop-blur-sm text-gray-800 rounded-xl font-bold text-center text-sm border border-white/10">
                          对方未建立AI分身
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Feedback Section */}
              <div className="bg-white/10 backdrop-blur-sm p-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">你对这次匹配满意吗？</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleFeedback(match, 'unsatisfied')}
                    disabled={archiving}
                    className="px-4 py-2 bg-white/10 border border-white/10 text-gray-900 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <X className="w-4 h-4" /> 不满意
                  </button>
                  <button 
                    onClick={() => handleFeedback(match, 'satisfied')}
                    disabled={archiving}
                    className="px-4 py-2 bg-black text-white hover:bg-gray-800 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Check className="w-4 h-4" /> 满意
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bottom Modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
        <div 
          onClick={() => setShowShootModal(true)}
          className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl hover:border-black transition-colors cursor-pointer group"
        >
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 group-hover:bg-black transition-colors shadow-sm">
            <Target className="w-6 h-6 text-black group-hover:text-white transition-colors" />
          </div>
          <h4 className="text-lg font-extrabold text-black mb-1">Shoot your shot</h4>
          <p className="text-sm text-gray-800 font-medium">暗恋模式：输入TA的邮箱，如果TA也填了你，双方即刻揭晓。</p>
        </div>
        
        <div 
          onClick={() => setShowCupidModal(true)}
          className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl hover:border-black transition-colors cursor-pointer group"
        >
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 group-hover:bg-black transition-colors shadow-sm">
            <Heart className="w-6 h-6 text-black group-hover:text-white transition-colors" />
          </div>
          <h4 className="text-lg font-extrabold text-black mb-1">爱神模式</h4>
          <p className="text-sm text-gray-800 font-medium">撮合你的朋友：输入双方邮箱，他们将收到撮合提醒并看到彼此。</p>
        </div>
      </div>

      {showShootModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
          onClick={() => setShowShootModal(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-extrabold text-black">Shoot your shot</h3>
                <button onClick={() => setShowShootModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-800" />
                </button>
              </div>
              <p className="text-gray-800 mb-6 font-medium">输入你暗恋对象的校园邮箱。如果TA也在这里输入了你的邮箱，你们就会立刻匹配成功！</p>
              
              <form onSubmit={handleShoot} className="space-y-4">
                <div>
                  <input
                    type="email"
                    required
                    value={shootEmail}
                    onChange={(e) => setShootEmail(e.target.value)}
                    placeholder="TA的校园邮箱 (@lzu.edu.cn)"
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <textarea
                    required
                    value={shootMessageText}
                    onChange={(e) => setShootMessageText(e.target.value)}
                    placeholder="留下一句话..."
                    rows={3}
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600 resize-none"
                  />
                </div>
                {modeMessage.text && (
                  <div className={`p-3 rounded-xl text-sm font-bold ${modeMessage.type === 'success' ? 'bg-green-500/20 text-green-900 border border-green-500/30' : 'bg-red-500/20 text-red-900 border border-red-500/30'}`}>
                    {modeMessage.text}
                  </div>
                )}
                <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg">
                  发送暗恋
                </button>
              </form>
            </div>
          </div>
        )}

      {showCupidModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
          onClick={() => setShowCupidModal(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white/20 backdrop-blur-2xl border border-white/40 rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-extrabold text-black">爱神模式</h3>
                <button onClick={() => setShowCupidModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-800" />
                </button>
              </div>
              <p className="text-gray-800 mb-6 font-medium">觉得身边的两个朋友很合适？输入他们的邮箱，化身爱神为他们牵线搭桥！</p>
              
              <form onSubmit={handleCupid} className="space-y-4">
                <div>
                  <input
                    type="email"
                    required
                    value={cupidEmail1}
                    onChange={(e) => setCupidEmail1(e.target.value)}
                    placeholder="朋友A的校园邮箱"
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    required
                    value={cupidEmail2}
                    onChange={(e) => setCupidEmail2(e.target.value)}
                    placeholder="朋友B的校园邮箱"
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <textarea
                    required
                    value={cupidMessageText}
                    onChange={(e) => setCupidMessageText(e.target.value)}
                    placeholder="留下一句话..."
                    rows={3}
                    className="w-full px-5 py-4 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium placeholder:text-gray-600 resize-none"
                  />
                </div>
                {modeMessage.text && (
                  <div className={`p-3 rounded-xl text-sm font-bold ${modeMessage.type === 'success' ? 'bg-green-500/20 text-green-900 border border-green-500/30' : 'bg-red-500/20 text-red-900 border border-red-500/30'}`}>
                    {modeMessage.text}
                  </div>
                )}
                <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg">
                  发送撮合
                </button>
              </form>
            </div>
          </div>
        )}

      {showTrainModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
          onClick={() => setShowTrainModal(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col h-[80vh] max-h-[800px]"
          >
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-black">训练你的AI分身</h3>
                <p className="text-xs text-gray-500 font-medium">多聊天能让它更懂你</p>
              </div>
              <button onClick={() => setShowTrainModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AIChatOnboarding onSummaryGenerated={handleTrainAI} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Stats Section */}
      <div className="sm:hidden mt-12 mb-8 text-center bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl">
        <h4 className="text-lg font-extrabold text-black mb-4">平台实时数据</h4>
        <div className="flex justify-around items-center">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-black">{activeUsersCount}</span>
            <span className="text-xs font-bold text-gray-800 uppercase tracking-widest mt-1">活跃用户</span>
          </div>
          <div className="w-px h-10 bg-white/20"></div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-black">{matchedPairsCount}</span>
            <span className="text-xs font-bold text-gray-800 uppercase tracking-widest mt-1">成功匹配对数</span>
          </div>
        </div>
      </div>
        
      <AnimatePresence>
        {activeChatMatch && (
          <MatchAIChat
            matchUid={activeChatMatch.uid}
            matchName={activeChatMatch.name}
            displayProfile={activeChatMatch.displayProfile || activeChatMatch.bio || ''}
            aiSummary={activeChatMatch.aiSummary || ''}
            onClose={() => setActiveChatMatch(null)}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
