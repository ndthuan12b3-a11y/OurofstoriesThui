import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { formatDate, calculateDays, cn, cleanAddress } from '../lib/utils';
import { getOptimizedImageUrl, compressImage } from '../lib/imageUtils';
import { AppConfig } from '../types';
import { 
  Heart, Lock, Sparkles, Calendar, Camera, MapPin, X, Info, Plus, 
  Upload, Image as ImageIcon, RefreshCw, ChevronRight, ChevronLeft, 
  BookOpen, Download 
} from 'lucide-react';
import { TimelineSkeleton } from './Skeleton';
import { Modal } from './Modal';
import { showNotification } from '../lib/notifications';
const JourneyStoryteller = React.lazy(() => import('./JourneyStoryteller').then(m => ({ default: m.JourneyStoryteller })));
const LocationPicker = React.lazy(() => import('./LocationPicker').then(m => ({ default: m.LocationPicker })));
const StoryMap = React.lazy(() => import('./StoryMap').then(m => ({ default: m.StoryMap })));

interface TimelineProps {
  config: AppConfig;
  userRole: string;
  onViewOnMap?: (event: Event) => void;
  setActiveTab?: (tab: string) => void;
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
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.5, ease: "easeOut" }}
    className="relative pl-12 md:pl-16 group"
  >
    {/* Timeline Dot */}
    <div className="absolute left-4.5 md:left-6.5 top-8 w-3 h-3 bg-white border-[3px] border-rose-300 rounded-full shadow-[0_0_0_4px_rgba(251,113,133,0.1)] z-10 group-hover:scale-125 transition-transform duration-300" />
    
    {/* Date Line - Hidden on very small screens */}
    <div className="hidden sm:block absolute left-[-4rem] top-8 w-24 border-t border-dashed border-rose-200 opacity-50" />

    {/* Elegant Card */}
    <div 
      className="bg-white/70 backdrop-blur-sm rounded-3xl p-3 md:p-4 shadow-sm hover:shadow-xl transition-all duration-500 border border-white/50 flex flex-col sm:flex-row gap-4 group-hover:-translate-y-1 cursor-pointer overflow-hidden"
      onClick={() => onClick(event)}
    >
      {/* High Quality Thumbnail */}
      <div className="w-full sm:w-28 h-28 rounded-2xl overflow-hidden shrink-0 shadow-sm relative group/img">
        <img
          src={getOptimizedImageUrl(event.photo_url, 400)}
          alt={event.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/5 group-hover/img:bg-transparent transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-grow flex flex-col justify-between py-1">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-primary transition-colors">{event.title}</h3>
            <span className="text-[9px] font-black text-rose-300/80 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap">
              {formatDate(event.date)}
            </span>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-2 font-medium">
            {event.description}
          </p>
        </div>
        
        <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-1.5"><MapPin size={10} className="text-blue-300" /> {cleanAddress(event.location?.address_name) || "Khoảnh khắc"}</span>
          <span className="flex items-center gap-1.5 ml-auto text-rose-300 group-hover:translate-x-1 transition-transform">Xem chi tiết <ChevronRight size={10} /></span>
        </div>
      </div>
    </div>
  </motion.div>
));

// Love Timer Component for real-time updates - Enhanced & Cute
const LoveTimer = ({ startDate }: { startDate: string }) => {
  const [time, setTime] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculate = () => {
      const start = new Date(startDate).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, now - start);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTime({ days, hours, minutes, seconds });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [startDate]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 bg-gradient-to-r from-rose-100/80 to-pink-50/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-rose-200/50 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center">
          <span className="text-xl md:text-2xl font-black text-rose-500 leading-none tabular-nums">{time.days}</span>
          <span className="text-[8px] font-black text-rose-300 uppercase tracking-widest mt-1">Ngày</span>
        </div>
        <div className="text-rose-200 font-bold self-start mt-1">:</div>
        <div className="flex flex-col items-center">
          <span className="text-xl md:text-2xl font-black text-slate-700 leading-none tabular-nums">{String(time.hours).padStart(2, '0')}</span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Giờ</span>
        </div>
        <div className="text-rose-200 font-bold self-start mt-1">:</div>
        <div className="flex flex-col items-center">
          <span className="text-xl md:text-2xl font-black text-slate-700 leading-none tabular-nums">{String(time.minutes).padStart(2, '0')}</span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Phút</span>
        </div>
        <div className="text-rose-200 font-bold self-start mt-1">:</div>
        <div className="flex flex-col items-center">
          <motion.span 
            key={time.seconds}
            initial={{ scale: 1.1, color: "#fb7185" }}
            animate={{ scale: 1, color: "#475569" }}
            className="text-xl md:text-2xl font-black leading-none tabular-nums transition-colors"
          >
            {String(time.seconds).padStart(2, '0')}
          </motion.span>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Giây</span>
        </div>
      </div>
      <div className="ml-2 w-8 h-8 bg-white/50 rounded-xl flex items-center justify-center text-rose-400 shadow-inner">
        <Heart size={16} fill="currentColor" className="animate-pulse" />
      </div>
    </motion.div>
  );
};

