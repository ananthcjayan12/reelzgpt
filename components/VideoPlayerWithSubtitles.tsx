'use client';

import React, { useEffect, useRef, useState } from 'react';
import { StylizedSubtitles } from './StylizedSubtitles';
import { SubtitleSegment, transcribeAudio } from '@/lib/services/whisper';

interface VideoPlayerWithSubtitlesProps {
  videoSrc: string;
  audioSrc?: string;
  subtitles?: SubtitleSegment[];
  autoGenerateSubtitles?: boolean;
  subtitleStyle?: 'tiktok' | 'minimal' | 'caption';
  subtitlePosition?: 'top' | 'center' | 'bottom';
  width?: string;
  height?: string;
  onSubtitlesGenerated?: (subtitles: SubtitleSegment[]) => void;
}

export function VideoPlayerWithSubtitles({
  videoSrc,
  audioSrc,
  subtitles: initialSubtitles,
  autoGenerateSubtitles = false,
  subtitleStyle = 'tiktok',
  subtitlePosition = 'bottom',
  width = '100%',
  height = 'auto',
  onSubtitlesGenerated
}: VideoPlayerWithSubtitlesProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitles, setSubtitles] = useState<SubtitleSegment[]>(initialSubtitles || []);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update current time when video plays
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  // Generate subtitles if needed
  useEffect(() => {
    if (initialSubtitles?.length || !autoGenerateSubtitles || isGeneratingSubtitles) {
      return;
    }

    const generateSubtitles = async () => {
      try {
        setIsGeneratingSubtitles(true);
        setError(null);

        // Use provided audio or extract audio from video
        let audioBlob: Blob;
        if (audioSrc) {
          const response = await fetch(audioSrc);
          audioBlob = await response.blob();
        } else {
          // Extract audio from video (this is a simplified approach)
          // In a real app, you might want to use a more robust solution like ffmpeg.wasm
          const video = videoRef.current;
          if (!video) throw new Error('Video element not found');
          
          // For demo purposes, we'll just use the video as audio
          // In a real app, you'd extract the audio track
          const response = await fetch(videoSrc);
          audioBlob = await response.blob();
        }

        // Transcribe audio using Whisper
        const transcription = await transcribeAudio(audioBlob);
        const generatedSubtitles = transcription.segments.map(segment => ({
          id: segment.id,
          start: segment.start,
          end: segment.end,
          text: segment.text.trim()
        }));

        setSubtitles(generatedSubtitles);
        if (onSubtitlesGenerated) {
          onSubtitlesGenerated(generatedSubtitles);
        }
      } catch (err: any) {
        console.error('Failed to generate subtitles:', err);
        setError(`Failed to generate subtitles: ${err.message}`);
      } finally {
        setIsGeneratingSubtitles(false);
      }
    };

    generateSubtitles();
  }, [autoGenerateSubtitles, initialSubtitles, audioSrc, videoSrc, isGeneratingSubtitles, onSubtitlesGenerated]);

  return (
    <div className="relative" style={{ width }}>
      {isGeneratingSubtitles && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
            <p>Generating subtitles...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      <div className="relative">
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          style={{ width: '100%', height }}
          className="rounded-lg"
        />
        
        {subtitles.length > 0 && (
          <StylizedSubtitles
            subtitles={subtitles}
            currentTime={currentTime}
            style={subtitleStyle}
            position={subtitlePosition}
          />
        )}
      </div>
    </div>
  );
} 