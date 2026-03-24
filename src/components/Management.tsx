import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole, AppConfig } from '../types';
import { 
  Plus, Edit, Trash2, Search, Save, Calendar, 
  Music, Image as ImageIcon, History, Users, ShieldCheck, Settings
} from 'lucide-react';
import { showNotification } from '../lib/notifications';
import { Modal } from './Modal';
import { cn, formatDate } from '../lib/utils';
import { useMusic } from '../lib/MusicContext';
import { Play, Pause, SkipBack, SkipForward, Repeat } from 'lucide-react';

const MusicManagementPlayer: React.FC = () => {
  const { currentTrack, isPlaying, isRepeat, togglePlay, playNext, playPrev, toggleRepeat } = useMusic();

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border">
      <p className="text-sm font-bold truncate w-full text-center">{currentTrack?.title || "Không có nhạc"}</p>
      <div className="flex items-center gap-4">
        <button onClick={playPrev}><SkipBack size={20} /></button>
        <button onClick={togglePlay} className="w-12 h-12 flex items-center justify-center rounded-full bg-primary text-white">
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button onClick={playNext}><SkipForward size={20} /></button>
        <button onClick={toggleRepeat} className={isRepeat ? "text-primary" : "text-gray-400"}><Repeat size={20} /></button>
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
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'events' | 'gallery' | 'music' | 'users'>('config');
  
  // Core Logic helpers
  const HAS_VIP_ACCESS = () => userRole === 'vip' || userRole === 'admin';
  const HAS_ADMIN_ACCESS = () => userRole === 'admin';
  const [events, setEvents] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [music, setMusic] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
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
    if (activeSubTab === 'events') {
      const { data } = await supabase.from('events').select('*').order('date', { ascending: false }) as any;
      if (data) setEvents(data);
    } else if (activeSubTab === 'gallery') {
      const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false }) as any;
      if (data) setGallery(data);
    } else if (activeSubTab === 'music') {
      const { data } = await supabase.from('music_playlist').select('*').order('created_at', { ascending: true }) as any;
      if (data) setMusic(data);
    } else if (activeSubTab === 'users' && userRole === 'admin') {
      try {
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
      } catch (error: any) {
        console.error("Lỗi khi tải danh sách người dùng:", error);
        showNotification("Không thể tải danh sách người dùng!", true);
      }
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
                        <th className="px-6 py-4">Sự kiện</th>
                        <th className="px-6 py-4">Ngày</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'gallery' && (
                      <>
                        <th className="px-6 py-4">Mô tả</th>
                        <th className="px-6 py-4">Tags</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'music' && (
                      <>
                        <th className="px-6 py-4">Tên bài hát</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                    {activeSubTab === 'users' && (
                      <>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Quyền hạn</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeSubTab === 'events' && events.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-700">{item.title}</td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(item.date)}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsEventModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete('events', item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'gallery' && gallery.filter(p => p.description.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-700">{item.description}</td>
                      <td className="px-6 py-4 text-gray-500">{item.tags?.join(', ')}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsPhotoModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete('gallery', item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'music' && music.filter(m => m.title.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-700">{item.title}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => { setEditingItem(item); setIsMusicModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                        <button onClick={() => handleDelete('music_playlist', item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {activeSubTab === 'users' && users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase())).map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
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
