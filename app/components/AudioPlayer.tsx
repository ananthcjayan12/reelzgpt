'use client';

import React, { useEffect, useState } from 'react';

interface AudioPlayerProps {
  audioBlob: Blob;
}

export function AudioPlayer({ audioBlob }: AudioPlayerProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
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