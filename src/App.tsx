import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import { UserRole, AppConfig } from './types';
import { Navigation } from './components/Navigation';
import { Auth } from './components/Auth';
import { Gallery } from './components/Gallery';
import { Timeline } from './components/Timeline';
import { Management } from './components/Management';
import { Modal } from './components/Modal';
import { BackgroundMusicPlayer } from './components/BackgroundMusicPlayer';
import { MemoriesNotification } from './components/MemoriesNotification';
import { showNotification } from './lib/notifications';
import { cn } from './lib/utils';
import { Lock, LogOut, ShieldAlert } from 'lucide-react';

const PRIMARY_CONFIG_ID = '6857068c-7cc5-45ce-8099-23f0e3264251';

const DEFAULT_CONFIG: AppConfig = {
  start_date: new Date().toISOString().split('T')[0],
  name_male: 'Anh',
  name_female: 'Em',
  primary_color: '#fca5a5',
  main_title: 'Hành Trình Của Chúng Ta',
  main_subtitle: 'Nơi lưu giữ những khoảnh khắc ngọt ngào',
  avatar_url: 'https://placehold.co/150x150/fcc4d6/333?text=Ảnh',
};

const SUPABASE_CONFIGURED = !!((import.meta as any).env.VITE_SUPABASE_URL && (import.meta as any).env.VITE_SUPABASE_ANON_KEY);

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('none');
  const [loadingRole, setLoadingRole] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
  const [passcodeModalOpen, setPasscodeModalOpen] = useState(false);
  const [passcode, setPasscode] = useState('');

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id);
      else setLoadingRole(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id);
      else {
        setUserRole('none');
        setLoadingRole(false);
        setIsManagerAuthenticated(false);
      }
    });

    fetchConfig();

    return () => subscription.unsubscribe();
  }, []);

  if (!SUPABASE_CONFIGURED) {
    return (
      <div className="min-h-screen bg-rose-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Cấu hình Supabase chưa hoàn tất</h1>
          <p className="text-gray-600 mb-6">
            Vui lòng thiết lập các biến môi trường <strong>VITE_SUPABASE_URL</strong> và <strong>VITE_SUPABASE_ANON_KEY</strong> trong bảng điều khiển Secrets của AI Studio.
          </p>
          <div className="bg-gray-100 p-4 rounded-lg text-left text-sm font-mono break-all">
            VITE_SUPABASE_URL=...<br/>
            VITE_SUPABASE_ANON_KEY=...
          </div>
        </div>
      </div>
    );
  }

  const fetchUserRole = async (userId: string) => {
    setLoadingRole(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle() as any;
      
      if (error) throw error;

      const role = data ? data.role : 'none';
      setUserRole(role);
      (window as any).userRole = role; // Gán quyền lấy được vào biến toàn cục
    } catch (error: any) {
      console.error("Lỗi khi tải quyền người dùng:", error);
      setUserRole('none');
      (window as any).userRole = 'none';
    } finally {
      setLoadingRole(false);
    }
  };

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('config')
      .select('*')
      .eq('user_id', PRIMARY_CONFIG_ID)
      .single() as any;
    if (data) {
      setConfig(data);
      document.documentElement.style.setProperty('--primary-color', data.primary_color);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActiveTab('home');
    setIsManagerAuthenticated(false);
    showNotification("Đã đăng xuất");
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'management') {
      if (userRole === 'admin' || isManagerAuthenticated) {
        setActiveTab(tab);
      } else if (userRole === 'vip') {
        setPasscodeModalOpen(true);
      } else {
        // userRole === 'none'
        setActiveTab(tab);
      }
      return;
    }
    setActiveTab(tab);
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.rpc('fn_check_manager_passcode', { 
      input_passcode: passcode 
    } as any) as any;
    
    if (error) {
      showNotification("Lỗi xác thực!", true);
    } else if (data) {
      setIsManagerAuthenticated(true);
      setPasscodeModalOpen(false);
      setActiveTab('management');
      showNotification("Xác thực thành công!");
    } else {
      showNotification("Mật khẩu không chính xác!", true);
    }
    setPasscode('');
  };

  if (!session) return (
    <div className="min-h-screen">
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4">
        <BackgroundMusicPlayer active={true} />
      </div>
      <Auth />
      <Toaster position="top-center" />
    </div>
  );

  if (loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-primary font-bold animate-pulse">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  // Các hàm kiểm tra quyền nhanh (Core Logic)
  const HAS_VIEW_ACCESS = () => userRole === 'vip' || userRole === 'admin';
  const HAS_VIP_ACCESS = () => userRole === 'vip' || userRole === 'admin';
  const HAS_ADMIN_ACCESS = () => userRole === 'admin';

  // Gán các hàm kiểm tra vào window để sử dụng ở mọi nơi nếu cần
  (window as any).HAS_VIEW_ACCESS = HAS_VIEW_ACCESS;
  (window as any).HAS_VIP_ACCESS = HAS_VIP_ACCESS;
  (window as any).HAS_ADMIN_ACCESS = HAS_ADMIN_ACCESS;

  const hasBackgroundAccess = HAS_VIP_ACCESS();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Toaster position="top-center" />
      <MemoriesNotification />
      <BackgroundMusicPlayer active={true} />
      
      {/* Background Layer */}
      {hasBackgroundAccess && (
        <div className="fixed inset-0 -z-20 overflow-hidden">
          {config.background_video_url ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              src={config.background_video_url}
            />
          ) : config.background_image_url ? (
            <div 
              className="w-full h-full bg-cover bg-center bg-fixed"
              style={{ backgroundImage: `url(${config.background_image_url})` }}
            />
          ) : null}
        </div>
      )}

      <Navigation 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        userRole={userRole}
        onLogout={handleLogout}
      />

      <main className="flex-grow md:ml-16 p-4 md:p-12 pb-24 md:pb-12">
        <div className="container mx-auto max-w-6xl">
          {activeTab === 'home' && (
            <div id="gallery-container">
              <Gallery config={config} userRole={userRole} />
            </div>
          )}
          {activeTab === 'timeline' && (
            <div id="timeline-container">
              <Timeline config={config} userRole={userRole} />
            </div>
          )}
          {activeTab === 'management' && (userRole === 'admin' || isManagerAuthenticated) && (
            <Management 
              userRole={userRole} 
              config={config} 
              onConfigUpdate={fetchConfig} 
              userId={session.user.id}
            />
          )}
          {activeTab === 'management' && userRole === 'none' && !isManagerAuthenticated && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-3xl shadow-xl border border-red-100">
              <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Yêu Cầu Quyền Truy Cập</h2>
              <p className="text-gray-600 max-w-md mb-6">
                Bạn cần có quyền <strong>VIP</strong> hoặc <strong>Admin</strong> để truy cập vào tính năng quản lý này. 
                Vui lòng liên hệ quản trị viên để được cấp quyền.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a 
                  href="https://zalo.me/84866264751" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-blue-500 text-white rounded-full font-bold hover:bg-blue-600 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                >
                  Liên hệ qua Zalo
                </a>
                <button 
                  onClick={() => setActiveTab('home')}
                  className="px-8 py-3 bg-gray-100 text-gray-700 rounded-full font-bold hover:bg-gray-200 transition-all transform hover:scale-105 shadow-md"
                >
                  Quay Lại Trang Chủ
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={passcodeModalOpen}
        onClose={() => setPasscodeModalOpen(false)}
        title="Xác Thực Quản Trị"
        className="max-w-sm"
      >
        <form onSubmit={handlePasscodeSubmit} className="space-y-4 text-center">
          <p className="text-sm text-gray-500 mb-4">
            Vui lòng nhập mật khẩu quản lý để tiếp tục.
          </p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Mật khẩu"
            className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-primary/20 rounded-2xl outline-none text-center font-bold tracking-widest"
            autoFocus
          />
          <button type="submit" className="w-full py-4 btn-primary-gradient rounded-2xl font-bold soft-shadow">
            Xác Nhận
          </button>
        </form>
      </Modal>
    </div>
  );
}
