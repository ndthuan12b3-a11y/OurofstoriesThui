import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { AppConfig } from '../types';

interface GalleryProps {
  config: AppConfig;
  userRole: string;
}

interface Photo {
  id: string;
  description: string;
  photo_url: string;
  tags: string[];
  created_at: string;
}

export const Gallery: React.FC<GalleryProps> = ({ config, userRole }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [randomPhoto, setRandomPhoto] = useState<Photo | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ description: '', tags: '', photoFile: null as File | null });
  const [uploading, setUploading] = useState(false);

  const PHOTOS_PER_PAGE = 20;

  useEffect(() => {
    const fetchPhotos = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('gallery')
        .select('*')
        .order('created_at', { ascending: false }) as any;
      
      if (data) {
        setPhotos(data);
        const allTags = new Set<string>();
        data.forEach((p: any) => p.tags?.forEach((t: string) => allTags.add(t)));
        setTags(Array.from(allTags));
      }
      setLoading(false);
    };

    fetchPhotos();

    const channel = supabase
      .channel('gallery-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery' }, fetchPhotos)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (activeTag === 'all') {
      setFilteredPhotos(photos);
    } else {
      setFilteredPhotos(photos.filter(p => p.tags?.includes(activeTag)));
    }
    setCurrentPage(1);
  }, [activeTag, photos]);

  useEffect(() => {
    if (photos.length > 0) {
      const interval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * photos.length);
        setRandomPhoto(photos[randomIndex]);
      }, 8000);
      setRandomPhoto(photos[Math.floor(Math.random() * photos.length)]);
      return () => clearInterval(interval);
    }
  }, [photos]);

  const totalPages = Math.ceil(filteredPhotos.length / PHOTOS_PER_PAGE);
  const currentPhotos = filteredPhotos.slice(
    (currentPage - 1) * PHOTOS_PER_PAGE,
    currentPage * PHOTOS_PER_PAGE
  );

  const HAS_VIP_ACCESS = () => userRole === 'vip' || userRole === 'admin';

  const handleFileUpload = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user.id}/gallery/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('love-photos')
      .upload(filePath, file);
      
    if (uploadError) {
      showNotification("Lỗi tải ảnh lên!", true);
      return null;
    }
    
    const { data } = supabase.storage.from('love-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!HAS_VIP_ACCESS()) return;
    if (!uploadForm.photoFile) return showNotification("Vui lòng chọn ảnh!", true);

    setUploading(true);
    try {
      const photoUrl = await handleFileUpload(uploadForm.photoFile);
      if (!photoUrl) throw new Error("Upload failed");

      const { error } = await supabase.from('gallery').insert([{
        description: uploadForm.description,
        tags: uploadForm.tags.split(',').map(t => t.trim()).filter(t => t),
        photo_url: photoUrl,
        user_id: '6857068c-7cc5-45ce-8099-23f0e3264251' // PRIMARY_CONFIG_ID
      }]);

      if (error) throw error;

      showNotification("Đã thêm ảnh mới!");
      setIsUploadModalOpen(false);
      setUploadForm({ description: '', tags: '', photoFile: null });
    } catch (error) {
      showNotification("Lỗi khi lưu ảnh!", true);
    } finally {
      setUploading(false);
    }
  };

  if (!HAS_VIP_ACCESS()) {
    return (
      <div id="no-access-warning-gallery" className="text-center p-20 bg-white rounded-3xl soft-shadow border-2 border-dashed border-gray-100 animate-fadeIn">
        <div className="w-24 h-24 bg-red-50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-8">
          <Lock size={48} />
        </div>
        <h3 className="text-3xl font-black text-gray-800 mb-4">Bộ Sưu Tập Đã Khóa</h3>
        <p className="text-gray-500 max-w-md mx-auto leading-relaxed text-lg mb-6">
          Bạn cần quyền <strong>VIP</strong> hoặc <strong>Admin</strong> để truy cập vào kho ảnh kỷ niệm này.
        </p>
        <a 
          href="https://zalo.me/84866264751" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-3 bg-blue-500 text-white rounded-full font-bold hover:bg-blue-600 transition-all transform hover:scale-105 shadow-lg"
        >
          Liên hệ cấp quyền qua Zalo
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="text-center mb-12 relative">
        <h1 className="text-4xl md:text-5xl font-black text-gray-800 mb-4">{config.main_title}</h1>
        <p className="text-lg text-gray-500">{config.main_subtitle}</p>
        
        {HAS_VIP_ACCESS() && (
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold soft-shadow hover:scale-105 transition-transform"
          >
            <Plus size={20} />
            Thêm Ảnh Mới
          </button>
        )}
      </div>

      {/* Slideshow */}
      <div className="max-w-2xl mx-auto mb-12 bg-white rounded-2xl overflow-hidden soft-shadow">
        <AnimatePresence mode="wait">
          {randomPhoto ? (
            <motion.div
              key={randomPhoto.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="relative aspect-video"
            >
              <img
                src={randomPhoto.photo_url}
                alt="Random"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent text-white">
                <p className="text-sm font-medium">{randomPhoto.description}</p>
              </div>
            </motion.div>
          ) : (
            <div className="aspect-video bg-gray-100 flex items-center justify-center">
              <p className="text-gray-400">Đang tải ảnh...</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        <button
          onClick={() => setActiveTag('all')}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-bold transition-all",
            activeTag === 'all' 
              ? "bg-primary text-white soft-shadow" 
              : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          Tất cả
        </button>
        {tags.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTag === tag 
                ? "bg-primary text-white soft-shadow" 
                : "bg-white text-gray-500 hover:bg-gray-50"
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl skeleton" />
          ))
        ) : currentPhotos.length > 0 ? (
          currentPhotos.map(photo => (
            <motion.div
              key={photo.id}
              layoutId={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative aspect-square bg-white rounded-2xl overflow-hidden soft-shadow cursor-pointer hover:-translate-y-1 transition-transform"
            >
              <img
                src={photo.photo_url}
                alt={photo.description}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <p className="text-white text-xs font-bold truncate">{photo.description}</p>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-gray-400">Chưa có ảnh nào!</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-12">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={cn(
                "w-10 h-10 rounded-xl font-bold transition-all",
                currentPage === i + 1
                  ? "bg-primary text-white soft-shadow"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPhoto(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              layoutId={selectedPhoto.id}
              className="relative max-w-5xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl"
            >
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md transition-colors"
              >
                <X size={24} />
              </button>
              <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
                <div className="md:w-2/3 bg-black flex items-center justify-center">
                  <img
                    src={selectedPhoto.photo_url}
                    alt={selectedPhoto.description}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="md:w-1/3 p-8 flex flex-col bg-gray-50/50">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <Info size={18} />
                      <span className="text-xs font-black uppercase tracking-wider">Mô tả</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 leading-tight">{selectedPhoto.description}</h2>
                  </div>

                  {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 text-gray-400 mb-3">
                        <Tag size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Gắn thẻ</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedPhoto.tags.map(tag => (
                          <span key={tag} className="px-3 py-1.5 bg-white border border-gray-100 text-gray-600 text-xs font-bold rounded-xl shadow-sm hover:border-primary/30 transition-colors">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-3 text-gray-400">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-50">
                        <Calendar size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Ngày đăng</p>
                        <p className="text-sm font-bold text-gray-600">
                          {formatDate(selectedPhoto.created_at, true)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Thêm Ảnh Vào Bộ Sưu Tập"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600">Mô tả ảnh</label>
            <textarea
              value={uploadForm.description}
              onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="Ghi chú cho bức ảnh này..."
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 h-24"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600">Gắn thẻ (Tags)</label>
            <input
              type="text"
              value={uploadForm.tags}
              onChange={e => setUploadForm({ ...uploadForm, tags: e.target.value })}
              placeholder="kỷ niệm, du lịch, ..."
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600">Chọn ảnh</label>
            <div className="relative group">
              <input
                type="file"
                accept="image/*"
                onChange={e => setUploadForm({ ...uploadForm, photoFile: e.target.files?.[0] || null })}
                className="hidden"
                id="gallery-upload"
              />
              <label
                htmlFor="gallery-upload"
                className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                {uploadForm.photoFile ? (
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <ImageIcon size={24} />
                    <span>{uploadForm.photoFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Camera size={32} className="text-gray-400 mb-2" />
                    <span className="text-gray-500 font-medium">Nhấn để chọn ảnh</span>
                  </>
                )}
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-4 btn-primary-gradient rounded-2xl font-bold soft-shadow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload size={20} />
            )}
            {uploading ? "Đang tải lên..." : "Tải Lên Ngay"}
          </button>
        </form>
      </Modal>
    </div>
  );
};

import { Settings, X, Tag, Calendar, Info, Lock, Plus, Camera, Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Modal } from './Modal';
import { showNotification } from '../lib/notifications';
