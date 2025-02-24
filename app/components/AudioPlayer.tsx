'use client';

import React, { useEffect, useState } from 'react';

interface AudioPlayerProps {
  audioBlob: Blob | string;
}

export function AudioPlayer({ audioBlob }: AudioPlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!audioBlob) return;

    // If audioBlob is already a string URL, use it directly
    if (typeof audioBlob === 'string') {
      setAudioUrl(audioBlob);
      return;
    }

    // If it's a Blob, create a URL
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);

    return () => {
      if (url && typeof audioBlob !== 'string') {
        URL.revokeObjectURL(url);
      }
    };
  }, [audioBlob]);

  if (!audioUrl) return null;

  return (
    <audio controls className="w-full">
      <source src={audioUrl} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
} 