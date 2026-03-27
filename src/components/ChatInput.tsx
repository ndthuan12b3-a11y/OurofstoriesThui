import React, { useRef } from 'react';
import { 
  Send, 
  Mic, 
  Image as ImageIcon, 
  XCircle, 
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './Button';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  isAnalyzing: boolean;
  image: File | null;
  setImage: (file: File | null) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  isAnalyzing,
  image,
  setImage,
  previewUrl,
  setPreviewUrl,
  isListening,
  startListening,
  stopListening,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setImage(file);
          setPreviewUrl(URL.createObjectURL(file));
        }
      }
    }
  };

  return (
    <footer className="p-4 md:p-6">
      <div className="max-w-3xl mx-auto relative">
        <AnimatePresence>
          {previewUrl && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 mb-4 bg-white border border-sky-200 rounded-2xl p-4 flex items-center justify-between shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <img src={previewUrl} className="w-14 h-14 rounded-lg object-cover border border-slate-100" alt="Preview" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-sky-700">Đơn thuốc đã tải lên</span>
                  <span className="text-[10px] text-slate-400 italic">Sẵn sàng phân tích chuyên sâu...</span>
                </div>
              </div>
              <button onClick={removeImage} className="text-slate-300 hover:text-red-500 transition-colors">
                <XCircle size={24} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass-panel rounded-3xl flex items-center p-2 pr-4 shadow-2xl border border-white/50">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-sky-600 transition"
          >
            <ImageIcon size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden" 
            accept="image/*" 
          />
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSend()}
            onPaste={handlePaste}
            placeholder="Nhập tên thuốc hoặc tải đơn thuốc..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 placeholder:text-slate-400 px-2 py-3 outline-none"
          />
          
          <div className="flex items-center gap-2">
            <button 
              onClick={isListening ? stopListening : startListening}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isListening ? 'bg-red-50 text-red-600 animate-pulse' : 'text-slate-400 hover:text-sky-600'}`}
            >
              <Mic size={18} />
            </button>
            <button 
              onClick={onSend}
              disabled={isAnalyzing}
              className="bg-gradient-to-r from-sky-500 to-sky-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-200 hover:from-sky-600 hover:to-sky-700 transition-all disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {isListening && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/95 rounded-3xl flex items-center px-6 justify-between border border-sky-200 z-20"
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1 items-end h-6">
                  <div className="w-1.5 h-3 bg-sky-500 animate-pulse"></div>
                  <div className="w-1.5 h-5 bg-sky-400 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-2 bg-sky-600 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm font-bold text-sky-600">Đang lắng nghe câu hỏi...</span>
              </div>
              <button onClick={stopListening} className="text-slate-400 hover:text-red-500">
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </footer>
  );
};
