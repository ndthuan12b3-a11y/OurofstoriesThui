import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole, AppConfig } from '../types';
import { 
  Plus, Edit, Trash2, Search, Save, Calendar, 
  Music, Image as ImageIcon, History, Users, ShieldCheck, Settings,
  Volume2, VolumeX
} from 'lucide-react';
import { showNotification } from '../lib/notifications';
import { Modal } from './Modal';
import { cn, formatDate } from '../lib/utils';
import { useMusic } from '../lib/MusicContext';
import { Play, Pause, SkipBack, SkipForward, Repeat } from 'lucide-react';

const MusicManagementPlayer: React.FC = () => {
  const { 
    currentTrack, isPlaying, isRepeat, currentTime, duration, volume,
    togglePlay, playNext, playPrev, toggleRepeat, seekTo, setVolume 
  } = useMusic();

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-grow min-w-0">
          <p className="text-sm font-black text-gray-800 truncate">{currentTrack?.title || "Không có nhạc"}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Đang phát</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
            className="text-gray-400 hover:text-primary transition-colors"
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume} 
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <input 
          type="range" 
          min="0" 
          max={duration || 0} 
          value={currentTime} 
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[10px] font-bold text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button onClick={playPrev} className="text-gray-400 hover:text-primary transition-colors"><SkipBack size={22} /></button>
        <button 
          onClick={togglePlay} 
          className="w-14 h-14 flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
        >
          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} className="ml-1" fill="currentColor" />}
        </button>
        <button onClick={playNext} className="text-gray-400 hover:text-primary transition-colors"><SkipForward size={22} /></button>
        <button 
          onClick={toggleRepeat} 
          className={cn("transition-colors", isRepeat ? "text-primary" : "text-gray-300")}
        >
          <Repeat size={20} />
        </button>
      </div>
    </div>
  );
};

interface ManagementProps {
  userRole: UserRole;
  config: AppConfig;
  onConfigUpdate: () => void;
  userId: string;
}

const PRIMARY_CONFIG_ID = '6857068c-7cc5-45ce-8099-23f0e3264251';

