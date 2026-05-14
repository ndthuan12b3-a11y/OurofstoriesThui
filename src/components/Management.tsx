import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { UserRole, AppConfig } from '../types';
import { 
  Plus, Edit, Trash2, Search, Save, Calendar, 
  Music, Image as ImageIcon, History, Users, ShieldCheck, Settings,
  Volume2, VolumeX, BookOpen, Camera, RefreshCw, Sparkles, Heart, ShieldAlert
} from 'lucide-react';
import { showNotification } from '../lib/notifications';
import { Modal } from './Modal';
import { cn, formatDate } from '../lib/utils';
import { compressImage } from '../lib/imageUtils';
import { useMusic, useMusicProgress } from '../lib/MusicContext';
// Management.tsx logic cleanup
import { Play, Pause, SkipBack, SkipForward, Repeat, MapPin } from 'lucide-react';
import { LocationPicker } from './LocationPicker';

const MusicManagementPlayer: React.FC = () => {
  const { 
    currentTrack, isPlaying, isRepeat, volume,
    togglePlay, playNext, playPrev, toggleRepeat, seekTo, setVolume 
  } = useMusic();
  const { currentTime, duration } = useMusicProgress();

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-4">
          <div className="flex-grow min-w-0 pr-4">
            <p className="text-sm font-black text-gray-800 truncate">{currentTrack?.title || "Sẵn sàng phát nhạc"}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{isPlaying ? "Đang phát giai điệu" : "Đang tạm dừng"}</p>
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
  userEmail?: string | null;
  userProfile?: { id: string, avatar_url: string | null } | null;
  onProfileUpdate?: () => void;
}

const PRIMARY_CONFIG_ID = '6857068c-7cc5-45ce-8099-23f0e3264251';

