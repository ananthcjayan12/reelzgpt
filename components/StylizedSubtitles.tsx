'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SubtitleSegment } from '@/lib/services/whisper';
import { useSettingsStore } from '@/lib/store/settings';

interface DisplayWord {
  word: string;
  start: number;
  end: number;
  isFocus: boolean;
}

interface StylizedSubtitlesProps {
  subtitles?: SubtitleSegment[];
  currentTime: number;
  style?: 'default' | 'tiktok';
}

export function StylizedSubtitles({ subtitles, currentTime, style = 'default' }: StylizedSubtitlesProps) {
  const [displayWords, setDisplayWords] = useState<DisplayWord[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleSegment | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get subtitle settings from the store
  const { subtitleSettings } = useSettingsStore();
  const { highlightColor, displayWordCount, fontSize, showProgressBar } = subtitleSettings;

  useEffect(() => {
    if (!subtitles || subtitles.length === 0) {
      setDisplayWords([]);
      setActiveSubtitle(null);
      return;
    }

    // Find the active subtitle based on current time
    const active = subtitles.find(
      subtitle => currentTime >= subtitle.start && currentTime <= subtitle.end
    );

    if (!active) {
      setDisplayWords([]);
      setActiveSubtitle(null);
      return;
    }

    setActiveSubtitle(active);

    // Calculate progress through this subtitle (0-1)
    const subtitleDuration = active.end - active.start;
    const subtitleProgress = (currentTime - active.start) / subtitleDuration;
    setProgress(Math.min(Math.max(subtitleProgress, 0), 1));

    // If we have word-level timestamps, use them for precise highlighting
    if (active.words && active.words.length > 0) {
      // Find the current focus word based on timestamp
      const focusWordIndex = active.words.findIndex(
        word => currentTime >= word.start && currentTime <= word.end
      );

      // If no word is currently being spoken, find the next word
      const effectiveFocusIndex = focusWordIndex >= 0 
        ? focusWordIndex 
        : active.words.findIndex(word => word.start > currentTime);

      // Calculate how many words to show before and after the focus word
      const totalWords = displayWordCount;
      const wordsBefore = Math.floor((totalWords - 1) / 2);
      const wordsAfter = totalWords - wordsBefore - 1;
      
      // Determine which words to display around the focus word
      const startIndex = Math.max(0, effectiveFocusIndex - wordsBefore);
      const endIndex = Math.min(active.words.length, startIndex + totalWords);
      
      const wordsToDisplay = active.words
        .slice(startIndex, endIndex)
        .map((word, index) => ({
          word: word.word,
          start: word.start,
          end: word.end,
          isFocus: index + startIndex === effectiveFocusIndex
        }));

      setDisplayWords(wordsToDisplay);
    } else {
      // Fallback to splitting text if no word-level timestamps
      const words = active.text.split(/\s+/);
      
      // Estimate which word is the focus based on progress
      const estimatedFocusIndex = Math.min(
        Math.floor(words.length * subtitleProgress),
        words.length - 1
      );
      
      // Calculate how many words to show before and after the focus word
      const totalWords = Math.min(displayWordCount, words.length);
      const wordsBefore = Math.floor((totalWords - 1) / 2);
      const wordsAfter = totalWords - wordsBefore - 1;
      
      // Get a window of words around the focus word
      const startIndex = Math.max(0, estimatedFocusIndex - wordsBefore);
      const endIndex = Math.min(words.length, startIndex + totalWords);
      
      const wordsToDisplay = words
        .slice(startIndex, endIndex)
        .map((word, index) => ({
          word,
          start: active.start + (subtitleDuration * (startIndex + index) / words.length),
          end: active.start + (subtitleDuration * (startIndex + index + 1) / words.length),
          isFocus: index + startIndex === estimatedFocusIndex
        }));
      
      setDisplayWords(wordsToDisplay);
    }
  }, [subtitles, currentTime, displayWordCount]);

  if (!activeSubtitle || displayWords.length === 0) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="subtitle-container"
      style={{
        position: 'absolute',
        bottom: '10%',
        left: '0',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem',
        textAlign: 'center',
        zIndex: 10,
      }}
    >
      <div 
        className="subtitle-words"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: '1rem',
          maxWidth: '90%',
          margin: '0 auto',
        }}
      >
        {displayWords.map((word, index) => (
          <span 
            key={index}
            style={{
              color: word.isFocus ? highlightColor : 'white',
              fontWeight: word.isFocus ? 'bold' : 'normal',
              fontSize: `${fontSize}px`,
              transition: 'color 0.2s, transform 0.2s',
              transform: word.isFocus ? 'scale(1.1)' : 'scale(1)',
              display: 'inline-block',
            }}
          >
            {word.word}
          </span>
        ))}
      </div>
      
      {/* Progress bar */}
      {showProgressBar && (
        <div 
          className="subtitle-progress"
          style={{
            width: '50%',
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '2px',
            marginTop: '0.5rem',
            overflow: 'hidden',
          }}
        >
          <div 
            className="subtitle-progress-fill"
            style={{
              height: '100%',
              width: `${progress * 100}%`,
              backgroundColor: highlightColor,
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      )}
    </div>
  );
} 