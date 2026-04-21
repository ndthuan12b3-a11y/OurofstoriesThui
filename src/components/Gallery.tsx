import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  Settings, X, Tag, Calendar, Info, Lock, Plus, Camera, 
  Upload, Image as ImageIcon, Sparkles, RefreshCw, ChevronDown,
  ChevronLeft, ChevronRight, Download, Search, Filter
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, cn } from '../lib/utils';
import { getOptimizedImageUrl, getThumbnailUrl } from '../lib/imageUtils';
import { AppConfig } from '../types';
import { GallerySkeleton } from './Skeleton';
import { Modal } from './Modal';
import { showNotification } from '../lib/notifications';

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

// Photo Item Component for memoization
const PhotoItem = React.memo(({ photo, onClick }: { photo: Photo; onClick: (p: Photo) => void }) => (
  <motion.div
    layoutId={photo.id}
    onClick={() => onClick(photo)}
    className="group relative aspect-square bg-white rounded-2xl overflow-hidden soft-shadow cursor-pointer hover:-translate-y-1 transition-transform"
  >
    <img
      src={getThumbnailUrl(photo.photo_url)}
      alt={photo.description}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
      <p className="text-white text-xs font-bold truncate">{photo.description}</p>
    </div>
  </motion.div>
));

export const Gallery: React.FC<GalleryProps> = ({ config, userRole }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState('all');
  const [showTags, setShowTags] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [randomPhoto, setRandomPhoto] = useState<Photo | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ description: '', tags: '', photoFile: null as File | null });
  const [uploading, setUploading] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

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

  const generateAICaption = async () => {
    if (!uploadForm.photoFile) {
      showNotification("Vui lòng chọn ảnh trước!", true);
      return;
    }

    setIsGeneratingCaption(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        showNotification("Vui lòng thiết lập GEMINI_API_KEY trong phần Secrets!", true);
        setIsGeneratingCaption(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(uploadForm.photoFile!);
      });

      const base64Data = await base64Promise;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: uploadForm.photoFile.type
              }
            },
            {
              text: "Hãy viết một câu caption (chú thích) thật hay, lãng mạn hoặc hài hước cho bức ảnh này của một cặp đôi. Chỉ trả về nội dung caption, không thêm bất kỳ lời dẫn nào khác. Ngôn ngữ: Tiếng Việt."
            }
          ]
        },
      });

      const caption = response.text?.trim() || "";
      setUploadForm(prev => ({ ...prev, description: caption }));
      showNotification("Đã tạo caption bằng AI!");
    } catch (error) {
      console.error("AI Caption Error:", error);
      showNotification("Lỗi khi tạo caption bằng AI!", true);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
            onClick={(e) => {
              e.stopPropagation();
              setIsUploadModalOpen(true);
            }}
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
                src={getOptimizedImageUrl(randomPhoto.photo_url, 1200)}
                alt="Random"
                loading="eager"
                referrerPolicy="no-referrer"
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
      <div className="flex flex-col items-center gap-4 mb-8">
        <button
          onClick={() => setShowTags(!showTags)}
          className="px-6 py-2 rounded-full text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:border-primary/50 transition-all flex items-center gap-2"
        >
          {showTags ? 'Ẩn bộ lọc' : 'Lọc theo thẻ'}
          <motion.div animate={{ rotate: showTags ? 180 : 0 }}>
            <ChevronDown size={16} />
          </motion.div>
        </button>

        <AnimatePresence>
          {showTags && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => setActiveTag('all')}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                    activeTag === 'all' 
                      ? "bg-primary text-white border-primary soft-shadow" 
                      : "bg-white text-gray-500 border-gray-100 hover:border-primary/30 hover:text-primary"
                  )}
                >
                  Tất cả
                </button>
                {tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                      activeTag === tag 
                        ? "bg-primary text-white border-primary soft-shadow" 
                        : "bg-white text-gray-500 border-gray-100 hover:border-primary/30 hover:text-primary"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 min-h-[400px]">
        {loading ? (
          <GallerySkeleton />
        ) : currentPhotos.length > 0 ? (
          currentPhotos.map(photo => (
            <PhotoItem key={photo.id} photo={photo} onClick={setSelectedPhoto} />
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
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedPhoto && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPhoto(null)}
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              />
              
              {/* Navigation Buttons */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-30">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = photos.findIndex(p => p.id === selectedPhoto.id);
                    if (idx > 0) setSelectedPhoto(photos[idx - 1]);
                  }}
                  className={cn(
                    "w-12 h-12 rounded-full bg-white/20 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md pointer-events-auto transition-all shadow-xl border border-white/30",
                    photos.findIndex(p => p.id === selectedPhoto.id) === 0 && "opacity-0 pointer-events-none"
                  )}
                >
                  <ChevronLeft size={28} strokeWidth={3} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = photos.findIndex(p => p.id === selectedPhoto.id);
                    if (idx < photos.length - 1) setSelectedPhoto(photos[idx + 1]);
                  }}
                  className={cn(
                    "w-12 h-12 rounded-full bg-white/20 hover:bg-primary text-white flex items-center justify-center backdrop-blur-md pointer-events-auto transition-all shadow-xl border border-white/30",
                    photos.findIndex(p => p.id === selectedPhoto.id) === photos.length - 1 && "opacity-0 pointer-events-none"
                  )}
                >
                  <ChevronRight size={28} strokeWidth={3} />
                </button>
              </div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-6xl w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl z-10"
              >
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute top-6 right-6 z-20 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
                >
                  <X size={24} />
                </button>
                
                <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
                  <div className="flex-grow lg:w-3/4 bg-black flex items-center justify-center relative group min-h-[50vh] lg:min-h-0">
                    <motion.img
                      key={selectedPhoto.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={getOptimizedImageUrl(selectedPhoto.photo_url, 1600)}
                      alt={selectedPhoto.description}
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full object-contain"
                    />
                    
                    {/* Floating Mobile Nav Overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-4 flex justify-between items-center bg-gradient-to-t from-black/60 to-transparent lg:hidden">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = photos.findIndex(p => p.id === selectedPhoto.id);
                          if (idx > 0) setSelectedPhoto(photos[idx - 1]);
                        }}
                        disabled={photos.findIndex(p => p.id === selectedPhoto.id) === 0}
                        className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md disabled:opacity-20"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = photos.findIndex(p => p.id === selectedPhoto.id);
                          if (idx < photos.length - 1) setSelectedPhoto(photos[idx + 1]);
                        }}
                        disabled={photos.findIndex(p => p.id === selectedPhoto.id) === photos.length - 1}
                        className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md disabled:opacity-20"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>

                    <a 
                      href={selectedPhoto.photo_url} 
                      download 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-6 left-6 p-3 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md lg:opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download size={20} />
                    </a>
                  </div>
                  <div className="lg:w-1/4 p-6 lg:p-8 flex flex-col bg-gray-50/50 overflow-y-auto shrink-0">
                    <div>
                      <div className="flex items-center gap-2 text-primary mb-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Info size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Chi tiết ảnh</span>
                      </div>
                      <h2 className="text-xl lg:text-2xl font-black text-gray-800 leading-tight mb-4">{selectedPhoto.description}</h2>
                      
                      {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                          {selectedPhoto.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-white border border-gray-100 text-gray-500 text-[10px] font-black rounded-full shadow-sm">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="lg:mt-auto pt-6 lg:pt-8 border-t border-gray-100 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-gray-50">
                          <Calendar size={20} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Ngày lưu giữ</p>
                          <p className="text-sm font-bold text-gray-700">{formatDate(selectedPhoto.created_at)}</p>
                        </div>
                      </div>
                      
                      <div className="hidden lg:grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => {
                            const idx = photos.findIndex(p => p.id === selectedPhoto.id);
                            if (idx > 0) setSelectedPhoto(photos[idx - 1]);
                          }}
                          disabled={photos.findIndex(p => p.id === selectedPhoto.id) === 0}
                          className="py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Ảnh trước
                        </button>
                        <button 
                          onClick={() => {
                            const idx = photos.findIndex(p => p.id === selectedPhoto.id);
                            if (idx < photos.length - 1) setSelectedPhoto(photos[idx + 1]);
                          }}
                          disabled={photos.findIndex(p => p.id === selectedPhoto.id) === photos.length - 1}
                          className="py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/80 transition-colors soft-shadow disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Ảnh tiếp
                        </button>
                      </div>
                      
                      <button 
                        onClick={() => setSelectedPhoto(null)}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-primary transition-colors soft-shadow"
                      >
                        Đóng lại
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Thêm Ảnh Vào Bộ Sưu Tập"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
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
                className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all overflow-hidden relative"
              >
                {uploadForm.photoFile ? (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100">
                      <img 
                        src={URL.createObjectURL(uploadForm.photoFile)} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white font-bold flex items-center gap-2">
                          <RefreshCw size={16} /> Đổi ảnh khác
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-primary font-bold w-full justify-center">
                      <ImageIcon size={16} className="shrink-0" />
                      <span className="truncate max-w-[200px] text-sm">{uploadForm.photoFile.name}</span>
                    </div>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Mô tả ảnh</label>
              <button
                type="button"
                onClick={generateAICaption}
                disabled={isGeneratingCaption || !uploadForm.photoFile}
                className="text-xs font-black text-primary flex items-center gap-1 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {isGeneratingCaption ? (
                  <RefreshCw className="animate-spin" size={12} />
                ) : (
                  <Sparkles size={12} />
                )}
                AI Gợi ý Caption
              </button>
            </div>
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
          <button
            type="submit"
            disabled={uploading || !uploadForm.photoFile}
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

// End of file
