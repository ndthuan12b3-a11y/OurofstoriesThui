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
  volume: number;
  togglePlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  toggleRepeat: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
}

interface MusicProgressContextType {
  currentTime: number;
  duration: number;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);
const MusicProgressContext = createContext<MusicProgressContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true); // Mặc định là true để tự động phát
  const isPlayingRef = useRef(isPlaying);
  const [isRepeat, setIsRepeat] = useState(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

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
        // Gỡ bỏ listener ngay lập tức để tránh gọi nhiều lần
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);

        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsUnlocked(true);
            // Sử dụng ref để lấy giá trị mới nhất của isPlaying
            if (!isPlayingRef.current) {
              audioRef.current?.pause();
            }
          }).catch(error => {
            const errorMessage = error.message || String(error);
            // Bỏ qua lỗi do bị ngắt quãng (AbortError) hoặc các biến thể của nó
            if (
              error.name === 'AbortError' || 
              errorMessage.toLowerCase().includes('interrupted') ||
              errorMessage.toLowerCase().includes('pause()')
            ) {
              return;
            }

            if (audioRef.current?.src) {
              console.error("Unlock error:", error);
              // Nếu lỗi khác (ví dụ: mạng), vẫn thử gán lại listener để người dùng click lại
              window.addEventListener('click', unlockAudio);
              window.addEventListener('touchstart', unlockAudio, { passive: true });
            } else {
              setIsUnlocked(true);
            }
          });
        }
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [isUnlocked]);

  const currentTrack = playlist.find(t => t.id === currentTrackId) || null;

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => {
          const errorMessage = error.message || String(error);
          if (
            error.name !== 'AbortError' && 
            !errorMessage.toLowerCase().includes('interrupted') &&
            !errorMessage.toLowerCase().includes('pause()')
          ) {
            console.error("Toggle play error:", error);
          }
        });
      }
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

  const setVolume = (v: number) => setVolumeState(v);

  const musicState = React.useMemo(() => ({
    playlist, currentTrack, isPlaying, isRepeat, isUnlocked, volume,
    togglePlay, playNext, playPrev, toggleRepeat, seekTo, setVolume, audioRef
  }), [playlist, currentTrack, isPlaying, isRepeat, isUnlocked, volume]);

  const musicProgress = React.useMemo(() => ({
    currentTime, duration
  }), [currentTime, duration]);

  return (
    <MusicContext.Provider value={musicState}>
      <MusicProgressContext.Provider value={musicProgress}>
        {children}
        <audio 
          ref={audioRef} 
          src={currentTrack?.music_url}
          onEnded={() => isRepeat ? audioRef.current?.play() : playNext()} 
          preload="auto"
        />
      </MusicProgressContext.Provider>
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within a MusicProvider');
  return context;
};

export const useMusicProgress = () => {
  const context = useContext(MusicProgressContext);
  if (!context) throw new Error('useMusicProgress must be used within a MusicProvider');
  return context;
};
