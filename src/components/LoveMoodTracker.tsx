import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { supabase } from '../lib/supabase';
import { Thermometer, Heart, MessageCircle, Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import { showNotification } from '../lib/notifications';

interface LoveMoodTrackerProps {
  userRole: string;
}

interface MoodAnalysis {
  temperature: number; // 0 to 100
  status: string;
  advice: string;
  trend: 'up' | 'down' | 'stable';
}

export const LoveMoodTracker: React.FC<LoveMoodTrackerProps> = ({ userRole }) => {
  const [analysis, setAnalysis] = useState<MoodAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeMood = async () => {
    setLoading(true);
    try {
      // Fetch last 10 events
      const { data: events } = await supabase
        .from('events')
        .select('title, description, date')
        .order('date', { ascending: false })
        .limit(10);

      if (!events || events.length === 0) {
        setAnalysis({
          temperature: 50,
          status: "Bình yên",
          advice: "Hãy bắt đầu tạo thêm nhiều kỷ niệm cùng nhau nhé!",
          trend: 'stable'
        });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.warn("GEMINI_API_KEY not configured");
        setLoading(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const eventsText = events.map(e => `${e.date}: ${e.title} - ${e.description}`).join('\n');
      
      const prompt = `
        Dựa trên danh sách các kỷ niệm gần đây của một cặp đôi, hãy phân tích "Nhiệt độ Tình yêu" của họ.
        Danh sách kỷ niệm:
        ${eventsText}
        
        Hãy trả về kết quả dưới định dạng JSON với các trường sau:
        - temperature: số từ 0 đến 100 (thể hiện mức độ nồng nhiệt)
        - status: một cụm từ ngắn mô tả trạng thái (ví dụ: "Nồng cháy", "Ấm áp", "Bình lặng", "Hơi lạnh nhạt")
        - advice: một lời khuyên ngắn gọn, chân thành để duy trì hoặc hâm nóng tình cảm.
        - trend: một trong ba giá trị: "up", "down", "stable" (xu hướng tình cảm gần đây).
        
        Ngôn ngữ: Tiếng Việt. Chỉ trả về JSON.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [{ text: prompt }]
        },
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || "{}");
      setAnalysis(result);
    } catch (error) {
      console.error("Mood Analysis Error:", error);
      showNotification("Lỗi khi phân tích nhiệt độ tình yêu!", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeMood();
  }, []);

  if (!analysis && loading) {
    return (
      <div className="bg-white/50 backdrop-blur-sm rounded-[2rem] p-8 border border-white/50 soft-shadow animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="h-24 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  if (!analysis) return null;

  const getTrendIcon = () => {
    switch (analysis.trend) {
      case 'up': return <TrendingUp className="text-emerald-500" size={18} />;
      case 'down': return <TrendingDown className="text-rose-500" size={18} />;
      default: return <Minus className="text-gray-400" size={18} />;
    }
  };

  const getTempColor = (temp: number) => {
    if (temp > 80) return "from-orange-500 to-rose-600";
    if (temp > 50) return "from-rose-400 to-orange-400";
    if (temp > 30) return "from-blue-400 to-rose-300";
    return "from-blue-600 to-cyan-400";
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 shadow-xl border border-rose-50 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4">
        <button 
          onClick={analyzeMood} 
          disabled={loading}
          className="p-2 hover:bg-rose-50 rounded-full transition-colors text-rose-300 disabled:opacity-50"
        >
          <RefreshCw size={18} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        {/* Thermometer Visual */}
        <div className="relative w-24 h-48 bg-gray-100 rounded-full p-2 flex flex-col justify-end overflow-hidden border-4 border-white shadow-inner">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${analysis.temperature}%` }}
            className={cn(
              "w-full rounded-full bg-gradient-to-t transition-all duration-1000",
              getTempColor(analysis.temperature)
            )}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <Thermometer className="text-white/50 mb-1" size={32} />
            <span className="text-xl font-black text-white drop-shadow-md">{analysis.temperature}°</span>
          </div>
        </div>

        <div className="flex-grow text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <h3 className="text-2xl font-black text-gray-800">Nhiệt độ Tình yêu</h3>
            <div className="px-3 py-1 bg-white rounded-full shadow-sm border border-gray-50 flex items-center gap-2">
              {getTrendIcon()}
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{analysis.status}</span>
            </div>
          </div>

          <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-100/50 relative group">
            <MessageCircle className="absolute -top-3 -left-3 text-rose-200 group-hover:scale-110 transition-transform" size={32} fill="currentColor" />
            <p className="text-gray-600 italic leading-relaxed">
              "{analysis.advice}"
            </p>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-rose-300 uppercase tracking-[0.2em]">
              <Sparkles size={12} />
              AI Love Consultant
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="hidden lg:block w-48 bg-white rounded-3xl p-6 shadow-sm border border-gray-50 text-center">
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-rose-400">
            <Heart size={24} fill="currentColor" />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Trạng thái</p>
          <p className="text-lg font-black text-gray-800">{analysis.status}</p>
        </div>
      </div>
    </div>
  );
};
