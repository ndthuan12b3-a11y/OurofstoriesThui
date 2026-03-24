import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { Modal } from './Modal';
import { Heart, Sparkles, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  photo_url: string;
}

export const MemoriesNotification: React.FC = () => {
  const [memory, setMemory] = useState<Event | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMemories = async () => {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const { data } = await supabase
        .from('events')
        .select('*') as any;

      if (data) {
        const todayMemories = data.filter((event: Event) => {
          const eventDate = new Date(event.date);
          return (
            eventDate.getMonth() + 1 === month &&
            eventDate.getDate() === day &&
            eventDate.getFullYear() < today.getFullYear()
          );
        });

        if (todayMemories.length > 0) {
          // Pick a random one if multiple
          const randomMemory = todayMemories[Math.floor(Math.random() * todayMemories.length)];
          setMemory(randomMemory);
          
          // Show notification after a short delay
          setTimeout(() => {
            setIsOpen(true);
          }, 2000);
        }
      }
    };

    checkMemories();
  }, []);

  if (!memory) return null;

  const yearsAgo = new Date().getFullYear() - new Date(memory.date).getFullYear();

  return (
    <AnimatePresence>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="✨ Kỷ Niệm Ngày Này Năm Xưa"
        className="max-w-lg p-0 overflow-hidden border-4 border-rose-100"
      >
        <div className="flex flex-col">
          <div className="relative aspect-video bg-gray-100 overflow-hidden">
            <img 
              src={memory.photo_url} 
              alt={memory.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-rose-300" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  {yearsAgo} năm trước - {formatDate(memory.date)}
                </span>
              </div>
              <h3 className="text-2xl font-black">{memory.title}</h3>
            </div>
          </div>
          
          <div className="p-8 bg-white relative">
            <motion.div 
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute -top-6 right-8 w-12 h-12 bg-rose-400 rounded-2xl shadow-lg flex items-center justify-center text-white"
            >
              <Heart size={24} fill="currentColor" />
            </motion.div>

            <p className="text-gray-600 leading-relaxed italic mb-8 text-lg">
              "{memory.description}"
            </p>

            <div className="flex flex-col gap-4">
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-400 shadow-sm">
                  <Sparkles size={20} />
                </div>
                <p className="text-sm font-bold text-rose-500">
                  Thời gian trôi nhanh quá, nhưng tình yêu của chúng mình vẫn vẹn nguyên như ngày đầu!
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-4 bg-gray-800 text-white rounded-2xl font-bold hover:bg-gray-900 transition-all soft-shadow"
              >
                Cảm ơn vì đã luôn ở bên Anh/Em ❤️
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </AnimatePresence>
  );
};
