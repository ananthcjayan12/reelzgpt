'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FileSystemService } from '@/lib/services/filesystem';

interface AudioPlayerProps {
  audioPath: string;
}

export function AudioPlayer({ audioPath }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileSystem = new FileSystemService();

  useEffect(() => {
    let isMounted = true;

    const loadAudio = async () => {
      try {
        setIsLoading(true);
        console.log('[AudioPlayer] Starting to load audio from ID:', audioPath);
        
        const audioBlob = await fileSystem.readFile(audioPath, 'audio');
        console.log('[AudioPlayer] Loaded audio blob:', {
          type: audioBlob.type,
          size: audioBlob.size
        });

        if (isMounted) {
          // Ensure the blob has the correct MIME type
          const blob = new Blob([audioBlob], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          console.log('[AudioPlayer] Created audio URL:', url);
          setAudioUrl(url);
          setError(null);
        }
      } catch (error: any) {
        console.error('[AudioPlayer] Failed to load audio:', error);
        if (isMounted) {
          setError(`Failed to load audio: ${error.message}`);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (audioPath) {
      loadAudio();
    }

    return () => {
      isMounted = false;
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioPath]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      console.log('[AudioPlayer] Audio duration loaded:', audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    const handleError = (e: Event) => {
      console.error('[AudioPlayer] Audio element error:', e);
      setError('Failed to play audio');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(error => {
        console.error('[AudioPlayer] Failed to play audio:', error);
        setError('Failed to play audio');
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (isLoading) {
    return <div className="text-gray-500">Loading audio...</div>;
  }

  if (!audioUrl) {
    return <div className="text-gray-500">Audio not available</div>;
  }

  return (
    <div className="flex flex-col space-y-2">
      <audio ref={audioRef} src={audioUrl} />
      
      <div className="flex items-center space-x-2">
        <button
          onClick={togglePlayPause}
          className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600"
        >
          {isPlaying ? '⏸' : '▶️'}
        </button>
        
        <input
          type="range"
          min={0}
          max={duration}
          value={currentTime}
          onChange={handleSeek}
          className="flex-grow"
        />
        
        <span className="text-sm text-gray-600">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
} 