export const Timeline: React.FC<TimelineProps> = ({ config, userRole, onViewOnMap, setActiveTab }) => {
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
      if (!apiKey) {
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

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
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
          }
        ],
      });

      const text = result.text?.trim() || "";
      const titleMatch = text.match(/\[Title\]:\s*(.*)/i);
      const descMatch = text.match(/\[Description\]:\s*([\s\S]*)/i);
      
      setUploadForm(prev => ({ 
        ...prev, 
        title: titleMatch ? titleMatch[1].trim() : prev.title,
        description: descMatch ? descMatch[1].trim() : prev.description
      }));
      showNotification("Đã tạo mô tả và cảm xúc bằng AI!");
    } catch (error: any) {
      console.error("AI Caption Error:", error);
      if (error?.message?.includes('429') || error?.status === 429) {
        showNotification("AI đang nghỉ ngơi, vui lòng thử lại sau!", true);
      } else {
        showNotification("Lỗi khi tạo mô tả bằng AI!", true);
      }
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('id, title, description, date, photo_url, location, created_at')
        .order('date', { ascending: false })
        .limit(100);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newEvent = payload.new as Event;
          setEvents(prev => [newEvent, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } else if (payload.eventType === 'UPDATE') {
          const updatedEvent = payload.new as Event;
          setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(e => e.id === payload.old.id));
        }
      })
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
      // Compress image before upload
      const compressedFile = await compressImage(uploadForm.photoFile);
      const photoUrl = await handleFileUpload(compressedFile);
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
      {/* Header HUD - Minimal & Sleek */}
      <div className="mb-10 flex flex-col md:flex-row items-stretch md:items-center gap-4">
        <div className="flex-grow bg-white/60 backdrop-blur-xl p-4 md:p-5 rounded-[2rem] border border-white/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="relative shrink-0"
            >
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                <img
                  src={getOptimizedImageUrl(profileAvatar || config.avatar_url || "https://placehold.co/200x200/fcc4d6/333?text=Love", 400)}
                  alt="Couple"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-rose-400 rounded-lg shadow-sm flex items-center justify-center text-white">
                <Heart size={12} fill="currentColor" />
              </div>
            </motion.div>
            
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-none mb-3">
                {config.name_male} <Heart size={18} className="inline text-rose-300 mx-1" fill="currentColor" /> {config.name_female}
              </h1>
              <div className="flex flex-wrap items-center gap-4">
                <LoveTimer startDate={config.start_date} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden md:block">Kỷ niệm từ: {formatDate(config.start_date)}</span>
              </div>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => setActiveTab ? setActiveTab('map') : setShowMap(!showMap)}
              className={cn(
                "p-3 rounded-2xl soft-shadow transition-all group",
                showMap ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
              )}
              title="Story Map"
            >
              <MapPin size={20} className={cn(showMap ? "text-blue-300" : "group-hover:text-slate-600")} />
            </button>
            {HAS_VIEW_ACCESS() && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center soft-shadow hover:scale-105 active:scale-95 transition-all"
                title="Thêm kỷ niệm"
              >
                <Plus size={24} />
              </button>
            )}
          </div>
        </div>
        
        {/* Mobile Action Buttons */}
        <div className="flex sm:hidden gap-2 h-14">
          <button
            onClick={() => setActiveTab ? setActiveTab('map') : setShowMap(!showMap)}
            className={cn(
              "flex-1 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
              showMap ? "bg-slate-800 text-white" : "bg-white text-slate-400 border border-slate-100"
            )}
          >
            <MapPin size={16} /> Story Map
          </button>
          {HAS_VIEW_ACCESS() && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex-1 bg-primary text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Thêm Mới
            </button>
          )}
        </div>
      </div>

      {HAS_VIEW_ACCESS() && (
        <div className="space-y-6 mb-12">
          {showMap && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden rounded-[2.5rem] shadow-sm border border-white/50"
            >
              <React.Suspense fallback={<div className="h-[400px] bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Đang tải bản đồ...</div>}>
                <StoryMap events={events as any} config={config} />
              </React.Suspense>
            </motion.div>
          )}

          {/* Story Library & Hub */}
          <div className="space-y-6">
            <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-5 md:p-6 border border-white/50 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 px-1 gap-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-[10px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-[0.2em]">
                    <BookOpen size={14} className="text-rose-400" />
                    Story Library
                  </h3>
                  <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                  <React.Suspense fallback={null}>
                    <JourneyStoryteller config={config} userRole={userRole} />
                  </React.Suspense>
                </div>
                <span className="text-[8px] font-bold text-rose-300 uppercase tracking-[0.2em]">{stories.length} stories / together</span>
              </div>

              {stories.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                  {stories.map((story) => (
                    <button
                      key={story.id}
                      onClick={() => setSelectedStory(story)}
                      className="flex-shrink-0 w-24 h-32 bg-white/60 rounded-2xl border border-white/50 p-3 flex flex-col items-start justify-end group hover:bg-white hover:border-rose-100 hover:shadow-md transition-all hover:-translate-y-1 relative overflow-hidden"
                    >
                      <div className="absolute top-2 right-2 text-rose-200/50 group-hover:text-rose-300 transition-colors">
                        <Heart size={24} fill="currentColor" />
                      </div>
                      <div className="relative z-10">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{formatDate(story.created_at)}</p>
                        <p className="text-[10px] font-black text-slate-800 leading-tight">Vol. {story.id.slice(0, 4)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center border-2 border-dashed border-white/50 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Hãy tạo câu chuyện đầu tiên cho hành trình của hai bạn ✨</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Minimalist Vertical Line */}
      <div className="relative min-h-[400px]">
        <div className="absolute left-6 md:left-8 top-4 bottom-0 w-[2px] bg-gradient-to-b from-rose-200 via-slate-100 to-transparent rounded-full opacity-60" />
        
        <div className="space-y-8 md:space-y-12">
          <AnimatePresence mode="popLayout">
            {loading ? (
              <TimelineSkeleton />
            ) : events.length > 0 ? (
              events.map((event, index) => (
                <EventItem key={event.id} event={event} index={index} onClick={setSelectedEvent} />
              ))
            ) : (
              <div className="ml-16 mr-4 text-center py-20 bg-white/30 rounded-[2.5rem] border border-white/50 border-dashed">
                <p className="text-slate-400 font-medium px-8 text-sm italic">Hãy bắt đầu viết nên câu chuyện của chúng mình... ✨</p>
              </div>
            )}
          </AnimatePresence>
        </div>
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
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-gray-50">
                              <MapPin size={20} className="text-blue-400" />
                            </div>
                            <div className="min-w-0 flex-grow">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Địa điểm</p>
                              <p className="text-[11px] font-bold text-gray-700 truncate">{cleanAddress(selectedEvent.location.address_name)}</p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onViewOnMap) onViewOnMap(selectedEvent);
                              setSelectedEvent(null);
                            }}
                            className="w-full py-2 bg-blue-50 text-blue-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <MapPin size={12} /> Xem trên bản đồ
                          </button>
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
            <React.Suspense fallback={<div className="h-12 bg-gray-50/50 rounded-2xl animate-pulse" />}>
              <LocationPicker 
                value={uploadForm.location}
                onChange={(loc) => setUploadForm({ ...uploadForm, location: loc })}
              />
            </React.Suspense>
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

