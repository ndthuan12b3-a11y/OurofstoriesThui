import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { AppConfig } from '../types';
import { Sparkles, Heart, BookOpen, Wand2, RefreshCw, X, Calendar } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { showNotification } from '../lib/notifications';

interface JourneyStorytellerProps {
  config: AppConfig;
  userRole: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
}

export const JourneyStoryteller: React.FC<JourneyStorytellerProps> = ({ config, userRole }) => {
  const [story, setStory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('title, description, date')
      .order('date', { ascending: true });
    if (data) setEvents(data);
    return data || [];
  };

  const generateStory = async () => {
    setLoading(true);
    try {
      const currentEvents = await fetchEvents();
      
      if (currentEvents.length === 0) {
        showNotification("Bạn cần thêm ít nhất một kỷ niệm để AI có thể viết truyện!", true);
        setLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      
      const eventsSummary = currentEvents.map(e => `- Ngày ${formatDate(e.date)}: ${e.title} (${e.description})`).join('\n');
      
      const prompt = `
        Bạn là một người kể chuyện tình yêu lãng mạn và tinh tế. 
        Dựa trên danh sách các kỷ niệm sau đây của cặp đôi ${config.name_male} và ${config.name_female}, 
        hãy viết một câu chuyện tình yêu (AI Journey Story) thật cảm động, sâu sắc và đầy chất thơ.
        
        Thông tin cặp đôi:
        - Tên bạn nam: ${config.name_male}
        - Tên bạn nữ: ${config.name_female}
        - Ngày bắt đầu: ${formatDate(config.start_date)}
        
        Danh sách kỷ niệm:
        ${eventsSummary}
        
        Yêu cầu:
        1. Sử dụng ngôn ngữ tiếng Việt lãng mạn, giàu cảm xúc.
        2. Chia câu chuyện thành các chương hoặc đoạn văn có tiêu đề nghệ thuật.
        3. Kết thúc bằng một lời chúc hoặc một thông điệp ý nghĩa về tương lai của hai người.
        4. Định dạng bằng Markdown (sử dụng các tiêu đề h2, h3, in đậm, v.v.).
        5. Độ dài khoảng 400-600 từ.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setStory(response.text || "Không thể tạo câu chuyện lúc này.");
      setIsOpen(true);
    } catch (error) {
      console.error("AI Error:", error);
      showNotification("Lỗi khi kết nối với Trợ lý AI!", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 mb-12">
      <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 shadow-xl border border-rose-50 relative overflow-hidden group">
        {/* Decorative elements */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-rose-100/30 rounded-full blur-3xl group-hover:bg-rose-200/40 transition-colors" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-100/30 rounded-full blur-3xl group-hover:bg-blue-200/40 transition-colors" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-rose-300 rounded-3xl flex items-center justify-center text-white shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
            <BookOpen size={40} />
          </div>
          
          <div className="flex-grow text-center md:text-left">
            <h2 className="text-2xl font-black text-gray-800 mb-2 flex items-center justify-center md:justify-start gap-2">
              AI Journey Storyteller
              <Sparkles className="text-yellow-400 animate-pulse" size={20} />
            </h2>
            <p className="text-gray-500 leading-relaxed">
              Hãy để AI dệt nên câu chuyện tình yêu của hai bạn dựa trên những kỷ niệm đã lưu giữ. 
              Một bản tóm tắt hành trình đầy cảm xúc đang chờ đợi...
            </p>
          </div>
          
          <button
            onClick={generateStory}
            disabled={loading}
            className="px-8 py-4 bg-primary text-white rounded-2xl font-bold soft-shadow hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : (
              <Wand2 size={20} />
            )}
            {loading ? "Đang dệt truyện..." : "Tạo Câu Chuyện"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#fdfcf8] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-stone-200"
            >
              {/* Story Header */}
              <div className="p-6 md:p-8 border-b border-stone-100 flex items-center justify-between bg-white/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-600">
                    <Heart size={24} fill="currentColor" className="text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic font-black text-stone-800">Hành Trình Hạnh Phúc</h3>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Viết bởi AI Trợ Lý</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Story Content */}
              <div className="flex-grow overflow-y-auto p-8 md:p-16 custom-scrollbar">
                <div className="max-w-2xl mx-auto">
                  <div className="prose prose-stone prose-lg max-w-none prose-headings:font-serif prose-headings:italic prose-headings:text-stone-800 prose-p:text-stone-600 prose-p:leading-relaxed prose-strong:text-stone-800">
                    <ReactMarkdown>{story}</ReactMarkdown>
                  </div>
                  
                  <div className="mt-16 pt-8 border-t border-stone-100 flex flex-col items-center text-center">
                    <div className="w-1 h-12 bg-gradient-to-b from-rose-200 to-transparent rounded-full mb-6" />
                    <p className="font-serif italic text-stone-400 text-lg">
                      "Tình yêu không phải là tìm thấy một người hoàn hảo, <br/>
                      mà là học cách nhìn thấy những điều hoàn hảo từ một người không hoàn hảo."
                    </p>
                    <div className="mt-8 flex items-center gap-3 text-stone-300">
                      <Sparkles size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Forever Together</span>
                      <Sparkles size={16} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Story Footer */}
              <div className="p-6 bg-stone-50/50 border-t border-stone-100 flex justify-center gap-4">
                <button
                  onClick={generateStory}
                  className="px-6 py-2 bg-white border border-stone-200 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-100 transition-all flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  Viết lại bản khác
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-stone-800 text-white rounded-xl text-sm font-bold hover:bg-stone-900 transition-all flex items-center gap-2"
                >
                  <Wand2 size={16} />
                  Lưu kỷ niệm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
