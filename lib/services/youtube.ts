import { ProcessingError } from '../types/errors';

interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
}

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface YouTubeTranscription {
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  text: string;
}

/**
 * Converts any YouTube URL format to the standard watch URL format
 */
export function convertToWatchUrl(url: string): string {
  try {
    const videoId = extractYouTubeId(url);
    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch (error) {
    throw new ProcessingError({
      stage: 'url-conversion',
      message: 'Failed to convert URL to watch format',
      timestamp: new Date(),
    });
  }
}

/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
export function extractYouTubeId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new ProcessingError({
    stage: 'url-parsing',
    message: 'Invalid YouTube URL format',
    timestamp: new Date(),
  });
}

/**
 * Gets transcription for a YouTube video
 */
export async function getTranscription(youtubeUrl: string): Promise<string> {
  try {
    // Convert to watch URL format
    const watchUrl = convertToWatchUrl(youtubeUrl);
    console.log('[YouTube Service] Using watch URL:', watchUrl);

    const response = await fetch(`/api/youtube/transcript?url=${encodeURIComponent(watchUrl)}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch transcript');
    }

    const transcriptData = await response.json();
    
    // Filter out empty entries and [Music] tags, then join the text
    const transcription = transcriptData
      .filter((entry: any) => entry.text && entry.text !== '[Music]')
      .map((entry: any) => entry.text)
      .join(' ');

    if (!transcription) {
      throw new Error('No valid transcription found');
    }

    return transcription;
  } catch (error: any) {
    console.error('[YouTube Service] Transcription error:', error);
    throw new ProcessingError({
      stage: 'transcription',
      message: error.message || 'Failed to get video transcription',
      timestamp: new Date(),
    });
  }
}

/**
 * Gets or creates transcription with caching
 */
export async function getOrCreateTranscription(youtubeUrl: string): Promise<string> {
  try {
    const youtubeId = extractYouTubeId(youtubeUrl);
    console.log('[YouTube Service] Extracted YouTube ID:', youtubeId);
    
    // Convert to watch URL format
    const watchUrl = convertToWatchUrl(youtubeUrl);
    console.log('[YouTube Service] Using watch URL:', watchUrl);
    
    // Fetch transcription
    const response = await fetch(`/api/youtube/transcript?url=${encodeURIComponent(watchUrl)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.statusText}`);
    }
    
    const transcriptData = await response.json();
    console.log('[YouTube Service] Raw transcription received');

    if (!Array.isArray(transcriptData)) {
      throw new Error('Invalid transcript format: expected an array of segments');
    }

    // Just combine all text segments into a single string
    const fullText = transcriptData
      .map(segment => segment.text.trim())
      .filter(text => text && !text.includes('[Music]')) // Filter out empty and music segments
      .join(' ');

    if (!fullText) {
      throw new Error('No valid transcription text found');
    }

    console.log('[YouTube Service] Processed transcription:', {
      textLength: fullText.length,
      preview: fullText.substring(0, 100) + '...'
    });

    return fullText;
  } catch (error: any) {
    console.error('[YouTube Service] Error:', error);
    throw new ProcessingError({
      stage: 'transcription',
      message: error.message || 'Failed to get transcription',
      timestamp: new Date(),
    });
  }
}