export const Management: React.FC<ManagementProps> = ({ userRole, config, onConfigUpdate, userId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'config' | 'events' | 'gallery' | 'music' | 'users'>('dashboard');
  
  // Core Logic helpers
  const HAS_VIP_ACCESS = () => userRole === 'vip' || userRole === 'admin';
  const HAS_ADMIN_ACCESS = () => userRole === 'admin';
  const [events, setEvents] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [music, setMusic] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalPhotos: 0,
    totalMusic: 0,
    totalUsers: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [configForm, setConfigForm] = useState(config);
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [bgVideoFile, setBgVideoFile] = useState<File | null>(null);
  const [eventForm, setEventForm] = useState({ title: '', date: '', description: '', photoFile: null as File | null });
  const [photoForm, setPhotoForm] = useState({ description: '', tags: '', photoFile: null as File | null });
  const [musicForm, setMusicForm] = useState({ title: '', musicFile: null as File | null });

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!HAS_ADMIN_ACCESS()) return showNotification("Lỗi: Bạn không có quyền thực hiện thao tác này!", true);
    
    setLoading(true);
    let bgImageUrl = configForm.background_image_url;
    if (bgImageFile) {
      const url = await handleFileUpload(bgImageFile, 'config');
      if (url) bgImageUrl = url;
    }

    let bgVideoUrl = configForm.background_video_url;
    if (bgVideoFile) {
      const url = await handleFileUpload(bgVideoFile, 'config');
      if (url) bgVideoUrl = url;
    }
    
    const { error } = await supabase.from('config').update({ 
      ...configForm, 
      background_image_url: bgImageUrl, 
      background_video_url: bgVideoUrl 
    }).eq('user_id', PRIMARY_CONFIG_ID);
    if (error) showNotification("Lỗi cập nhật cấu hình!", true);
    else {
      showNotification("Cập nhật thành công!");
      document.documentElement.style.setProperty('--primary-color', configForm.primary_color);
      onConfigUpdate();
      setIsConfigModalOpen(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (editingItem) {
      if (activeSubTab === 'events') {
        setEventForm({ title: editingItem.title, date: editingItem.date, description: editingItem.description, photoFile: null });
      } else if (activeSubTab === 'gallery') {
        setPhotoForm({ description: editingItem.description, tags: editingItem.tags?.join(', ') || '', photoFile: null });
      } else if (activeSubTab === 'music') {
        setMusicForm({ title: editingItem.title, musicFile: null });
      }
    } else {
      setEventForm({ title: '', date: '', description: '', photoFile: null });
      setPhotoForm({ description: '', tags: '', photoFile: null });
      setMusicForm({ title: '', musicFile: null });
    }
  }, [editingItem, activeSubTab]);

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!HAS_VIP_ACCESS()) return showNotification("Lỗi: Bạn không có quyền thực hiện thao tác này!", true);
    
    setLoading(true);
    let photoUrl = editingItem?.photo_url;
    if (eventForm.photoFile) {
      const url = await handleFileUpload(eventForm.photoFile, 'events');
      if (url) photoUrl = url;
    }
    
    const data = {
      title: eventForm.title,
      date: eventForm.date,
      description: eventForm.description,
      photo_url: photoUrl,
      user_id: PRIMARY_CONFIG_ID
    };

    const { error } = editingItem 
      ? await supabase.from('events').update(data as any).eq('id', editingItem.id)
      : await supabase.from('events').insert([data as any]);

    if (error) showNotification("Lỗi khi lưu kỷ niệm!", true);
    else {
      showNotification("Đã lưu thành công!");
      setIsEventModalOpen(false);
      fetchData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setLoading(false);
  };

  const handlePhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!HAS_VIP_ACCESS()) return showNotification("Lỗi: Bạn không có quyền thực hiện thao tác này!", true);
    
    setLoading(true);
    let photoUrl = editingItem?.photo_url;
    if (photoForm.photoFile) {
      const url = await handleFileUpload(photoForm.photoFile, 'gallery');
      if (url) photoUrl = url;
    }
    
    const data = {
      description: photoForm.description,
      tags: photoForm.tags.split(',').map(t => t.trim()).filter(t => t),
      photo_url: photoUrl,
      user_id: PRIMARY_CONFIG_ID
    };

    const { error } = editingItem 
      ? await supabase.from('gallery').update(data as any).eq('id', editingItem.id)
      : await supabase.from('gallery').insert([data as any]);

    if (error) showNotification("Lỗi khi lưu ảnh!", true);
    else {
      showNotification("Đã lưu thành công!");
      setIsPhotoModalOpen(false);
      fetchData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setLoading(false);
  };

  const handleMusicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!HAS_VIP_ACCESS()) return showNotification("Lỗi: Bạn không có quyền thực hiện thao tác này!", true);
    
    setLoading(true);
    let musicUrl = editingItem?.music_url;
    if (musicForm.musicFile) {
      const url = await handleFileUpload(musicForm.musicFile, 'music');
      if (url) musicUrl = url;
    }
    
    const data = {
      title: musicForm.title,
      music_url: musicUrl,
      user_id: PRIMARY_CONFIG_ID
    };

    const { error } = editingItem 
      ? await supabase.from('music_playlist').update(data as any).eq('id', editingItem.id)
      : await supabase.from('music_playlist').insert([data as any]);

    if (error) showNotification("Lỗi khi lưu bài hát!", true);
    else {
      showNotification("Đã lưu thành công!");
      setIsMusicModalOpen(false);
      fetchData();
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'dashboard') {
        const [eventsRes, galleryRes, musicRes, usersRes] = await Promise.all([
          supabase.from('events').select('id', { count: 'exact' }),
          supabase.from('gallery').select('id', { count: 'exact' }),
          supabase.from('music_playlist').select('id', { count: 'exact' }),
          userRole === 'admin' ? supabase.rpc('get_all_users') : Promise.resolve({ count: 0 })
        ]);

        setStats({
          totalEvents: eventsRes.count || 0,
          totalPhotos: galleryRes.count || 0,
          totalMusic: musicRes.count || 0,
          totalUsers: (usersRes as any).data?.length || 0
        });
      }

      if (activeSubTab === 'events' || activeSubTab === 'dashboard') {
        const { data } = await supabase.from('events').select('*').order('date', { ascending: false }) as any;
        if (data) setEvents(data);
      }
      
      if (activeSubTab === 'gallery' || activeSubTab === 'dashboard') {
        const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false }) as any;
        if (data) setGallery(data);
      }
      
      if (activeSubTab === 'music' || activeSubTab === 'dashboard') {
        const { data } = await supabase.from('music_playlist').select('*').order('created_at', { ascending: true }) as any;
        if (data) setMusic(data);
      }
      
      if (activeSubTab === 'users' && userRole === 'admin') {
        const { data: usersData, error: usersError } = await supabase.rpc('get_all_users') as any;
        const { data: rolesData, error: rolesError } = await supabase.from('user_roles').select('*') as any;
        
        if (usersError) throw usersError;
        if (rolesError) throw rolesError;

        if (usersData && rolesData) {
          const merged = usersData.map((u: any) => ({
            ...u,
            role: rolesData.find((r: any) => r.user_id === u.id)?.role || 'none'
          }));
          setUsers(merged);
        }
      }
    } catch (error: any) {
      console.error("Lỗi khi tải dữ liệu:", error);
      showNotification("Không thể tải dữ liệu!", true);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, folder: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user.id}/${folder}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('love-photos')
      .upload(filePath, file);
      
    if (uploadError) {
      showNotification("Lỗi tải tệp lên!", true);
      return null;
    }
    
    const { data } = supabase.storage.from('love-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleDelete = async (table: string, id: string, photoUrl?: string) => {
    if (!HAS_VIP_ACCESS()) return showNotification("Lỗi: Bạn không có quyền thực hiện thao tác này!", true);
    if (!confirm("Bạn có chắc muốn xóa mục này?")) return;
    
    if (photoUrl) {
      // Logic to delete from storage could be added here if needed
    }
    
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) showNotification("Lỗi khi xóa!", true);
    else {
      showNotification("Đã xóa thành công!");
      fetchData();
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: UserRole) => {
    if (!HAS_ADMIN_ACCESS()) return showNotification("Lỗi: Bạn không có quyền thực hiện thao tác này!", true);
    
    // Không cho phép Admin tự hạ quyền của chính mình
    if (targetUserId === userId && newRole !== 'admin') {
      alert("Bạn không thể tự hạ quyền của chính mình!");
      return;
    }

    try {
      if (newRole === 'none') {
        // Nếu chọn 'none', ta xóa dòng trong bảng user_roles thay vì update
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', targetUserId);
        
        if (error) throw error;
        showNotification("Đã gỡ bỏ quyền thành công!");
      } else {
        // Kiểm tra xem đã có role chưa để quyết định update hay insert
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('user_id', targetUserId)
          .maybeSingle();

        let result;
        if (existingRole) {
          // Nếu đã có thì update
          result = await supabase
            .from('user_roles')
            .update({ role: newRole })
            .eq('user_id', targetUserId);
        } else {
          // Nếu chưa có thì insert
          result = await supabase
            .from('user_roles')
            .insert([{ user_id: targetUserId, role: newRole }]);
        }

        if (result.error) throw result.error;
        showNotification("Cập nhật quyền thành công!");
      }

      fetchData();
    } catch (error: any) {
      console.error("Lỗi cập nhật quyền chi tiết:", error);
      showNotification(`Lỗi cập nhật: ${error.message || "Vui lòng thử lại"}`, true);
    }
  };

  const handleDeleteUser = async (targetUserId: string, email: string) => {
    if (!HAS_ADMIN_ACCESS()) return showNotification("Lỗi: Bạn không có quyền thực hiện thao tác này!", true);
    if (targetUserId === userId) return showNotification("Bạn không thể tự xóa chính mình!", true);
    
    if (!confirm(`Bạn có chắc muốn xóa tài khoản ${email}? Thao tác này sẽ gỡ bỏ mọi quyền truy cập của người dùng này.`)) return;

    setLoading(true);
    try {
      // 1. Xóa role trước
      await supabase.from('user_roles').delete().eq('user_id', targetUserId);
      
      // 2. Cố gắng gọi RPC xóa user nếu có (đây là một giả định phổ biến trong các hệ thống admin)
      // Nếu không có RPC, ít nhất ta đã xóa quyền truy cập (role)
      const { error } = await supabase.rpc('delete_user_by_admin', { user_id: targetUserId });
      
      if (error) {
        console.warn("RPC delete_user_by_admin không tồn tại hoặc lỗi, nhưng quyền đã được gỡ bỏ.");
        showNotification("Đã gỡ bỏ quyền truy cập của người dùng.");
      } else {
        showNotification("Đã xóa tài khoản thành công!");
      }
      
      fetchData();
    } catch (error) {
      showNotification("Lỗi khi thực hiện xóa!", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn pb-20">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-black text-gray-800 flex items-center gap-2">
          <ShieldCheck className="text-red-500" /> Quản Lý Dữ Liệu
        </h1>
        <div className="flex bg-white rounded-xl p-1 soft-shadow overflow-x-auto max-w-full">
          {[
            { id: 'dashboard', label: 'Tổng Quan', icon: History },
            { id: 'config', label: 'Cấu Hình', icon: Settings },
            { id: 'events', label: 'Kỷ Niệm', icon: History },
            { id: 'gallery', label: 'Ảnh', icon: ImageIcon },
            { id: 'music', label: 'Nhạc', icon: Music },
            { id: 'users', label: 'Người Dùng', icon: Users, adminOnly: true },
          ].filter(t => !t.adminOnly || userRole === 'admin').map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                activeSubTab === tab.id 
                  ? "bg-primary text-white soft-shadow" 
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {activeSubTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Kỷ Niệm', value: stats.totalEvents, icon: History, color: 'text-blue-500', bg: 'bg-blue-50' },
                { label: 'Hình Ảnh', value: stats.totalPhotos, icon: ImageIcon, color: 'text-green-500', bg: 'bg-green-50' },
                { label: 'Bài Hát', value: stats.totalMusic, icon: Music, color: 'text-purple-500', bg: 'bg-purple-50' },
                { label: 'Người Dùng', value: stats.totalUsers, icon: Users, color: 'text-orange-500', bg: 'bg-orange-50' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl soft-shadow border border-gray-50">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
                    <stat.icon className={stat.color} size={24} />
                  </div>
                  <p className="text-3xl font-black text-gray-800">{stat.value}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Activity / Quick View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl soft-shadow border border-gray-50">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                  <History className="text-blue-500" size={20} /> Kỷ Niệm Mới
                </h3>
                <div className="space-y-4">
                  {events.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                      <img src={event.photo_url} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 truncate">{event.title}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{formatDate(event.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl soft-shadow border border-gray-50">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                  <ImageIcon className="text-green-500" size={20} /> Ảnh Mới Tải
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {gallery.slice(0, 8).map((photo) => (
                    <img 
                      key={photo.id} 
                      src={photo.photo_url} 
                      alt="" 
                      className="aspect-square rounded-xl object-cover hover:scale-105 transition-transform cursor-pointer" 
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl soft-shadow border border-gray-50">
                <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                  <Plus className="text-primary" size={20} /> Thao Tác Nhanh
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => { setActiveSubTab('events'); setIsEventModalOpen(true); }}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 hover:text-primary transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center soft-shadow group-hover:scale-110 transition-transform">
                      <History size={18} />
                    </div>
                    <span className="font-bold text-sm">Thêm Kỷ Niệm</span>
                  </button>
                  <button 
                    onClick={() => { setActiveSubTab('gallery'); setIsPhotoModalOpen(true); }}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 hover:text-primary transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center soft-shadow group-hover:scale-110 transition-transform">
                      <ImageIcon size={18} />
                    </div>
                    <span className="font-bold text-sm">Thêm Hình Ảnh</span>
                  </button>
                  <button 
                    onClick={() => { setActiveSubTab('music'); setIsMusicModalOpen(true); }}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 hover:text-primary transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center soft-shadow group-hover:scale-110 transition-transform">
                      <Music size={18} />
                    </div>
                    <span className="font-bold text-sm">Thêm Nhạc</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl soft-shadow">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center justify-between">
                Cấu Hình Chung
                <button 
                  onClick={() => setIsConfigModalOpen(true)}
                  className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <Edit size={18} />
                </button>
              </h2>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-400">Tiêu đề chính:</span>
                  <span className="font-bold">{config.main_title}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-400">Tên Anh:</span>
                  <span className="font-bold">{config.name_male}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-400">Tên Em:</span>
                  <span className="font-bold">{config.name_female}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-400">Màu chủ đạo:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: config.primary_color }} />
                    <span className="font-mono">{config.primary_color}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl soft-shadow">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Calendar className="text-primary" /> Ngày Bắt Đầu
              </h2>
              <div className="text-center py-8">
                <p className="text-gray-400 mb-2">Chúng ta bắt đầu từ:</p>
                <p className="text-3xl font-black text-primary">{formatDate(config.start_date)}</p>
              </div>
            </div>
          </div>
        )}

        {activeSubTab !== 'config' && (
          <div className="bg-white rounded-2xl soft-shadow overflow-hidden">
            {activeSubTab === 'music' && (
              <div className="p-6 border-b bg-gray-50/50">
                <MusicManagementPlayer />
              </div>
            )}
            <div className="p-4 border-b flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm"
                />
              </div>
              {activeSubTab !== 'users' && (
                <button 
                  onClick={() => {
                    setEditingItem(null);
                    if (activeSubTab === 'events') setIsEventModalOpen(true);
                    if (activeSubTab === 'gallery') setIsPhotoModalOpen(true);
                    if (activeSubTab === 'music') setIsMusicModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors soft-shadow"
                >
                  <Plus size={18} /> Thêm Mới
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    {activeSubTab === 'events' && (
                      <>
                        <th className="px-6 py-4">STT</th>
                        <th className="px-6 py-4">Ảnh</th>
                        <th className="px-6 py-4">Sự kiện</th>
                        <th className="px-6 py-4">Ngày</th>
                        <th className="px-6 py-4">Ngày tạo</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'gallery' && (
                      <>
                        <th className="px-6 py-4">STT</th>
                        <th className="px-6 py-4">Ảnh</th>
                        <th className="px-6 py-4">Mô tả</th>
                        <th className="px-6 py-4">Tags</th>
                        <th className="px-6 py-4">Ngày tạo</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'music' && (
                      <>
                        <th className="px-6 py-4">STT</th>
                        <th className="px-6 py-4">Tên bài hát</th>
                        <th className="px-6 py-4">Ngày tạo</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'users' && (
                      <>
                        <th className="px-6 py-4">STT</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Quyền hạn</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeSubTab === 'events' && events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-400">{index + 1}</td>
                      <td className="px-6 py-4">
                        <img src={item.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-700">{item.title}</td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(item.date)}</td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{formatDate(item.created_at, true)}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsEventModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete('events', item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'gallery' && gallery.filter(p => p.description.toLowerCase().includes(searchTerm.toLowerCase())).map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-400">{index + 1}</td>
                      <td className="px-6 py-4">
                        <img src={item.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-700 truncate max-w-[200px]">{item.description}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {item.tags?.map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold">#{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{formatDate(item.created_at, true)}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsPhotoModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete('gallery', item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'music' && music.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase())).map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-400">{index + 1}</td>
                      <td className="px-6 py-4 font-bold text-gray-700">{item.title}</td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{formatDate(item.created_at, true)}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsMusicModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete('music_playlist', item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'users' && users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase())).map((user, index) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-400">{index + 1}</td>
                      <td className="px-6 py-4 font-bold text-gray-700">{user.email}</td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                          className="bg-gray-50 border-none rounded-lg text-xs font-bold p-2 focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="none">None</option>
                          <option value="vip">VIP</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.id !== userId && (
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa tài khoản"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title="Cấu Hình Chung">
        <form onSubmit={handleConfigSubmit} className="space-y-4">
          <input type="text" value={configForm.main_title} onChange={e => setConfigForm({...configForm, main_title: e.target.value})} placeholder="Tiêu đề chính" className="w-full p-3 bg-gray-50 rounded-xl outline-none" required />
          <input type="text" value={configForm.main_subtitle} onChange={e => setConfigForm({...configForm, main_subtitle: e.target.value})} placeholder="Phụ đề" className="w-full p-3 bg-gray-50 rounded-xl outline-none" />
          <div className="grid grid-cols-2 gap-4">
            <input type="text" value={configForm.name_male} onChange={e => setConfigForm({...configForm, name_male: e.target.value})} placeholder="Tên Anh" className="p-3 bg-gray-50 rounded-xl outline-none" required />
            <input type="text" value={configForm.name_female} onChange={e => setConfigForm({...configForm, name_female: e.target.value})} placeholder="Tên Em" className="p-3 bg-gray-50 rounded-xl outline-none" required />
          </div>
          <input type="date" value={configForm.start_date} onChange={e => setConfigForm({...configForm, start_date: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl outline-none" required />
          <input type="color" value={configForm.primary_color} onChange={e => setConfigForm({...configForm, primary_color: e.target.value})} className="w-full h-12 bg-gray-50 rounded-xl outline-none cursor-pointer" />
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-500">Ảnh nền:</label>
              {configForm.background_image_url && (
                <button 
                  type="button"
                  onClick={() => setConfigForm({...configForm, background_image_url: ''})}
                  className="text-[10px] text-red-500 font-bold hover:underline"
                >
                  Xóa ảnh hiện tại
                </button>
              )}
            </div>
            <input type="file" onChange={e => setBgImageFile(e.target.files?.[0] || null)} className="w-full p-3 bg-gray-50 rounded-xl outline-none" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-500">Video nền (File):</label>
              {configForm.background_video_url && (
                <button 
                  type="button"
                  onClick={() => setConfigForm({...configForm, background_video_url: ''})}
                  className="text-[10px] text-red-500 font-bold hover:underline"
                >
                  Xóa video hiện tại
                </button>
              )}
            </div>
            <input type="file" accept="video/*" onChange={e => setBgVideoFile(e.target.files?.[0] || null)} className="w-full p-3 bg-gray-50 rounded-xl outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-4 btn-primary-gradient rounded-xl font-bold soft-shadow">Lưu Cấu Hình</button>
        </form>
      </Modal>

      <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title={editingItem ? "Sửa Kỷ Niệm" : "Thêm Kỷ Niệm"}>
        <form onSubmit={handleEventSubmit} className="space-y-4">
          <input type="text" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="Tên sự kiện" className="w-full p-3 bg-gray-50 rounded-xl outline-none" required />
          <input type="date" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl outline-none" required />
          <textarea value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} placeholder="Mô tả" className="w-full p-3 bg-gray-50 rounded-xl outline-none h-32" required />
          <input type="file" onChange={e => setEventForm({...eventForm, photoFile: e.target.files?.[0] || null})} className="w-full p-3 bg-gray-50 rounded-xl outline-none" />
          <button type="submit" disabled={loading} className="w-full py-4 btn-primary-gradient rounded-xl font-bold soft-shadow">{editingItem ? "Cập Nhật" : "Thêm Mới"}</button>
        </form>
      </Modal>
      <Modal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} title={editingItem ? "Sửa Ảnh" : "Thêm Ảnh"}>
        <form onSubmit={handlePhotoSubmit} className="space-y-4">
          <textarea value={photoForm.description} onChange={e => setPhotoForm({...photoForm, description: e.target.value})} placeholder="Mô tả ảnh" className="w-full p-3 bg-gray-50 rounded-xl outline-none h-24" required />
          <input type="text" value={photoForm.tags} onChange={e => setPhotoForm({...photoForm, tags: e.target.value})} placeholder="Tags (cách nhau bằng dấu phẩy)" className="w-full p-3 bg-gray-50 rounded-xl outline-none" />
          <input type="file" onChange={e => setPhotoForm({...photoForm, photoFile: e.target.files?.[0] || null})} className="w-full p-3 bg-gray-50 rounded-xl outline-none" />
          <button type="submit" disabled={loading} className="w-full py-4 btn-primary-gradient rounded-xl font-bold soft-shadow">{editingItem ? "Cập Nhật" : "Thêm Mới"}</button>
        </form>
      </Modal>

      <Modal isOpen={isMusicModalOpen} onClose={() => setIsMusicModalOpen(false)} title={editingItem ? "Sửa Bài Hát" : "Thêm Bài Hát"}>
        <form onSubmit={handleMusicSubmit} className="space-y-4">
          <input type="text" value={musicForm.title} onChange={e => setMusicForm({...musicForm, title: e.target.value})} placeholder="Tên bài hát" className="w-full p-3 bg-gray-50 rounded-xl outline-none" required />
          <input type="file" onChange={e => setMusicForm({...musicForm, musicFile: e.target.files?.[0] || null})} className="w-full p-3 bg-gray-50 rounded-xl outline-none" />
          <button type="submit" disabled={loading} className="w-full py-4 btn-primary-gradient rounded-xl font-bold soft-shadow">{editingItem ? "Cập Nhật" : "Thêm Mới"}</button>
        </form>
      </Modal>
    </div>
  );
};
