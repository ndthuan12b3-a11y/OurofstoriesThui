import React, { useState, useEffect } from 'react';
import { Home, History, Settings, LogOut, Music2, Pause, Play, SkipForward, Users, MapPin } from 'lucide-react';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserRole } from '../types';
import { usePresence } from '../lib/PresenceContext';
import { useMusic } from '../lib/MusicContext';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  onLogout: () => void;
  userProfile?: { avatar_url: string | null } | null;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, userRole, onLogout, userProfile }) => {
  const { isOtherOnline } = usePresence();
  const { currentTrack, isPlaying, togglePlay, playNext } = useMusic();
  const [hidden, setHidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showMusicControls, setShowMusicControls] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const checkModal = () => {
      setModalOpen(document.body.style.overflow === 'hidden');
    };

    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    
    return () => observer.disconnect();
  }, []);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    if (latest > previous && latest > 150) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  });

  const tabs = [
    { id: 'home', label: 'Home', icon: Home, show: true },
    { id: 'timeline', label: 'Timeline', icon: History, show: true },
    { id: 'map', label: 'Map', icon: MapPin, show: true },
    { id: 'management', label: 'Admin', icon: Settings, show: true },
  ];

  return (
    <>
      {/* 
        HUD - Follower (Top Hub for Status & Music)
        Chỉnh sửa để Hub không hiện giữa màn hình mà hiện ra theo màn hình đang nhìn thấy (Floating Sticky)
      */}
      <div className={cn(
        "fixed top-4 left-4 right-4 md:left-24 md:right-8 z-40 transition-all duration-300",
        hidden && "opacity-0 -translate-y-full pointer-events-none"
      )}>
        <div className="flex items-center justify-between gap-4">
          {/* Status Hub */}
          <div className="bg-white/70 backdrop-blur-xl border border-white/50 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-3">
            <div className="relative group">
              <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shadow-sm bg-gray-50 flex items-center justify-center">
                <img 
                  src={userProfile?.avatar_url || 'https://placehold.co/100x100?text=👤'} 
                  alt="My Avatar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className={cn(
                "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white bg-green-500 shadow-sm"
              )} title="Bạn đang online" />
            </div>
            <div className="h-4 w-px bg-gray-200 hidden sm:block mx-1" />
            <div className="relative flex items-center gap-2">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                isOtherOnline ? "bg-rose-500 animate-pulse" : "bg-gray-300"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-700 hidden sm:block">
                {isOtherOnline ? "Người ấy đang online ❤️" : "Người ấy đang offline"}
              </span>
              <Users size={14} className={cn("sm:hidden", isOtherOnline ? "text-rose-500" : "text-gray-400")} />
            </div>
          </div>

          {/* Music Hub */}
          <div 
            className="flex-grow max-w-xs bg-white/70 backdrop-blur-xl border border-white/50 px-4 py-2 rounded-full shadow-lg flex items-center gap-3 overflow-hidden group cursor-pointer"
            onClick={() => setShowMusicControls(!showMusicControls)}
          >
            <div className={cn("w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary", isPlaying && "animate-spin-slow")}>
              <Music2 size={16} />
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-[10px] font-black uppercase tracking-tighter text-gray-400 leading-none mb-0.5">Now Playing</p>
              <p className="text-[11px] font-bold text-gray-800 truncate leading-none">
                {currentTrack?.title || "No track selected"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="p-1.5 hover:bg-primary/20 rounded-full transition-colors text-primary"
              >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); playNext(); }}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hidden sm:block"
              >
                <SkipForward size={14} fill="currentColor" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Nav (HUD Side) */}
      <aside className={cn(
        "hidden md:flex fixed left-0 top-0 h-screen w-16 hover:w-56 bg-white/80 backdrop-blur-md border-r border-gray-100 flex-col items-center py-8 transition-all duration-300 z-50 group",
        modalOpen && "opacity-0 pointer-events-none"
      )}>
        <div className="mb-12 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap flex flex-col items-center">
          <h1 className="text-xl font-black text-primary tracking-tighter">THÚI HOUSE</h1>
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1 italic">Love Hub v2.0</p>
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

      {/* Mobile Nav (HUD Footer) */}
      <motion.footer 
        variants={{
          visible: { y: 0, opacity: 1 },
          hidden: { y: "150%", opacity: 0 },
        }}
        animate={hidden || modalOpen ? "hidden" : "visible"}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/70 backdrop-blur-xl border border-white/40 p-2 z-[60] rounded-[2rem] soft-shadow w-auto min-w-[280px]"
      >
        <nav className="flex justify-evenly items-center px-2">
          {tabs.filter(t => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 transition-all active:scale-95",
                activeTab === tab.id ? "text-primary bg-primary/5 rounded-2xl" : "text-gray-400 opacity-60"
              )}
            >
              <tab.icon size={24} strokeWidth={activeTab === tab.id ? 3 : 2} />
              <span className={cn("text-[8px] font-black uppercase tracking-widest", activeTab === tab.id ? "block" : "hidden")}>
                {tab.label}
              </span>
            </button>
          ))}
          <div className="w-px h-8 bg-gray-100 mx-2" />
          <button
            onClick={onLogout}
            className="flex flex-col items-center gap-1 p-3 text-gray-400 opacity-60 active:scale-95"
          >
            <LogOut size={24} />
          </button>
        </nav>
      </motion.footer>
    </>
  );
};
