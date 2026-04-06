import React, { useState, useEffect } from 'react';
import { db, auth, storage } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';

import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    avatarUrl: '',
    campusCardNumber: '',
    email: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            name: data.name || '',
            bio: data.bio || '',
            avatarUrl: data.avatarUrl || '',
            campusCardNumber: data.campusCardNumber || '',
            email: data.email || ''
          });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        name: formData.name,
        bio: formData.bio,
        avatarUrl: formData.avatarUrl
      });
      setMessage({ type: 'success', text: '个人资料已更新。' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '更新失败，请重试。' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-10 flex justify-between items-end">
        <h2 className="text-4xl font-extrabold text-black tracking-tight">个人主页</h2>
        <button 
          onClick={() => navigate('/onboarding')}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-black rounded-xl font-bold transition-colors text-sm"
        >
          修改个性化档案
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-sm border-2 border-gray-100 p-6 sm:p-10"
      >
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 pb-8 border-b-2 border-gray-100">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
              <img
                className="w-full h-full object-cover"
                src={formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`}
                alt="Avatar preview"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 w-full flex flex-col items-start">
              <label className="block text-sm font-bold text-black mb-2">上传头像</label>
              <label className="cursor-pointer px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">
                选择图片
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !auth.currentUser) return;
                    try {
                      const storageRef = ref(storage, `avatars/${auth.currentUser.uid}_${Date.now()}`);
                      await uploadBytes(storageRef, file);
                      const url = await getDownloadURL(storageRef);
                      setFormData({ ...formData, avatarUrl: url });
                    } catch (err) {
                      console.error("Upload failed", err);
                      alert("图片上传失败，请重试");
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-black mb-2">姓名 / 昵称</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-black mb-2">个人简介</label>
              <textarea
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-black transition-colors text-black font-medium resize-none"
              />
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100">
            <h4 className="text-sm font-bold text-black mb-4">已认证信息</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">校园邮箱</label>
                <div className="text-sm font-bold text-black">{formData.email}</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">校园卡号</label>
                <div className="text-sm font-bold text-black">{formData.campusCardNumber}</div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <div className="flex-1">
              <AnimatePresence>
                {message.text && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold ${
                      message.type === 'success' ? 'text-black bg-gray-100' : 'text-red-600 bg-red-50'
                    }`}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
