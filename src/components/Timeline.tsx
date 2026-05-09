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
import { LocationPicker } from './LocationPicker';
import { StoryMap } from './StoryMap';

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
  location: { lat: number; lng: number; address_name: string } | null;
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
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ 
    title: '', 
    date: '', 
    description: '', 
    photoFile: null as File | null,
    location: null as { lat: number; lng: number; address_name: string } | null
  });
  const [showMap, setShowMap] = useState(false);
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

    // Fetch current profile avatar
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data && data.avatar_url) {
          setProfileAvatar(data.avatar_url);
        }
      }
    };
    fetchProfile();

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
        location: uploadForm.location,
        user_id: '6857068c-7cc5-45ce-8099-23f0e3264251' // PRIMARY_CONFIG_ID
      }]);

      if (error) throw error;

      showNotification("Đã thêm kỷ niệm mới!");
      setIsUploadModalOpen(false);
      setUploadForm({ title: '', date: '', description: '', photoFile: null, location: null });
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

  // Detail Modal Scroll Lock
  useEffect(() => {
    if (selectedEvent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedEvent]);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-32 md:pb-20 animate-fadeIn">
      {/* HUD Header - Modern & Compact */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 bg-white/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/50">
        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl overflow-hidden border-2 border-white shadow-lg -rotate-3 hover:rotate-0 transition-transform duration-500">
              <img
                src={getOptimizedImageUrl(profileAvatar || config.avatar_url || "https://placehold.co/200x200/fcc4d6/333?text=Love", 400)}
                alt="Couple"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-xl shadow-lg flex items-center justify-center text-rose-400"
            >
              <Heart size={16} fill="currentColor" />
            </motion.div>
          </motion.div>
          
          <div className="text-left">
            <h1 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight leading-none mb-1">
              {config.name_male} <span className="text-rose-300">❤</span> {config.name_female}
            </h1>
            <div className="inline-flex items-center gap-1.5 text-rose-400 text-[10px] font-black uppercase tracking-widest">
              <Calendar size={12} />
              <span>{formatDate(config.start_date)}</span>
            </div>
          </div>
        </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMap(!showMap)}
              className={cn(
                "p-3 rounded-2xl font-black text-[10px] uppercase tracking-widest soft-shadow transition-all flex items-center gap-2",
                showMap ? "bg-gray-900 text-white" : "bg-white text-gray-400 border border-gray-100"
              )}
            >
              <MapPin size={16} />
              {showMap ? "Ẩn Bản Đồ" : "Story Map"}
            </button>
          {HAS_VIEW_ACCESS() && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest soft-shadow hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus size={16} />
              Thêm Kỷ Niệm
            </button>
          )}
        </div>
      </div>

      {HAS_VIEW_ACCESS() && (
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mb-12">
          {showMap && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <StoryMap events={events as any} config={config} />
            </motion.div>
          )}
          {/* Day Counter Widget - Transparent HUD style */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-row items-center justify-between gap-4 glassmorphism p-6 md:p-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-rose-400/10 rounded-2xl flex items-center justify-center text-rose-400 shrink-0">
                <Sparkles size={28} />
              </div>
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Together for</p>
                <h2 className="text-3xl font-black text-gray-800 leading-none">{days} <span className="text-sm font-bold text-rose-300">days</span></h2>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Current Mood</p>
              <p className="text-rose-400 font-black italic text-sm md:text-base">Say đắm ✨</p>
            </div>
          </motion.div>

          {/* Story Hub */}
          {stories.length > 0 && (
            <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/50 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-[10px] font-black text-gray-800 flex items-center gap-2 uppercase tracking-widest">
                  <BookOpen size={14} className="text-rose-400" />
                  Story Library
                </h3>
                <span className="text-[8px] font-bold text-rose-300 uppercase tracking-[0.2em]">{stories.length} stories</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 px-2 custom-scrollbar no-scrollbar scroll-smooth">
                {stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => setSelectedStory(story)}
                    className="flex-shrink-0 w-32 h-44 bg-white/60 rounded-3xl border border-white/50 p-4 flex flex-col items-start justify-end group hover:bg-white hover:border-rose-100 transition-all hover:-translate-y-1 shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-4 left-4 w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                      <Heart size={14} fill="currentColor" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-800 leading-tight mb-1">Vol. {story.id.slice(0, 4)}</p>
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">{formatDate(story.created_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <JourneyStoryteller config={config} userRole={userRole} />
        </div>
      )}

      {/* Main Timeline HUD */}
      <div className="relative space-y-12 md:space-y-16 min-h-[400px]">
        {/* Modern Vertical Line */}
        <div className="absolute left-6 md:left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-100 via-blue-50 to-transparent rounded-full" />

        <AnimatePresence mode="popLayout">
          {loading ? (
            <TimelineSkeleton />
          ) : events.length > 0 ? (
            events.map((event, index) => (
              <EventItem key={event.id} event={event} index={index} onClick={setSelectedEvent} />
            ))
          ) : (
            <div className="ml-16 mr-4 text-center py-24 bg-white/40 rounded-[2.5rem] border-2 border-dashed border-gray-100">
              <p className="text-gray-400 font-bold px-8">Hãy bắt đầu viết nên câu chuyện của chúng mình... ✨</p>
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
            <div className="fixed inset-0 z-[4000] flex items-center justify-center p-0 md:p-4 overflow-hidden bg-black/95 backdrop-blur-xl">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedEvent(null)}
                className="absolute inset-0 cursor-pointer"
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
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative max-w-6xl w-full h-full md:h-auto md:max-h-[90vh] bg-white md:rounded-[2.5rem] overflow-hidden shadow-2xl z-10 flex flex-col"
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
                  <div className="lg:w-1/4 p-6 lg:p-8 flex flex-col bg-gray-50/50 overflow-y-auto custom-scrollbar shrink-0">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 text-rose-400 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-rose-400/10 flex items-center justify-center">
                          <Heart size={16} fill="currentColor" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Kỷ niệm tình yêu</span>
                      </div>
                      <h2 className="text-xl lg:text-2xl font-black text-gray-800 leading-tight mb-4">{selectedEvent.title}</h2>
                      
                      {/* Scrollable Description Area */}
                      <div className="max-h-[30vh] lg:max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
                        <p className="text-sm lg:text-base text-gray-600 leading-relaxed italic border-l-3 border-rose-100 pl-4 py-1 whitespace-pre-wrap">
                          "{selectedEvent.description}"
                        </p>
                      </div>
                    </div>

                    <div className="lg:mt-auto pt-6 border-t border-gray-100 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-gray-50">
                          <Calendar size={20} className="text-rose-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Ngày diễn ra</p>
                          <p className="text-sm font-bold text-gray-700">{formatDate(selectedEvent.date)}</p>
                        </div>
                      </div>

                      {/* Optional Location Info if available */}
                      {selectedEvent.location && (
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-gray-50">
                            <MapPin size={20} className="text-blue-400" />
                          </div>
                          <div className="min-w-0 flex-grow">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Địa điểm</p>
                            <p className="text-[11px] font-bold text-gray-700 truncate">{selectedEvent.location.address_name}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-400">
                          <Sparkles size={14} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Khoảnh khắc đáng nhớ</span>
                      </div>
                      
                      <button 
                        onClick={() => setSelectedEvent(null)}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] shadow-lg hover:bg-primary transition-all duration-300 hover:-translate-y-0.5"
                      >
                        Đóng
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

      {/* Upload Modal - Minimalist */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Nâng Cấp Kỷ Niệm"
        progress={uploading ? 100 : (isGeneratingCaption ? 50 : 0)}
      >
        <form onSubmit={handleUploadSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tiêu đề</label>
              <button
                type="button"
                onClick={generateAICaption}
                disabled={isGeneratingCaption || !uploadForm.photoFile}
                className="text-[10px] font-black text-primary flex items-center gap-1 hover:brightness-110 disabled:opacity-50 transition-all uppercase"
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
              placeholder="Khoảnh khắc ấy..."
              className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ngày tháng</label>
            <input
              type="date"
              value={uploadForm.date}
              onChange={e => setUploadForm({ ...uploadForm, date: e.target.value })}
              className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all font-medium text-gray-800"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cảm xúc</label>
            <textarea
              value={uploadForm.description}
              onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="Kể lại khoảnh khắc ấy..."
              className="w-full p-4 bg-white/50 border border-white/20 rounded-2xl outline-none focus:border-primary/50 transition-all h-32 font-medium text-gray-800 resize-none"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Địa điểm</label>
            <LocationPicker 
              value={uploadForm.location}
              onChange={(loc) => setUploadForm({ ...uploadForm, location: loc })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hình ảnh</label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={e => setUploadForm({ ...uploadForm, photoFile: e.target.files?.[0] || null })}
                className="hidden"
                id="event-upload"
              />
              <label
                htmlFor="event-upload"
                className="flex flex-col items-center justify-center w-full p-8 bg-white/30 border-2 border-dashed border-white/50 rounded-2xl cursor-pointer hover:bg-white/50 transition-all"
              >
                {uploadForm.photoFile ? (
                  <span className="text-primary font-black text-[10px] uppercase">{uploadForm.photoFile.name}</span>
                ) : (
                  <Camera size={24} className="text-gray-300" />
                )}
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg hover:bg-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Heart size={16} fill="currentColor" />
            )}
            {uploading ? "ĐANG LƯU..." : "LƯU KỶ NIỆM"}
          </button>
        </form>
      </Modal>
    </div>
  );
};

