import React, { useState, useEffect } from 'react';
import { db, auth } from '../cloudbase';
import { Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Drop {
  id: string;
  toEmail: string;
  timestamp: string;
}

export default function Drops() {
  const [emailInput, setEmailInput] = useState('');
  const [myDrops, setMyDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchMyDrops();
  }, []);

  const fetchMyDrops = async () => {
    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      const res = await db.collection('drops').where({ fromUserId: uid }).get();
      const dropsData = (res.data || []).map((doc: any) => ({
        id: doc._id,
        ...doc
      })) as Drop[];
      setMyDrops(dropsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err) {
      console.error("Error fetching drops:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const loginState = await auth.getLoginState();
    if (!loginState) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Fetch current user's email
    let currentUserEmail = '';
    try {
      const userRes = await db.collection('users').doc(uid).get();
      if (userRes.data && userRes.data.length > 0) {
        currentUserEmail = userRes.data[0].email || '';
      }
    } catch (err) {
      console.error("Error fetching user email", err);
    }

    if (!currentUserEmail) {
      setError("无法获取你的邮箱信息。");
      return;
    }
    
    const targetEmail = emailInput.trim().toLowerCase();

    if (!targetEmail.endsWith('@lzu.edu.cn')) {
      setError('必须是 @lzu.edu.cn 结尾的校园邮箱。');
      return;
    }

    if (targetEmail === currentUserEmail) {
      setError("你不能暗恋你自己。");
      return;
    }

    if (myDrops.some(drop => drop.toEmail === targetEmail)) {
      setError("你已经向这个邮箱投递过心意了。");
      return;
    }

    try {
      const dropId = `${currentUserEmail}_${targetEmail}`;
      await db.collection('drops').doc(dropId).set({
        fromUserId: uid,
        fromEmail: currentUserEmail,
        toEmail: targetEmail,
        timestamp: new Date().toISOString()
      });

      // Check mutual drop
      const reverseDropId = `${targetEmail}_${currentUserEmail}`;
      const reverseDropRes = await db.collection('drops').doc(reverseDropId).get();
      
      if (reverseDropRes.data && reverseDropRes.data.length > 0) {
        setSuccess(`匹配成功！你们互相暗恋了对方。快去匹配页看看吧！`);
      } else {
        setSuccess('心意已投递。只有当TA也投递了你，TA才会知道。');
      }

      setEmailInput('');
      fetchMyDrops();
    } catch (err: any) {
      setError(err.message || '投递失败，请重试。');
    }
  };

  const handleDeleteDrop = async (dropId: string) => {
    try {
      await db.collection('drops').doc(dropId).remove();
      setMyDrops(myDrops.filter(drop => drop.id !== dropId));
    } catch (err) {
      console.error("Error deleting drop:", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-black tracking-tight mb-4">匿名暗恋</h2>
        <p className="text-lg text-gray-500 font-medium max-w-md mx-auto">
          输入TA的校园邮箱。如果TA也输入了你的，就会匹配成功。否则，TA永远不会知道。
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border-2 border-gray-100 p-6 sm:p-8 mb-12">
        <form onSubmit={handleAddDrop} className="flex flex-col sm:flex-row gap-4">
          <input
            type="email"
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="TA的邮箱@lzu.edu.cn"
            className="flex-1 px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black transition-colors text-black placeholder:text-gray-400 text-lg font-medium"
          />
          <button
            type="submit"
            className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            投递心意
          </button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-xl">
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-black text-sm font-medium bg-gray-100 p-4 rounded-xl">
              {success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <h3 className="text-xl font-bold text-black mb-6">我投递过的心意 ({myDrops.length})</h3>
        {loading ? (
          <div className="text-gray-400 font-medium">加载中...</div>
        ) : myDrops.length === 0 ? (
          <div className="text-gray-400 font-medium bg-white border-2 border-gray-100 rounded-2xl p-6 text-center">
            你还没有向任何人投递过心意。
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {myDrops.map((drop) => (
                <motion.div
                  key={drop.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between bg-white p-5 rounded-2xl border-2 border-gray-100"
                >
                  <div className="font-medium text-black">{drop.toEmail}</div>
                  <button
                    onClick={() => handleDeleteDrop(drop.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-2"
                    title="撤回心意"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
