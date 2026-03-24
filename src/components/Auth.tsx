import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { showNotification } from '../lib/notifications';
import { Heart } from 'lucide-react';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showNotification("Đăng nhập thành công!");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showNotification("Đăng ký thành công! Vui lòng kiểm tra email.");
      }
    } catch (error: any) {
      showNotification(error.message, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/10 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-fadeIn">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart size={32} fill="currentColor" />
          </div>
          <h2 className="text-2xl font-black text-gray-800">
            {isLogin ? "Đăng Nhập" : "Đăng Ký"}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Hành trình của chúng ta bắt đầu từ đây
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-primary/20 rounded-2xl outline-none transition-all"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              required
              className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-primary/20 rounded-2xl outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 btn-primary-gradient rounded-2xl font-bold soft-shadow disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : (isLogin ? "Đăng Nhập" : "Đăng Ký")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-bold text-primary hover:underline"
          >
            {isLogin ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  );
};
