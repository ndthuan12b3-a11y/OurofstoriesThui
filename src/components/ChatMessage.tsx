import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlayCircle, CheckCircle2, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  audio?: string;
}

interface ChatMessageProps {
  msg: Message;
  playAudio: (base64: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ msg, playAudio }) => {
  const exportToPDF = () => {
    // For Vietnamese support in jsPDF without custom fonts, 
    // we'll generate a clean text-based report that is easy to read.
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 120, 215);
    doc.text("PHARMAAI 2026 - BAO CAO TU VAN", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Ngay: ${new Date().toLocaleString('vi-VN')}`, 20, 30);
    doc.text("--------------------------------------------------", 20, 35);

    // Content
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    // Clean markdown for PDF (jsPDF standard fonts don't support all UTF-8 well, 
    // so we'll provide a clean text version and also a .txt fallback if needed)
    const cleanText = msg.text.replace(/[*#|]/g, '');
    const splitText = doc.splitTextToSize(cleanText, 170);
    doc.text(splitText, 20, 45);

    doc.save(`Tu-van-PharmaAI-${msg.id}.pdf`);
  };

  const exportToText = () => {
    const header = `==========================================\nPHARMAAI 2026 - BÁO CÁO TƯ VẤN DƯỢC\n==========================================\nNgày: ${new Date().toLocaleString('vi-VN')}\n\n`;
    const footer = `\n\n==========================================\nLưu ý: Thông tin mang tính chất tham khảo.\nHãy luôn tham khảo ý kiến bác sĩ trực tiếp.\n==========================================`;
    const content = header + msg.text + footer;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tu-van-PharmaAI-${msg.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`flex flex-col max-w-[90%] ${msg.role === 'ai' ? 'items-start' : 'items-end'}`}>
        <div className={`px-5 py-5 rounded-3xl ${msg.role === 'ai' ? 'chat-bubble-ai border border-slate-200' : 'chat-bubble-user'} shadow-md`}>
          <div className="markdown-body">
            {msg.role === 'ai' ? (
              <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
            ) : (
              msg.text
            )}
          </div>
          {msg.role === 'ai' && (
            <div className="flex flex-wrap gap-2 mt-4">
              {msg.audio && (
                <button 
                  onClick={() => playAudio(msg.audio!)}
                  className="text-[10px] font-bold uppercase text-sky-600 bg-sky-50 px-3 py-1.5 rounded-full hover:bg-sky-100 transition inline-flex items-center shadow-sm"
                >
                  <PlayCircle size={14} className="mr-1" /> Nghe tư vấn
                </button>
              )}
              <button 
                onClick={exportToText}
                className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition inline-flex items-center shadow-sm"
              >
                <Download size={14} className="mr-1" /> Xuất File (Chuẩn)
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 px-2">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            {msg.role === 'ai' ? 'PharmaAI VIP' : 'Bệnh nhân'}
          </span>
          {msg.role === 'ai' && (
            <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 text-[8px] font-black rounded uppercase flex items-center gap-1">
              <CheckCircle2 size={10} /> Chuẩn Y khoa
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
