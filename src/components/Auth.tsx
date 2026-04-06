import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

export default function Auth() {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(location.state?.isLogin ?? true);
  const [email, setEmail] = useState(location.state?.email || '');
  const [campusCardNumber, setCampusCardNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.endsWith('@lzu.edu.cn')) {
      setError('必须使用 @lzu.edu.cn 邮箱注册或登录');
      setLoading(false);
      return;
    }

    if (!isLogin && !campusCardNumber) {
      setError('注册需要填写校园卡号');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
        if (userDoc.exists() && userDoc.data().onboardingCompleted) {
          navigate('/matches');
        } else {
          navigate('/onboarding');
        }
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          uid: userCred.user.uid,
          email: email.toLowerCase(),
          campusCardNumber: campusCardNumber,
          onboardingCompleted: false,
          createdAt: new Date().toISOString()
        });
        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || '认证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("/login-bg.jpg")', fontFamily: '"SimSun", "STSong", serif' }}
    >
      <Link 
        to="/" 
        className="absolute top-8 left-8 flex items-center text-white hover:text-gray-200 transition-colors font-bold z-10 drop-shadow-md"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        返回首页
      </Link>

      <div className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-12">
        {/* Left Side Text */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 text-left hidden md:flex flex-col justify-center"
        >
          <div className="space-y-4 mb-12">
            <h2 className="text-5xl lg:text-6xl font-bold text-white leading-tight ml-[100px] mt-0 -mb-3">
              不刷屏<br />
              每周遇见一个<br />
              对的人
            </h2>
          </div>
          <div className="space-y-2 text-lg">
            <p className="text-white font-bold text-[20px] ml-[100px]">兰州大学专属校园匹配平台。</p>
            <p className="text-white font-bold text-[20px] ml-[100px] mt-0 -mb-[50px] pb-0">填写问卷，每周四收到你的专属匹配。</p>
          </div>
          <div className="mt-16 text-white font-bold ml-[100px]">
            本周有128位lzuer活跃
          </div>
        </motion.div>

        {/* Right Side Form */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/5 backdrop-blur-sm border border-white/20 p-8 sm:p-10 rounded-3xl shadow-xl">
            <div className="mb-10 text-center">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-black mb-4 drop-shadow-md">
                兰期竹约
              </h1>
              <p className="text-lg text-black font-medium drop-shadow-sm">
                告别左滑右滑。专属兰大人的交友。
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="校园邮箱 (@lzu.edu.cn)"
                  className="w-full px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner"
                />
              </div>

              {!isLogin && (
                <div>
                  <input
                    type="text"
                    required
                    value={campusCardNumber}
                    onChange={(e) => setCampusCardNumber(e.target.value)}
                    placeholder="校园卡号"
                    className="w-full px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner"
                  />
                </div>
              )}

              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  className="w-full px-5 py-4 bg-white/20 border-2 border-black rounded-2xl focus:outline-none focus:border-black/60 transition-colors text-black placeholder:text-black/70 text-lg font-medium shadow-inner"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm font-medium bg-red-50/80 px-4 py-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-4 bg-black hover:bg-gray-800 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-50 mt-4 shadow-lg"
              >
                {loading ? '处理中...' : (isLogin ? '登录' : '创建账号')}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-bold text-white hover:text-gray-200 transition-colors drop-shadow-md"
              >
                {isLogin ? "没有账号？点击注册" : "已有账号？点击登录"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
