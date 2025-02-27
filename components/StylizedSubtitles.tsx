'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SubtitleSegment } from '@/lib/services/whisper';

interface StylizedSubtitlesProps {
  subtitles: SubtitleSegment[];
  currentTime: number;
  style?: 'tiktok' | 'minimal' | 'caption';
  position?: 'top' | 'center' | 'bottom';
  textColor?: string;
  highlightColor?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  maxWidth?: string;
}

export function StylizedSubtitles({
  subtitles,
  currentTime,
  style = 'tiktok',
  position = 'bottom',
  textColor = '#FFFFFF',
  highlightColor = '#FF5C5C',
  backgroundColor = 'rgba(0, 0, 0, 0.7)',
  fontSize = '1.5rem',
  fontFamily = 'Inter, system-ui, sans-serif',
  maxWidth = '90%'
}: StylizedSubtitlesProps) {
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleSegment | null>(null);
  const [displayWords, setDisplayWords] = useState<{ text: string; highlighted: boolean }[]>([]);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the active subtitle based on current time
  useEffect(() => {
    const active = subtitles.find(
      subtitle => currentTime >= subtitle.start && currentTime <= subtitle.end
    );
    
    if (active !== activeSubtitle) {
      setActiveSubtitle(active || null);
    }
  }, [subtitles, currentTime, activeSubtitle]);

  // Split subtitle into words and determine which ones to highlight
  useEffect(() => {
    if (!activeSubtitle) {
      setDisplayWords([]);
      setProgress(0);
      return;
    }

    // Calculate progress through the current subtitle (0 to 1)
    const subtitleDuration = activeSubtitle.end - activeSubtitle.start;
    const subtitleProgress = Math.min(1, Math.max(0, (currentTime - activeSubtitle.start) / subtitleDuration));
    setProgress(subtitleProgress);
    
    // Split text into words
    const allWords = activeSubtitle.text.split(/\s+/);
    
    // TikTok-style: Show only a few words at a time
    // Calculate which word should be the focus based on progress
    const focusWordIndex = Math.min(Math.floor(subtitleProgress * allWords.length), allWords.length - 1);
    
    // Get the words to display (current word and next word if available)
    const wordsToDisplay = [];
    
    // Add up to 2 words before the focus word
    for (let i = Math.max(0, focusWordIndex - 2); i < focusWordIndex; i++) {
      wordsToDisplay.push({
        text: allWords[i],
        highlighted: false
      });
    }
    
    // Add the focus word
    wordsToDisplay.push({
      text: allWords[focusWordIndex],
      highlighted: true
    });
    
    // Add the next word if available
    if (focusWordIndex + 1 < allWords.length) {
      wordsToDisplay.push({
        text: allWords[focusWordIndex + 1],
        highlighted: false
      });
    }
    
    setDisplayWords(wordsToDisplay);
  }, [activeSubtitle, currentTime]);

  // Apply different styles based on the selected style
  const getContainerStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth,
      textAlign: 'center',
      padding: '0.75rem 1.25rem',
      borderRadius: '0.5rem',
      transition: 'all 0.2s ease-in-out',
      opacity: activeSubtitle ? 1 : 0,
      backgroundColor
    };
    
    // Position styles
    if (position === 'top') {
      baseStyle.top = '10%';
    } else if (position === 'center') {
      baseStyle.top = '50%';
      baseStyle.transform = 'translate(-50%, -50%)';
    } else {
      baseStyle.bottom = '10%';
    }
    
    return baseStyle;
  };
  
  const getWordStyle = (highlighted: boolean): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-block',
      color: highlighted ? highlightColor : textColor,
      fontFamily,
      fontSize,
      fontWeight: highlighted ? 'bold' : 'normal',
      margin: '0 0.15rem',
      transition: 'color 0.1s ease-in-out, transform 0.1s ease-in-out'
    };
    
    if (style === 'tiktok' && highlighted) {
      baseStyle.transform = 'scale(1.05)';
    }
    
    return baseStyle;
  };

  const getProgressBarStyle = (): React.CSSProperties => {
    return {
      width: '100%',
      height: '4px',
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: '2px',
      marginTop: '0.5rem',
      overflow: 'hidden'
    };
  };

  const getProgressStyle = (): React.CSSProperties => {
    return {
      height: '100%',
      width: `${progress * 100}%`,
      backgroundColor: highlightColor,
      transition: 'width 0.1s linear'
    };
  };

  if (!activeSubtitle || displayWords.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} style={getContainerStyle()}>
      <div>
        {displayWords.map((word, index) => (
          <span key={index} style={getWordStyle(word.highlighted)}>
            {word.text}
          </span>
        ))}
      </div>
      <div style={getProgressBarStyle()}>
        <div style={getProgressStyle()} />
      </div>
    </div>
  );
} 