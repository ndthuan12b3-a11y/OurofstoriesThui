import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { formatDate, calculateDays, cn } from '../lib/utils';
import { getOptimizedImageUrl } from '../lib/imageUtils';
import { AppConfig } from '../types';
import { 
  Heart, Lock, Sparkles, Calendar, Camera, MapPin, X, Info, Plus, 
  Upload, Image as ImageIcon, RefreshCw, ChevronRight, ChevronLeft, 
  BookOpen, Download 
} from 'lucide-react';
import { TimelineSkeleton } from './Skeleton';
import { Modal } from './Modal';
import { showNotification } from '../lib/notifications';
import { JourneyStoryteller } from './JourneyStoryteller';

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
          src={getOptimizedImageUrl(event.photo_url, 400)}
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
  const [uploadForm, setUploadForm] = useState({ 
    title: '', 
    date: '', 
    description: '', 
    photoFile: null as File | null 
  });
  const [uploading, setUploading] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const [selectedStory, setSelectedStory] = useState<any>(null);

  const fetchStories = async () => {
    const { data } = await supabase
      .from('stories')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setStories(data);
  };

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
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: uploadForm.photoFile.type
              }
            },
            {
              text: "Hãy viết một câu mô tả (title) ngắn gọn và một đoạn cảm xúc (description) thật hay, lãng mạn cho bức ảnh này của một cặp đôi. Định dạng trả về: [Title]: ... [Description]: ... Ngôn ngữ: Tiếng Việt."
            }
          ]
        },
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
        .order('date', { ascending: false });
      if (data) setEvents(data);
      setLoading(false);
    };

    fetchEvents();
    fetchStories();

    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, fetchEvents)
      .subscribe();

    const storiesChannel = supabase
      .channel('stories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, fetchStories)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(storiesChannel);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
              src={getOptimizedImageUrl(config.avatar_url || "https://placehold.co/200x200/fcc4d6/333?text=Love", 400)}
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
          {/* Story Hub */}
          {stories.length > 0 && (
            <div className="bg-white/60 backdrop-blur-sm rounded-[2rem] p-6 border border-rose-50 soft-shadow">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                  <BookOpen size={16} className="text-rose-400" />
                  Kho Lưu Trữ Câu Chuyện
                </h3>
                <span className="text-[10px] font-bold text-rose-300 uppercase tracking-widest">{stories.length} câu chuyện</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => setSelectedStory(story)}
                    className="flex-shrink-0 w-32 h-40 bg-white rounded-2xl border border-rose-50 p-3 flex flex-col items-center justify-center text-center group hover:border-rose-200 transition-all hover:-translate-y-1"
                  >
                    <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-400 mb-3 group-hover:scale-110 transition-transform">
                      <Heart size={18} fill="currentColor" />
                    </div>
                    <p className="text-[10px] font-black text-gray-700 line-clamp-2 mb-1">Hành Trình #{story.id.slice(0, 4)}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase">{formatDate(story.created_at)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <JourneyStoryteller config={config} userRole={userRole} />
        </div>
      )}

      {/* Cute Day Counter Widget */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white p-5 lg:p-6 rounded-[1.5rem] lg:rounded-[2rem] shadow-lg border border-rose-50 mb-12 lg:mb-16 flex flex-col sm:flex-row items-center justify-between overflow-hidden relative gap-4"
      >
        <div className="flex items-center gap-4 relative z-10 w-full sm:w-auto">
          <div className="w-14 h-14 lg:w-16 lg:h-16 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500 shrink-0">
            <Sparkles size={28} />
          </div>
          <div>
            <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-wider">Ngày hạnh phúc</p>
            <h2 className="text-2xl lg:text-3xl font-black text-gray-800">{days} <span className="text-sm lg:text-lg font-bold text-rose-300">ngày</span></h2>
          </div>
        </div>
        <div className="relative z-10 w-full sm:w-auto text-left sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-rose-50">
          <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái</p>
          <p className="text-rose-400 font-black italic text-sm lg:text-base">Đang yêu say đắm ✨</p>
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
            <TimelineSkeleton />
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

      {/* Story Detail Modal */}
      <Modal
        isOpen={!!selectedStory}
        onClose={() => setSelectedStory(null)}
        title="Hành Trình Kỷ Niệm"
        className="max-w-3xl"
      >
        {selectedStory && (
          <div className="p-4 md:p-8">
            <div className="prose prose-stone prose-sm md:prose-base max-w-none">
              <ReactMarkdown>{selectedStory.content}</ReactMarkdown>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tạo vào: {formatDate(selectedStory.created_at, true)}</span>
              <button 
                onClick={() => setSelectedStory(null)}
                className="text-primary font-bold text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Event Detail Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedEvent && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedEvent(null)}
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              />
              
              {/* Navigation Buttons */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-30">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = events.findIndex(p => p.id === selectedEvent.id);
                    if (idx > 0) setSelectedEvent(events[idx - 1]);
                  }}
                  className={cn(
                    "w-12 h-12 rounded-full bg-white/20 hover:bg-rose-400 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto transition-all shadow-xl border border-white/30",
                    events.findIndex(p => p.id === selectedEvent.id) === 0 && "opacity-0 pointer-events-none"
                  )}
                >
                  <ChevronLeft size={28} strokeWidth={3} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const idx = events.findIndex(p => p.id === selectedEvent.id);
                    if (idx < events.length - 1) setSelectedEvent(events[idx + 1]);
                  }}
                  className={cn(
                    "w-12 h-12 rounded-full bg-white/20 hover:bg-rose-400 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto transition-all shadow-xl border border-white/30",
                    events.findIndex(p => p.id === selectedEvent.id) === events.length - 1 && "opacity-0 pointer-events-none"
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
                  onClick={() => setSelectedEvent(null)}
                  className="absolute top-6 right-6 z-20 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
                >
                  <X size={24} />
                </button>
                
                <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
                  <div className="flex-grow lg:w-3/4 bg-black flex items-center justify-center relative group min-h-[40vh] lg:min-h-0">
                    <motion.img
                      key={selectedEvent.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={getOptimizedImageUrl(selectedEvent.photo_url, 1600)}
                      alt={selectedEvent.title}
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full object-contain"
                    />

                    {/* Floating Mobile Nav Overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-4 flex justify-between items-center bg-gradient-to-t from-black/60 to-transparent lg:hidden">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = events.findIndex(p => p.id === selectedEvent.id);
                          if (idx > 0) setSelectedEvent(events[idx - 1]);
                        }}
                        disabled={events.findIndex(p => p.id === selectedEvent.id) === 0}
                        className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md disabled:opacity-20"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = events.findIndex(p => p.id === selectedEvent.id);
                          if (idx < events.length - 1) setSelectedEvent(events[idx + 1]);
                        }}
                        disabled={events.findIndex(p => p.id === selectedEvent.id) === events.length - 1}
                        className="p-3 bg-white/20 rounded-full text-white backdrop-blur-md disabled:opacity-20"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>

                    <a 
                      href={selectedEvent.photo_url} 
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
                      <div className="flex items-center gap-2 text-rose-400 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-rose-400/10 flex items-center justify-center">
                          <Heart size={16} fill="currentColor" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Kỷ niệm tình yêu</span>
                      </div>
                      <h2 className="text-xl lg:text-2xl font-black text-gray-800 leading-tight mb-4">{selectedEvent.title}</h2>
                      <p className="text-sm lg:text-base text-gray-600 leading-relaxed italic border-l-2 border-rose-100 pl-4 py-1">
                        "{selectedEvent.description}"
                      </p>
                    </div>

                    <div className="lg:mt-auto pt-6 lg:pt-8 border-t border-gray-100 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-gray-50">
                          <Calendar size={20} className="text-rose-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Ngày diễn ra</p>
                          <p className="text-sm font-bold text-gray-700">{formatDate(selectedEvent.date)}</p>
                        </div>
                      </div>

                      <div className="hidden lg:grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => {
                            const idx = events.findIndex(p => p.id === selectedEvent.id);
                            if (idx > 0) setSelectedEvent(events[idx - 1]);
                          }}
                          disabled={events.findIndex(p => p.id === selectedEvent.id) === 0}
                          className="py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Ảnh trước
                        </button>
                        <button 
                          onClick={() => {
                            const idx = events.findIndex(p => p.id === selectedEvent.id);
                            if (idx < events.length - 1) setSelectedEvent(events[idx + 1]);
                          }}
                          disabled={events.findIndex(p => p.id === selectedEvent.id) === events.length - 1}
                          className="py-3 bg-rose-400 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-500 transition-colors soft-shadow disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Ảnh tiếp
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-400">
                          <Sparkles size={14} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Khoảnh khắc đáng nhớ</span>
                      </div>
                      
                      <button 
                        onClick={() => setSelectedEvent(null)}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-rose-400 transition-colors soft-shadow"
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

