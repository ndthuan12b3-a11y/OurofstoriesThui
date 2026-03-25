import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../lib/supabase';
import { formatDate, calculateDays, cn } from '../lib/utils';
import { AppConfig } from '../types';
import { Heart, Lock, Sparkles, Calendar, Camera, MapPin, X, Info, Plus, Upload, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import { showNotification } from '../lib/notifications';
import { JourneyStoryteller } from './JourneyStoryteller';
import { LoveMoodTracker } from './LoveMoodTracker';

interface TimelineProps {
  config: AppConfig;
  userRole: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  photo_url: string;
  created_at: string;
}

// Event Item Component for memoization
const EventItem = React.memo(({ event, index, onClick }: { event: Event; index: number; onClick: (e: Event) => void }) => (
  <motion.div
    key={event.id}
    initial={{ opacity: 0, x: -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ delay: Math.min(index * 0.05, 0.3) }}
    className="relative ml-16 group"
  >
    {/* Timeline Dot */}
    <div className="absolute -left-12 top-6 w-4 h-4 bg-white border-4 border-rose-300 rounded-full shadow-md z-10 group-hover:scale-125 transition-transform" />
    
    {/* Date Badge */}
    <div className="absolute -left-[4.5rem] top-12 text-[10px] font-black text-rose-300 uppercase tracking-tighter rotate-90 origin-left whitespace-nowrap">
      {formatDate(event.date)}
    </div>

    {/* Compact Card */}
    <div 
      className="bg-white rounded-3xl p-4 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-50 flex flex-col sm:flex-row gap-4 group-hover:-translate-y-1 cursor-pointer"
      onClick={() => onClick(event)}
    >
      {/* Small Image */}
      <div className="w-full sm:w-32 h-32 rounded-2xl overflow-hidden shrink-0 shadow-inner bg-gray-50">
        <img
          src={event.photo_url}
          alt={event.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>

      {/* Content */}
      <div className="flex-grow flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-yellow-400" />
          <h3 className="text-lg font-black text-gray-800 leading-tight">{event.title}</h3>
        </div>
        <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-2">
          {event.description}
        </p>
        <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(event.date)}</span>
          <span className="flex items-center gap-1 text-rose-300"><Heart size={10} fill="currentColor" /> Kỷ niệm</span>
        </div>
      </div>
    </div>
  </motion.div>
));

export const Timeline: React.FC<TimelineProps> = ({ config, userRole }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', date: '', description: '', photoFile: null as File | null });
  const [uploading, setUploading] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  const generateAICaption = async () => {
    if (!uploadForm.photoFile) {
      showNotification("Vui lòng chọn ảnh trước!", true);
      return;
    }

    setIsGeneratingCaption(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        showNotification("Vui lòng thiết lập GEMINI_API_KEY!", true);
        setIsGeneratingCaption(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
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
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: uploadForm.photoFile.type
            }
          },
          {
            text: "Hãy viết một câu mô tả (title) ngắn gọn và một đoạn cảm xúc (description) thật hay, lãng mạn cho bức ảnh này của một cặp đôi. Định dạng trả về: [Title]: ... [Description]: ... Ngôn ngữ: Tiếng Việt."
          }
        ],
      });

      const text = response.text?.trim() || "";
      const titleMatch = text.match(/\[Title\]:\s*(.*)/i);
      const descMatch = text.match(/\[Description\]:\s*([\s\S]*)/i);
      
      setUploadForm(prev => ({ 
        ...prev, 
        title: titleMatch ? titleMatch[1].trim() : prev.title,
        description: descMatch ? descMatch[1].trim() : prev.description
      }));
      showNotification("Đã tạo mô tả và cảm xúc bằng AI!");
    } catch (error) {
      console.error("AI Caption Error:", error);
      showNotification("Lỗi khi tạo mô tả bằng AI!", true);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);
      if (data) setEvents(data);
      setLoading(false);
    };

    fetchEvents();

    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchEvents)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const HAS_VIEW_ACCESS = () => userRole === 'vip' || userRole === 'admin';

  const handleFileUpload = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user.id}/events/${fileName}`;
    
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
    if (!HAS_VIEW_ACCESS()) return;
    if (!uploadForm.photoFile) return showNotification("Vui lòng chọn ảnh!", true);

    setUploading(true);
    try {
      const photoUrl = await handleFileUpload(uploadForm.photoFile);
      if (!photoUrl) throw new Error("Upload failed");

      const { error } = await supabase.from('events').insert([{
        title: uploadForm.title,
        date: uploadForm.date,
        description: uploadForm.description,
        photo_url: photoUrl,
        user_id: '6857068c-7cc5-45ce-8099-23f0e3264251' // PRIMARY_CONFIG_ID
      }]);

      if (error) throw error;

      showNotification("Đã thêm kỷ niệm mới!");
      setIsUploadModalOpen(false);
      setUploadForm({ title: '', date: '', description: '', photoFile: null });
    } catch (error) {
      showNotification("Lỗi khi lưu kỷ niệm!", true);
    } finally {
      setUploading(false);
    }
  };

  if (!HAS_VIEW_ACCESS()) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 animate-fadeIn">
        <div className="text-center bg-white/80 backdrop-blur-md p-10 rounded-[2.5rem] shadow-xl border border-white/50">
          <div className="relative inline-block mb-6">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <Lock size={40} />
            </div>
            <motion.div 
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -top-2 -right-2 text-yellow-400"
            >
              <Sparkles size={24} fill="currentColor" />
            </motion.div>
          </div>
          <h3 className="text-2xl font-black text-gray-800 mb-4">Kỷ Niệm Đang Chờ...</h3>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Nội dung này cực kỳ ngọt ngào và chỉ dành cho những người bạn đặc biệt (VIP/Admin).
          </p>
          <a 
            href="https://zalo.me/84866264751" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-400 to-blue-500 text-white rounded-2xl font-bold hover:shadow-lg transition-all transform hover:scale-105"
          >
            Nhắn tin cấp quyền nhé!
          </a>
        </div>
      </div>
    );
  }

  const days = calculateDays(config.start_date);

  return (
    <div className="max-w-3xl mx-auto px-4 pb-20 animate-fadeIn">
      {/* Compact Cute Header */}
      <div className="flex flex-col items-center mb-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-6"
        >
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl rotate-3 hover:rotate-0 transition-transform duration-500">
            <img
              src={config.avatar_url || "https://placehold.co/200x200/fcc4d6/333?text=Love"}
              alt="Couple"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <motion.div 
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -bottom-3 -right-3 w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center text-rose-400"
          >
            <Heart size={24} fill="currentColor" />
          </motion.div>
        </motion.div>
        
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-black text-gray-800 tracking-tight mb-2">
            {config.name_male} <span className="text-rose-300">❤</span> {config.name_female}
          </h1>
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-50 text-rose-400 rounded-full text-sm font-bold border border-rose-100">
              <Calendar size={14} />
              <span> {formatDate(config.start_date)}</span>
            </div>
            
            {HAS_VIEW_ACCESS() && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-2 bg-white text-rose-400 border-2 border-rose-100 rounded-2xl font-bold soft-shadow hover:bg-rose-50 transition-all transform hover:scale-105"
              >
                <Plus size={18} />
                Thêm Kỷ Niệm
              </button>
            )}
          </div>
        </div>
      </div>

      {HAS_VIEW_ACCESS() && (
        <div className="space-y-8 mb-12">
          <LoveMoodTracker userRole={userRole} />
          <JourneyStoryteller config={config} userRole={userRole} />
        </div>
      )}

      {/* Cute Day Counter Widget */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white p-6 rounded-[2rem] shadow-lg border border-rose-50 mb-16 flex items-center justify-between overflow-hidden relative"
      >
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500">
            <Sparkles size={32} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ngày hạnh phúc</p>
            <h2 className="text-3xl font-black text-gray-800">{days} <span className="text-lg font-bold text-rose-300">ngày</span></h2>
          </div>
        </div>
        <div className="hidden sm:block relative z-10">
          <div className="text-right">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái</p>
            <p className="text-rose-400 font-black italic">Đang yêu say đắm ✨</p>
          </div>
        </div>
        {/* Decorative blobs */}
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-50 rounded-full -z-0" />
        <div className="absolute left-1/4 -top-8 w-16 h-16 bg-blue-50 rounded-full -z-0" />
      </motion.div>

      {/* Compact Timeline */}
      <div className="relative space-y-8 min-h-[300px]">
        {/* Decorative Line */}
        <div className="absolute left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-100 via-blue-100 to-transparent rounded-full" />

        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ml-16 h-32 rounded-3xl skeleton animate-pulse bg-gray-100" />
            ))
          ) : events.length > 0 ? (
            events.map((event, index) => (
              <EventItem key={event.id} event={event} index={index} onClick={setSelectedEvent} />
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[2rem] shadow-inner border-2 border-dashed border-rose-50">
              <p className="text-gray-400 font-bold">Hãy bắt đầu viết nên câu chuyện của chúng mình... ✨</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Sweet Footer */}
      <div className="mt-20 text-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="inline-block p-4 bg-rose-50 rounded-full text-rose-400 mb-4"
        >
          <Heart size={24} fill="currentColor" />
        </motion.div>
        <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">To be continued...</p>
      </div>

      {/* Event Detail Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Chi Tiết Kỷ Niệm"
        className="max-w-2xl p-0 overflow-hidden"
      >
        {selectedEvent && (
          <div className="flex flex-col">
            <div className="aspect-video w-full overflow-hidden bg-gray-100 relative group">
              <img 
                src={selectedEvent.photo_url} 
                alt={selectedEvent.title}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-400 shadow-sm">
                    <Heart size={24} fill="currentColor" />
                  </div>
                  <h3 className="text-3xl font-black text-gray-800 tracking-tight">{selectedEvent.title}</h3>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-500 text-xs font-bold rounded-xl border border-gray-100">
                  <Calendar size={14} />
                  <span>{formatDate(selectedEvent.date)}</span>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-rose-100 rounded-full" />
                <p className="text-gray-600 leading-relaxed text-lg pl-4 italic">
                  "{selectedEvent.description}"
                </p>
              </div>

              <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
                  <Sparkles size={14} className="text-yellow-400" />
                  <span>Khoảnh khắc đáng nhớ</span>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="text-primary font-bold text-sm hover:underline"
                >
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Viết Tiếp Câu Chuyện Tình Yêu"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Tiêu đề kỷ niệm</label>
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
                AI Gợi ý
              </button>
            </div>
            <input
              type="text"
              value={uploadForm.title}
              onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
              placeholder="Ví dụ: Lần đầu gặp gỡ..."
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600">Ngày diễn ra</label>
            <input
              type="date"
              value={uploadForm.date}
              onChange={e => setUploadForm({ ...uploadForm, date: e.target.value })}
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600">Cảm xúc / Mô tả</label>
            <textarea
              value={uploadForm.description}
              onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="Kể lại khoảnh khắc ấy..."
              className="w-full p-4 bg-gray-50 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 h-32"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600">Ảnh kỷ niệm</label>
            <div className="relative group">
              <input
                type="file"
                accept="image/*"
                onChange={e => setUploadForm({ ...uploadForm, photoFile: e.target.files?.[0] || null })}
                className="hidden"
                id="event-upload"
              />
              <label
                htmlFor="event-upload"
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
                    <span className="text-gray-500 font-medium">Chọn một bức ảnh thật đẹp</span>
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
              <Heart size={20} fill="currentColor" />
            )}
            {uploading ? "Đang lưu giữ..." : "Lưu Kỷ Niệm"}
          </button>
        </form>
      </Modal>
    </div>
  );
};

