import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

interface Track {
  id: string;
  title: string;
  music_url: string;
}

interface MusicContextType {
  playlist: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  isRepeat: boolean;
  isUnlocked: boolean;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  toggleRepeat: () => void;
  seekTo: (time: number) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true); // Mặc định là true để tự động phát
  const [isRepeat, setIsRepeat] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchPlaylist = async () => {
      const { data } = await supabase
        .from('music_playlist')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (data) {
        setPlaylist(data);
        if (!currentTrackId && data.length > 0) {
          setCurrentTrackId(data[0].id);
        }
      }
    };

    fetchPlaylist();

    // Lắng nghe tương tác đầu tiên để mở khóa âm thanh
    const unlockAudio = () => {
      if (!isUnlocked && audioRef.current) {
        // Thử phát nhạc để mở khóa context âm thanh của trình duyệt
        audioRef.current.play().then(() => {
          setIsUnlocked(true);
          // Nếu đang ở trạng thái isPlaying=true thì cứ để nó phát
          if (!isPlaying) {
            audioRef.current?.pause();
          }
          window.removeEventListener('click', unlockAudio);
          window.removeEventListener('touchstart', unlockAudio);
        }).catch(error => {
          // Nếu chưa có src thì play() sẽ lỗi, nhưng ta vẫn coi như đã "tương tác"
          // Trình duyệt chỉ cần 1 lần gọi play() thành công sau tương tác
          if (audioRef.current?.src) {
            console.error("Unlock error:", error);
          } else {
            // Nếu chưa có src, ta vẫn đánh dấu là đã unlock để khi có src nó tự phát
            setIsUnlocked(true);
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
          }
        });
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [isUnlocked]);

  const currentTrack = playlist.find(t => t.id === currentTrackId) || null;

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(error => {
        if (error.name !== 'AbortError') console.error(error);
      });
      setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    if (playlist.length === 0) return;
    const currentIndex = playlist.findIndex(t => t.id === currentTrackId);
    const nextIndex = (currentIndex + 1) % playlist.length;
    setCurrentTrackId(playlist[nextIndex].id);
  };

  const playPrev = () => {
    if (playlist.length === 0) return;
    const currentIndex = playlist.findIndex(t => t.id === currentTrackId);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentTrackId(playlist[prevIndex].id);
  };

  const toggleRepeat = () => setIsRepeat(!isRepeat);

  const seekTo = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  return (
    <MusicContext.Provider value={{ playlist, currentTrack, isPlaying, isRepeat, isUnlocked, togglePlay, playNext, playPrev, toggleRepeat, seekTo, audioRef }}>
      {children}
      <audio 
        ref={audioRef} 
        src={currentTrack?.music_url}
        onEnded={() => isRepeat ? audioRef.current?.play() : playNext()} 
        preload="auto"
      />
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within a MusicProvider');
  return context;
};
