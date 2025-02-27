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
  const [words, setWords] = useState<{ text: string; highlighted: boolean }[]>([]);
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
      setWords([]);
      return;
    }

    // Calculate progress through the current subtitle (0 to 1)
    const subtitleDuration = activeSubtitle.end - activeSubtitle.start;
    const subtitleProgress = (currentTime - activeSubtitle.start) / subtitleDuration;
    
    // Split text into words
    const allWords = activeSubtitle.text.split(/\s+/);
    
    // Determine how many words should be highlighted based on progress
    const highlightedWordCount = Math.ceil(allWords.length * subtitleProgress);
    
    // Create array of words with highlight status
    const processedWords = allWords.map((word, index) => ({
      text: word,
      highlighted: index < highlightedWordCount
    }));
    
    setWords(processedWords);
  }, [activeSubtitle, currentTime]);

  // Apply different styles based on the selected style
  const getContainerStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth,
      textAlign: 'center',
      padding: '0.5rem 1rem',
      borderRadius: '0.5rem',
      transition: 'all 0.2s ease-in-out',
      opacity: activeSubtitle ? 1 : 0
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
    
    // Style-specific customizations
    if (style === 'tiktok') {
      baseStyle.backgroundColor = backgroundColor;
      baseStyle.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
      baseStyle.padding = '0.75rem 1.25rem';
    } else if (style === 'minimal') {
      baseStyle.backgroundColor = 'transparent';
      baseStyle.textShadow = '0 2px 4px rgba(0, 0, 0, 0.5)';
    } else if (style === 'caption') {
      baseStyle.backgroundColor = 'transparent';
      baseStyle.textShadow = '0 1px 2px rgba(0, 0, 0, 0.8)';
      baseStyle.maxWidth = '80%';
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

  if (!activeSubtitle) {
    return null;
  }

  return (
    <div ref={containerRef} style={getContainerStyle()}>
      {words.map((word, index) => (
        <span key={index} style={getWordStyle(word.highlighted)}>
          {word.text}
        </span>
      ))}
    </div>
  );
} 