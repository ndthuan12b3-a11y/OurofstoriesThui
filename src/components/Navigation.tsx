import React, { useState, useEffect } from 'react';
import { Home, History, Settings, LogOut } from 'lucide-react';
import { motion, useScroll, useMotionValueEvent } from 'motion/react';
import { cn } from '../lib/utils';
import { UserRole } from '../types';
import { usePresence } from '../lib/PresenceContext';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, userRole, onLogout }) => {
  const { isOtherOnline } = usePresence();
  const [hidden, setHidden] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    if (latest > previous && latest > 150) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  });

  const tabs = [
    { id: 'home', label: 'Trang Chính', icon: Home, show: true },
    { id: 'timeline', label: 'Dòng Thời Gian', icon: History, show: true },
    { id: 'management', label: 'Quản Lý', icon: Settings, show: true },
  ];

  return (
    <>
      {/* Desktop Nav */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-16 hover:w-56 bg-white/80 backdrop-blur-md border-r border-gray-100 flex-col items-center py-8 transition-all duration-300 z-50 group">
        <div className="mb-12 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap flex flex-col items-center">
          <h1 className="text-xl font-black text-primary">MENU</h1>
          <div className="flex items-center gap-2 mt-2">
            <div className={cn("w-2 h-2 rounded-full", isOtherOnline ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
              {isOtherOnline ? "Người ấy đang online" : "Người ấy đang offline"}
            </span>
          </div>
        </div>
        
        <nav className="flex-grow flex flex-col gap-4 w-full px-2">
          {tabs.filter(t => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-4 p-3 rounded-xl transition-all w-full",
                activeTab === tab.id 
                  ? "bg-primary/10 text-primary" 
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              )}
            >
              {activeTab === tab.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
              )}
              <tab.icon size={24} className="shrink-0" />
              <span className="font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          ))}
        </nav>

        <button
          onClick={onLogout}
          className="mt-auto flex items-center gap-4 p-3 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all w-full px-4"
        >
          <LogOut size={24} className="shrink-0" />
          <span className="font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Đăng Xuất
          </span>
        </button>
      </aside>

      {/* Mobile Nav */}
      <motion.footer 
        variants={{
          visible: { y: 0, opacity: 1 },
          hidden: { y: "150%", opacity: 0 },
        }}
        animate={hidden ? "hidden" : "visible"}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="md:hidden fixed bottom-6 left-4 right-4 bg-white/70 backdrop-blur-xl border border-white/40 p-3 z-[60] rounded-3xl soft-shadow"
      >
        <nav className="flex justify-around items-center">
          {tabs.filter(t => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 transition-all active:scale-90",
                activeTab === tab.id ? "text-primary scale-110" : "text-gray-400 opacity-60"
              )}
            >
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 3 : 2} />
              <span className={cn("text-[8px] font-black uppercase tracking-widest", activeTab === tab.id ? "block" : "hidden")}>
                {tab.id === 'home' ? 'Home' : tab.id === 'timeline' ? 'Moments' : 'Admin'}
              </span>
            </button>
          ))}
          <button
            onClick={onLogout}
            className="flex flex-col items-center gap-1 p-2 text-gray-400 opacity-60 active:scale-90"
          >
            <LogOut size={22} />
          </button>
        </nav>
      </motion.footer>
    </>
  );
};
