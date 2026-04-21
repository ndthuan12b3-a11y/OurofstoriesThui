import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    // For Android/Chrome
    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, we show it manually if not in standalone mode
    if (isIOSDevice && !window.matchMedia('(display-mode: standalone)').matches) {
      // Small delay to ensure it doesn't pop up immediately and annoy users
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // iOS doesn't have a programmatic prompt, we show instructions
      alert('Để cài đặt ứng dụng trên iPhone:\n1. Nhấn vào nút Gửi/Chia sẻ (hình ô vuông có mũi tên lên)\n2. Cuộn xuống và chọn "Thêm vào màn hình chính"\n3. Nhấn "Thêm" để hoàn tất.');
      return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-24 z-50 max-w-md"
      >
        <div className="bg-white/90 backdrop-blur-xl border border-rose-100 rounded-3xl p-4 soft-shadow flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
            <Download size={24} />
          </div>
          <div className="flex-grow">
            <h3 className="font-bold text-gray-800 text-sm">Cài đặt ứng dụng</h3>
            <p className="text-xs text-gray-500">Tải ứng dụng về màn hình chính để truy cập nhanh hơn!</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl soft-shadow active:scale-95 transition-transform"
            >
              Cài đặt
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
