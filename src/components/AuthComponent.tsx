import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, User } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export const AuthComponent: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error: any) {
       console.error("Error signing in", error);
       alert("登录失败。如果您在内嵌窗口中运行，可能导致弹窗被拦截，请尝试点击右上角「在新标签页中打开」然后再尝试登录。 \n错误信息：" + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
     return <div className="animate-pulse w-24 h-6 bg-white/10 rounded" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pl-3 border-l border-white/10 shrink-0">
           {user.photoURL ? (
             <img src={user.photoURL} alt="avatar" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
           ) : (
             <User className="w-4 h-4 text-brand-accent" />
           )}
           <span className="text-xs font-bold text-white/80 max-w-[100px] truncate">{user.displayName || user.email}</span>
           <button 
             onClick={handleLogout}
             className="ml-2 text-[10px] text-white/40 hover:text-red-400 font-bold tracking-wider"
           >
             退出
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 pl-3 border-l border-white/10">
      <button 
        onClick={handleLogin}
        className="flex items-center gap-1.5 text-xs text-brand-accent hover:text-black hover:bg-brand-accent px-2 py-1 rounded transition-all font-bold tracking-widest"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>云端同步登陆</span>
      </button>
    </div>
  );
};
