import React, { useEffect } from 'react';
import { useMusic } from '../lib/MusicContext';

export const BackgroundMusicPlayer: React.FC<{ active: boolean }> = ({ active }) => {
  const { currentTrack, isPlaying, audioRef, isUnlocked } = useMusic();

  useEffect(() => {
    if (audioRef.current && currentTrack) {
      if (active && isPlaying && isUnlocked) {
        // Chỉ gọi play nếu đang tạm dừng
        if (audioRef.current.paused) {
          audioRef.current.play().catch(error => {
            const errorMessage = error.message || String(error);
            if (
              error.name !== 'AbortError' && 
              !errorMessage.toLowerCase().includes('interrupted') &&
              !errorMessage.toLowerCase().includes('pause()')
            ) {
              console.error("BackgroundMusicPlayer play error:", error);
            }
          });
        }
      } else {
        // Chỉ gọi pause nếu đang phát
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    }
  }, [active, currentTrack, isPlaying, isUnlocked]);

  return null; // Component này không hiển thị gì cả
};