export const Management: React.FC<ManagementProps> = ({ 
  userRole, config, onConfigUpdate, userId, userEmail, userProfile, onProfileUpdate 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'config' | 'events' | 'gallery' | 'music' | 'stories' | 'users'>('dashboard');
  
  // Core Logic helpers
  const HAS_VIP_ACCESS = () => userRole === 'vip' || userRole === 'admin';
  const HAS_ADMIN_ACCESS = () => userRole === 'admin';
  const [events, setEvents] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [music, setMusic] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalPhotos: 0,
    totalMusic: 0,
    totalStories: 0,
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

  useEffect(() => {
    setConfigForm(config);
  }, [config]);

  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [bgVideoFile, setBgVideoFile] = useState<File | null>(null);
  const [eventForm, setEventForm] = useState({ 
    title: '', 
    date: '', 
    description: '', 
    photoFile: null as File | null,
    location: null as { lat: number; lng: number; address_name: string } | null
  });
  const [photoForm, setPhotoForm] = useState({ description: '', tags: '', photoFile: null as File | null });
  const [musicForm, setMusicForm] = useState({ title: '', musicFile: null as File | null });
  const [personalAvatarFile, setPersonalAvatarFile] = useState<File | null>(null);
  const [personalAvatarPreview, setPersonalAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (personalAvatarFile) {
      const url = URL.createObjectURL(personalAvatarFile);
      setPersonalAvatarPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPersonalAvatarPreview(null);
    }
  }, [personalAvatarFile]);

  const handlePersonalProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setLoading(true);
    try {
      let avatarUrl = userProfile?.avatar_url;
      if (personalAvatarFile) {
        const compressedFile = await compressImage(personalAvatarFile);
        const url = await handleFileUpload(compressedFile, 'profiles');
        if (url) avatarUrl = url;
      }

      // Thử lấy profile hiện tại để lấy 'id' nếu có
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        if (fetchError.code === 'PGRST204' || fetchError.message.includes('avatar_url')) {
          console.error("Database structure mismatch for profiles table.");
          showNotification("Cần cập nhật Database để dùng ảnh đại diện. Vui lòng chạy SQL fix.", true);
          return;
        }
        throw fetchError;
      }

      let profileResult;
      const profileData = {
        id: userId,
        user_id: userId,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      };

      // Thử upsert dựa trên Primary Key 'id' (luôn là cách an toàn nhất)
      profileResult = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (profileResult.error) {
        console.warn("UPSERT on 'id' failed, trying on 'user_id'...", profileResult.error);
        // Fallback: Nếu cấu trúc cũ yêu cầu 'user_id' làm key duy nhất
        profileResult = await supabase
          .from('profiles')
          .upsert(profileData, { onConflict: 'user_id' });
      }

      if (profileResult.error) {
        console.error("Critical error updating profile:", profileResult.error);
        throw profileResult.error;
      }

      setPersonalAvatarFile(null); // Xóa file cục bộ để hiển thị ảnh mới từ server
      showNotification("Cập nhật ảnh đại diện thành công!");
      onProfileUpdate?.();
    } catch (error: any) {
      console.error("Lỗi cập nhật profile:", error);
      const errorMsg = error.message || "Vui lòng thử lại";
      showNotification(`Lỗi cập nhật: ${errorMsg}`, true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!HAS_ADMIN_ACCESS()) return showNotification("Lỗi: Bạn không có quyền thực hiện thao tác này!", true);
    
    setLoading(true);
    let bgImageUrl = configForm.background_image_url;
    if (bgImageFile) {
      const compressedFile = await compressImage(bgImageFile);
      const url = await handleFileUpload(compressedFile, 'config');
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
        setEventForm({ 
          title: editingItem.title, 
          date: editingItem.date, 
          description: editingItem.description, 
          photoFile: null,
          location: editingItem.location
        });
      } else if (activeSubTab === 'gallery') {
        setPhotoForm({ description: editingItem.description, tags: editingItem.tags?.join(', ') || '', photoFile: null });
      } else if (activeSubTab === 'music') {
        setMusicForm({ title: editingItem.title, musicFile: null });
      }
    } else {
      setEventForm({ title: '', date: '', description: '', photoFile: null, location: null });
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
      const compressedFile = await compressImage(eventForm.photoFile);
      const url = await handleFileUpload(compressedFile, 'events');
      if (url) photoUrl = url;
    }
    
    const data = {
      title: eventForm.title,
      date: eventForm.date,
      description: eventForm.description,
      photo_url: photoUrl,
      location: eventForm.location,
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
      const compressedFile = await compressImage(photoForm.photoFile);
      const url = await handleFileUpload(compressedFile, 'gallery');
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
        const [eventsRes, galleryRes, musicRes, storiesRes, usersRes] = await Promise.all([
          supabase.from('events').select('id', { count: 'exact' }),
          supabase.from('gallery').select('id', { count: 'exact' }),
          supabase.from('music_playlist').select('id', { count: 'exact' }),
          supabase.from('stories').select('id', { count: 'exact' }),
          userRole === 'admin' ? supabase.rpc('get_all_users') : Promise.resolve({ count: 0 })
        ]);

        setStats({
          totalEvents: eventsRes.count || 0,
          totalPhotos: galleryRes.count || 0,
          totalMusic: musicRes.count || 0,
          totalStories: storiesRes.count || 0,
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

      if (activeSubTab === 'stories' || activeSubTab === 'dashboard') {
        const { data } = await supabase.from('stories').select('*').order('created_at', { ascending: false }) as any;
        if (data) setStories(data);
      }

      if (activeSubTab === 'users' || activeSubTab === 'dashboard') {
        if (userRole === 'admin') {
          const { data } = await supabase.rpc('get_all_users') as any;
          if (data) setUsers(data);
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
    
    const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    const fileName = `${Date.now()}_${safeName}`;
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
      <div className="mb-10 md:mb-16">
        <div className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[4rem] p-1.5 md:p-2 shadow-sm border border-white/60 w-full mx-auto max-w-6xl">
          <div className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar scroll-smooth px-1 py-1">
            {[
              { id: 'dashboard', label: 'Tổng Quan', icon: Sparkles },
              { id: 'config', label: 'Cấu Hình', icon: Settings },
              { id: 'events', label: 'Kỷ Niệm', icon: History, count: stats.totalEvents },
              { id: 'gallery', label: 'Kho Ảnh', icon: ImageIcon, count: stats.totalPhotos },
              { id: 'stories', label: 'Truyện', icon: BookOpen, count: stats.totalStories },
              { id: 'users', label: 'Thành Viên', icon: Users, adminOnly: true, count: stats.totalUsers },
            ].filter(t => !t.adminOnly || userRole === 'admin').map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 md:gap-3 px-4 md:px-7 py-3 md:py-4 rounded-[2rem] md:rounded-[3rem] transition-all duration-300 group shrink-0 relative cursor-pointer touch-manipulation min-w-max",
                  activeSubTab === tab.id 
                    ? "bg-white text-primary shadow-lg z-10" 
                    : "text-gray-500 hover:text-gray-800 hover:bg-white/30"
                )}
              >
                <div className={cn(
                  "w-7 h-7 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 shrink-0",
                  activeSubTab === tab.id ? "bg-primary text-white shadow-primary/20 shadow-lg" : "bg-white/60 group-hover:bg-white"
                )}>
                  <tab.icon size={activeSubTab === tab.id ? 14 : 15} className={cn("md:w-5 md:h-5", activeSubTab === tab.id ? "text-white" : "text-gray-400 group-hover:text-primary")} />
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className={cn(
                    "block text-[10px] md:text-sm font-black uppercase tracking-wider transition-colors",
                    activeSubTab === tab.id ? "text-gray-900" : "text-gray-500"
                  )}>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={cn(
                      "text-[8px] md:text-[10px] font-bold mt-0.5",
                      activeSubTab === tab.id ? "text-primary" : "text-gray-300"
                    )}>{tab.count} mục</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        {activeSubTab === 'dashboard' && (
          <div className="space-y-12">
            {/* Personal Profile Section */}
            <div className="bg-white/30 backdrop-blur-md p-6 md:p-8 rounded-[3rem] md:rounded-[4rem] border border-white/50 soft-shadow flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="relative group shrink-0">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white group-hover:opacity-90 transition-all bg-gray-50 flex items-center justify-center">
                  <img 
                    src={personalAvatarPreview || userProfile?.avatar_url || 'https://placehold.co/150x150?text=Avatar'} 
                    className="w-full h-full object-cover" 
                    alt="Personal Avatar" 
                    referrerPolicy="no-referrer"
                  />
                  {loading && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <RefreshCw size={24} className="text-white animate-spin" />
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  id="personal-avatar" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => setPersonalAvatarFile(e.target.files?.[0] || null)}
                />
                <label 
                  htmlFor="personal-avatar" 
                  className="absolute -bottom-2 -right-2 w-10 h-10 md:w-12 md:h-12 bg-primary text-white rounded-[1.2rem] md:rounded-[1.5rem] shadow-xl flex items-center justify-center cursor-pointer hover:scale-110 transition-transform z-10 border-4 border-white"
                >
                  <Camera size={18} className="md:w-5 md:h-5" />
                </label>
              </div>
              
              <div className="flex-grow text-center md:text-left min-w-0">
                <h2 className="text-xl md:text-2xl font-black text-gray-800 uppercase tracking-tighter truncate">Hồ sơ cá nhân</h2>
                <p className="text-xs md:text-sm text-gray-500 font-medium mt-1 md:mt-2 leading-relaxed line-clamp-2 md:line-clamp-none">Cài đặt ảnh đại diện riêng để hiển thị trên bản đồ.</p>
                
                <div className="mt-6 md:mt-8 flex flex-col items-center md:items-start gap-4">
                  {(personalAvatarFile) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-center md:justify-start gap-4"
                    >
                      <button 
                        onClick={handlePersonalProfileSubmit}
                        disabled={loading}
                        className="px-6 md:px-8 py-3 md:py-4 bg-gray-900 text-white rounded-[1.5rem] md:rounded-3xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary transition-all flex items-center gap-2 shadow-lg"
                      >
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        Lưu hồ sơ
                      </button>
                      <button 
                        onClick={() => {
                          setPersonalAvatarFile(null);
                        }}
                        className="px-6 md:px-8 py-3 md:py-4 bg-white/50 text-gray-500 rounded-[1.5rem] md:rounded-3xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all shadow-sm"
                      >
                        Hủy
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="hidden md:block shrink-0 px-6 py-4 md:px-10 md:py-6 bg-rose-50/50 backdrop-blur-sm rounded-[2rem] md:rounded-[3rem] border border-rose-100 shadow-sm">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center text-rose-500 shadow-md">
                    <Heart size={20} fill="currentColor" className="md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-[9px] md:text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] leading-none mb-1 md:mb-2">Trạng thái</p>
                    <p className="text-[10px] md:text-xs font-black text-gray-800 leading-none">Cá nhân hóa ❤️</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Music Player Section - NEW Integrated Home Hub Player */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-10">
              <div className="xl:col-span-2 bg-white/20 backdrop-blur-md p-6 md:p-10 rounded-[3rem] md:rounded-[4rem] border border-white/30 shadow-sm">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <h3 className="text-lg md:text-xl font-black text-gray-800 flex items-center gap-3">
                    <Music className="text-primary" size={24} /> Trình Phát Nhạc
                  </h3>
                  <button 
                    onClick={() => { setEditingItem(null); setIsMusicModalOpen(true); }}
                    className="p-2 md:p-3 bg-primary text-white rounded-2xl md:rounded-[1.5rem] hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <MusicManagementPlayer />
                  <div className="bg-white/40 rounded-3xl p-4 md:p-6 border border-white/50 max-h-[280px] overflow-y-auto no-scrollbar">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Danh sách phát</p>
                    <div className="space-y-2">
                       {music.map((m, index) => (
                         <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/60 transition-colors group">
                           <div className="flex items-center gap-3 min-w-0">
                             <span className="text-[10px] font-black text-gray-300 w-4">{index + 1}</span>
                             <span className="text-xs font-black text-gray-700 truncate">{m.title}</span>
                           </div>
                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => { setEditingItem(m); setIsMusicModalOpen(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit size={14} /></button>
                             <button onClick={() => handleDelete('music_playlist', m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                           </div>
                         </div>
                       ))}
                       {music.length === 0 && <p className="text-center py-8 text-gray-400 text-[10px] font-black uppercase tracking-widest italic">Chưa có nhạc</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/30 backdrop-blur-md p-6 md:p-8 rounded-[3rem] border border-white/50 flex flex-col justify-center items-center text-center">
                 <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                    <Sparkles size={32} />
                 </div>
                 <h4 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Số liệu HUB</h4>
                 <div className="grid grid-cols-2 gap-4 w-full mt-6">
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                       <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Kỷ niệm</p>
                       <p className="text-xl font-black text-primary">{stats.totalEvents}</p>
                    </div>
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                       <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Hình ảnh</p>
                       <p className="text-xl font-black text-primary">{stats.totalPhotos}</p>
                    </div>
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                       <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Giai điệu</p>
                       <p className="text-xl font-black text-primary">{stats.totalMusic}</p>
                    </div>
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50">
                       <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Bộ truyện</p>
                       <p className="text-xl font-black text-primary">{stats.totalStories}</p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Recent Activity / Quick View */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
              <div className="bg-white/20 backdrop-blur-md p-6 md:p-10 rounded-[3rem] md:rounded-[4rem] border border-white/30 shadow-sm">
                <h3 className="text-lg md:text-xl font-black text-gray-800 mb-6 md:mb-8 flex items-center gap-3">
                  <History className="text-blue-500" size={24} /> Kỷ Niệm Mới Nhất
                </h3>
                <div className="space-y-4 md:space-y-6">
                  {events.slice(0, 4).map((event) => (
                    <div key={event.id} className="flex items-center gap-4 md:gap-6 p-3 md:p-4 rounded-[2rem] md:rounded-[2.5rem] hover:bg-white/40 transition-all border border-transparent hover:border-white/50 group">
                      <img src={event.photo_url} alt="" className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2rem] object-cover shadow-md group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                      <div className="min-w-0">
                        <p className="font-black text-base md:text-lg text-gray-800 truncate">{event.title}</p>
                        <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1 md:mt-2">{formatDate(event.date)}</p>
                      </div>
                      <button 
                        onClick={() => { setActiveSubTab('events'); setEditingItem(event); setIsEventModalOpen(true); }}
                        className="ml-auto p-2 md:p-3 text-gray-300 hover:text-primary transition-colors hover:bg-white rounded-xl md:rounded-2xl"
                      >
                        <Edit size={18} className="md:w-5 md:h-5" />
                      </button>
                    </div>
                  ))}
                  {events.length === 0 && <p className="text-center py-8 md:py-12 text-gray-400 font-bold text-[10px] md:text-xs uppercase tracking-[0.3em] italic">Chưa có kỷ niệm nào</p>}
                </div>
                <button 
                  onClick={() => setActiveSubTab('events')}
                  className="w-full mt-6 md:mt-8 py-3 md:py-4 text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-[0.4em] hover:text-primary transition-colors border-t border-white/20 pt-6 md:pt-8"
                >
                  Xem tất cả kỷ niệm
                </button>
              </div>

              <div className="bg-white/20 backdrop-blur-md p-6 md:p-10 rounded-[3rem] md:rounded-[4rem] border border-white/30 shadow-sm">
                <h3 className="text-lg md:text-xl font-black text-gray-800 mb-6 md:mb-8 flex items-center gap-3">
                  <ImageIcon className="text-green-500" size={24} /> Kho Ảnh Đã Tải
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 md:gap-4">
                  {gallery.slice(0, 12).map((photo) => (
                    <img 
                      key={photo.id} 
                      src={photo.photo_url} 
                      alt="" 
                      className="aspect-square rounded-[1.2rem] md:rounded-[1.5rem] object-cover hover:scale-110 transition-all cursor-pointer shadow-md border-2 border-white/50" 
                      referrerPolicy="no-referrer"
                      onClick={() => { setActiveSubTab('gallery'); setEditingItem(photo); setIsPhotoModalOpen(true); }}
                    />
                  ))}
                  {gallery.length === 0 && <div className="col-span-3 sm:col-span-4 py-12 md:py-16 text-center text-gray-400 font-bold text-[10px] md:text-xs uppercase tracking-[0.3em] italic">Chưa có hình ảnh nào</div>}
                </div>
                <button 
                  onClick={() => setActiveSubTab('gallery')}
                  className="w-full mt-6 md:mt-8 py-3 md:py-4 text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-[0.4em] hover:text-primary transition-colors border-t border-white/20 pt-6 md:pt-8"
                >
                  Truy cập kho ảnh
                </button>
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

        {activeSubTab !== 'config' && activeSubTab !== 'dashboard' && (
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

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-400 font-black uppercase text-[9px] md:text-[10px] tracking-widest border-b border-gray-100">
                  <tr>
                    {activeSubTab === 'events' && (
                      <>
                        <th className="px-4 md:px-6 py-4">STT</th>
                        <th className="px-4 md:px-6 py-4">Ảnh</th>
                        <th className="px-4 md:px-6 py-4">Sự kiện</th>
                        <th className="px-4 md:px-6 py-4">Ngày</th>
                        <th className="px-6 py-4 hidden md:table-cell">Ngày tạo</th>
                        <th className="px-4 md:px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'gallery' && (
                      <>
                        <th className="px-4 md:px-6 py-4">STT</th>
                        <th className="px-4 md:px-6 py-4">Ảnh</th>
                        <th className="px-4 md:px-6 py-4">Mô tả</th>
                        <th className="px-6 py-4 hidden md:table-cell">Tags</th>
                        <th className="px-6 py-4 hidden md:table-cell">Ngày tạo</th>
                        <th className="px-4 md:px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'music' && (
                      <>
                        <th className="px-4 md:px-6 py-4">STT</th>
                        <th className="px-4 md:px-6 py-4">Tên bài hát</th>
                        <th className="px-6 py-4 hidden md:table-cell">Ngày tạo</th>
                        <th className="px-4 md:px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'stories' && (
                      <>
                        <th className="px-4 md:px-6 py-4">STT</th>
                        <th className="px-4 md:px-6 py-4">Nội dung tóm tắt</th>
                        <th className="px-6 py-4 hidden md:table-cell">Ngày tạo</th>
                        <th className="px-4 md:px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'users' && (
                      <>
                        <th className="px-4 md:px-6 py-4">STT</th>
                        <th className="px-4 md:px-6 py-4">Email</th>
                        <th className="px-4 md:px-6 py-4">Quyền hạn</th>
                        <th className="px-4 md:px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeSubTab === 'events' && events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-400 text-xs">{index + 1}</td>
                      <td className="px-4 md:px-6 py-4">
                        <img src={item.photo_url} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover shadow-sm" referrerPolicy="no-referrer" />
                      </td>
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-700 text-xs md:text-sm">{item.title}</td>
                      <td className="px-4 md:px-6 py-4 text-[10px] md:text-sm text-gray-500 font-medium">{formatDate(item.date)}</td>
                      <td className="px-6 py-4 text-gray-400 text-[10px] hidden md:table-cell">{formatDate(item.created_at, true)}</td>
                      <td className="px-4 md:px-6 py-4 text-right space-x-1 md:space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsEventModalOpen(true); }} className="p-1.5 md:p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={14} className="md:w-4 md:h-4" /></button>
                        <button onClick={() => handleDelete('events', item.id)} className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'gallery' && gallery.filter(p => p.description.toLowerCase().includes(searchTerm.toLowerCase())).map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-400 text-xs">{index + 1}</td>
                      <td className="px-4 md:px-6 py-4">
                        <img src={item.photo_url} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover shadow-sm" referrerPolicy="no-referrer" />
                      </td>
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-700 text-xs md:text-sm truncate max-w-[120px] md:max-w-[200px]">{item.description}</td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {item.tags?.map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold">#{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-[10px] hidden md:table-cell">{formatDate(item.created_at, true)}</td>
                      <td className="px-4 md:px-6 py-4 text-right space-x-1 md:space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsPhotoModalOpen(true); }} className="p-1.5 md:p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={14} className="md:w-4 md:h-4" /></button>
                        <button onClick={() => handleDelete('gallery', item.id)} className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'music' && music.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase())).map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-400 text-xs">{index + 1}</td>
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-700 text-xs md:text-sm">{item.title}</td>
                      <td className="px-6 py-4 text-gray-400 text-[10px] hidden md:table-cell">{formatDate(item.created_at, true)}</td>
                      <td className="px-4 md:px-6 py-4 text-right space-x-1 md:space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsMusicModalOpen(true); }} className="p-1.5 md:p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={14} className="md:w-4 md:h-4" /></button>
                        <button onClick={() => handleDelete('music_playlist', item.id)} className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'stories' && stories.filter(s => s.content.toLowerCase().includes(searchTerm.toLowerCase())).map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-400 text-xs">{index + 1}</td>
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-700 text-xs md:text-sm truncate max-w-[200px] md:max-w-[400px]">{item.content.substring(0, 100)}...</td>
                      <td className="px-6 py-4 text-gray-400 text-[10px] hidden md:table-cell">{formatDate(item.created_at, true)}</td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        <button onClick={() => handleDelete('stories', item.id)} className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} className="md:w-4 md:h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'users' && users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase())).map((user, index) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-400 text-xs">{index + 1}</td>
                      <td className="px-4 md:px-6 py-4 font-bold text-gray-700 text-xs md:text-sm">{user.email}</td>
                      <td className="px-4 md:px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                          className="bg-gray-50 border-none rounded-lg text-[10px] md:text-xs font-black p-1.5 md:p-2 focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="none">None</option>
                          <option value="vip">VIP</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        {user.id !== userId && (
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa tài khoản"
                          >
                            <Trash2 size={14} className="md:w-4 md:h-4" />
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

      {/* Modals - Minimalist Design Integration */}
      <Modal 
        isOpen={isConfigModalOpen} 
        onClose={() => setIsConfigModalOpen(false)} 
        title="Cấu Hình Không Gian"
        progress={loading ? 100 : 0}
      >
        <form onSubmit={handleConfigSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tiêu đề & Phụ đề</label>
            <input type="text" value={configForm.main_title} onChange={e => setConfigForm({...configForm, main_title: e.target.value})} placeholder="Vùng trời của chúng mình" className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" required />
            <input type="text" value={configForm.main_subtitle} onChange={e => setConfigForm({...configForm, main_subtitle: e.target.value})} placeholder="Lời ngỏ ngọt ngào" className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Danh tính</label>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={configForm.name_male} onChange={e => setConfigForm({...configForm, name_male: e.target.value})} placeholder="Tên Anh" className="p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" required />
              <input type="text" value={configForm.name_female} onChange={e => setConfigForm({...configForm, name_female: e.target.value})} placeholder="Tên Em" className="p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ngày lễ & Màu sắc</label>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={configForm.start_date} onChange={e => setConfigForm({...configForm, start_date: e.target.value})} className="p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" required />
              <input type="color" value={configForm.primary_color} onChange={e => setConfigForm({...configForm, primary_color: e.target.value})} className="w-full h-[58px] p-2 bg-white/50 border border-white/20 rounded-2xl outline-none cursor-pointer" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Giao diện (Background)</label>
              {(configForm.background_image_url || configForm.background_video_url) && (
                <button 
                  type="button"
                  onClick={() => setConfigForm({...configForm, background_image_url: '', background_video_url: ''})}
                  className="text-[9px] font-black text-rose-500 uppercase tracking-tighter hover:underline"
                >
                  Xóa nền cũ
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="relative group">
                <input type="file" onChange={e => setBgImageFile(e.target.files?.[0] || null)} className="hidden" id="bg-image-upload" />
                <label htmlFor="bg-image-upload" className="flex items-center gap-3 p-4 bg-white/30 border border-dashed border-white/50 rounded-2xl cursor-pointer hover:bg-white/50 transition-all">
                  <ImageIcon size={18} className="text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                    {bgImageFile ? bgImageFile.name : "Tải lên ảnh nền"}
                  </span>
                </label>
              </div>
              <div className="relative group">
                <input type="file" accept="video/*" onChange={e => setBgVideoFile(e.target.files?.[0] || null)} className="hidden" id="bg-video-upload" />
                <label htmlFor="bg-video-upload" className="flex items-center gap-3 p-4 bg-white/30 border border-dashed border-white/50 rounded-2xl cursor-pointer hover:bg-white/50 transition-all">
                  <Volume2 size={18} className="text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                    {bgVideoFile ? bgVideoFile.name : "Tải lên video nền"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg hover:bg-primary transition-all duration-300 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "LƯU CẤU HÌNH"}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)} 
        title={editingItem ? "Biên Tập Kỷ Niệm" : "Khởi Tạo Kỷ Niệm"}
        progress={loading ? 100 : 0}
      >
        <form onSubmit={handleEventSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tiêu đề</label>
            <input type="text" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="Tựa đề khoảnh khắc" className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ngày tháng</label>
            <input type="date" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cảm xúc</label>
            <textarea value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} placeholder="Mô tả sự kiện này..." className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all h-32 font-medium text-gray-800 resize-none" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Địa điểm</label>
            <LocationPicker 
              value={eventForm.location}
              onChange={(loc) => setEventForm({...eventForm, location: loc})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hình ảnh</label>
            <input type="file" onChange={e => setEventForm({...eventForm, photoFile: e.target.files?.[0] || null})} className="hidden" id="event-file" />
            <label htmlFor="event-file" className="flex items-center gap-3 p-4 bg-white/30 border border-dashed border-white/50 rounded-2xl cursor-pointer hover:bg-white/50 transition-all">
              <Camera size={18} className="text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                {eventForm.photoFile ? eventForm.photoFile.name : (editingItem ? "Thay đổi ảnh" : "Tải lên ảnh")}
              </span>
            </label>
          </div>
          <button type="submit" disabled={loading} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg hover:bg-primary transition-all duration-300">
            {loading ? "ĐANG XỬ LÝ..." : (editingItem ? "CẬP NHẬT" : "THÊM MỚI")}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isPhotoModalOpen} 
        onClose={() => setIsPhotoModalOpen(false)} 
        title={editingItem ? "Sửa Ảnh Phim" : "Gửi Gắm Hình Ảnh"}
        progress={loading ? 100 : 0}
      >
        <form onSubmit={handlePhotoSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mô tả & Tags</label>
            <textarea value={photoForm.description} onChange={e => setPhotoForm({...photoForm, description: e.target.value})} placeholder="Đôi lời về tấm hình này..." className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all h-24 font-medium text-gray-800 resize-none" required />
            <input type="text" value={photoForm.tags} onChange={e => setPhotoForm({...photoForm, tags: e.target.value})} placeholder="Tags (yêu, kỷ niệm, du lịch...)" className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tệp ảnh</label>
            <input type="file" onChange={e => setPhotoForm({...photoForm, photoFile: e.target.files?.[0] || null})} className="hidden" id="gallery-file" />
            <label htmlFor="gallery-file" className="flex items-center gap-3 p-4 bg-white/30 border border-dashed border-white/50 rounded-2xl cursor-pointer hover:bg-white/50 transition-all">
              <ImageIcon size={18} className="text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                {photoForm.photoFile ? photoForm.photoFile.name : (editingItem ? "Thay đổi ảnh" : "Chọn ảnh")}
              </span>
            </label>
          </div>
          <button type="submit" disabled={loading} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg hover:bg-primary transition-all duration-300">
            {loading ? "ĐANG TẢI..." : (editingItem ? "CẬP NHẬT" : "THÊM MỚI")}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isMusicModalOpen} 
        onClose={() => setIsMusicModalOpen(false)} 
        title={editingItem ? "Đổi Giai Điệu" : "Thêm Giai Điệu Mới"}
        progress={loading ? 100 : 0}
      >
        <form onSubmit={handleMusicSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tên bài hát</label>
            <input type="text" value={musicForm.title} onChange={e => setMusicForm({...musicForm, title: e.target.value})} placeholder="Tựa đề bản nhạc" className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tệp âm thanh</label>
            <input type="file" onChange={e => setMusicForm({...musicForm, musicFile: e.target.files?.[0] || null})} className="hidden" id="music-file" />
            <label htmlFor="music-file" className="flex items-center gap-3 p-4 bg-white/30 border border-dashed border-white/50 rounded-2xl cursor-pointer hover:bg-white/50 transition-all">
              <Music size={18} className="text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                {musicForm.musicFile ? musicForm.musicFile.name : "Chọn tệp MP3"}
              </span>
            </label>
          </div>
          <button type="submit" disabled={loading} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg hover:bg-primary transition-all duration-300">
            {loading ? "ĐANG TẢI..." : "LƯU GIAI ĐIỆU"}
          </button>
        </form>
      </Modal>
    </div>
  );
};
