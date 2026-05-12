import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  progress?: number; // Added progress prop for the status bar
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className, progress }) => {
  // Prevent scrolling when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 cursor-pointer"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full max-w-xl glassmorphism shadow-2xl overflow-hidden my-auto mx-auto z-10",
              "border-white/40 ring-1 ring-black/5",
              className
            )}
          >
            {/* Minimalist Progress Bar */}
            {progress !== undefined && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-20">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-primary shadow-[0_0_8px_rgba(255,143,163,0.6)]"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/20">
              <h2 className="text-[10px] md:text-sm font-black text-gray-800 uppercase tracking-[0.25em]">{title}</h2>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1.5 md:p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all duration-300"
              >
                <X size={18} className="md:w-[20px] md:h-[20px]" />
              </button>
            </div>
            <div className="p-6 md:p-8 max-h-[85vh] md:max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="text-gray-600 leading-relaxed font-medium space-y-4 text-sm md:text-base">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
