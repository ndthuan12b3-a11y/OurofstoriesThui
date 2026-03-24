import React from 'react';
import { Home, History, Settings, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserRole } from '../types';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, userRole, onLogout }) => {
  const tabs = [
    { id: 'home', label: 'Trang Chính', icon: Home, show: true },
    { id: 'timeline', label: 'Dòng Thời Gian', icon: History, show: true },
    { id: 'management', label: 'Quản Lý', icon: Settings, show: true },
  ];

  return (
    <>
      {/* Desktop Nav */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-16 hover:w-56 bg-white/80 backdrop-blur-md border-r border-gray-100 flex-col items-center py-8 transition-all duration-300 z-50 group">
        <div className="mb-12 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          <h1 className="text-xl font-black text-primary">MENU</h1>
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
      <footer className="md:hidden fixed bottom-0 left-0 right-0 glassmorphism border-t border-white/30 p-2 z-50">
        <nav className="flex justify-around items-center">
          {tabs.filter(t => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 transition-colors",
                activeTab === tab.id ? "text-primary" : "text-gray-400"
              )}
            >
              <tab.icon size={20} />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          ))}
          <button
            onClick={onLogout}
            className="flex flex-col items-center gap-1 p-2 text-gray-400"
          >
            <LogOut size={20} />
            <span className="text-[10px] font-bold">Thoát</span>
          </button>
        </nav>
      </footer>
    </>
  );
};
