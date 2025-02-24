import { ProcessingError } from '../types/errors';

interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
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
    const response = await fetch(`/api/youtube/transcript?url=${encodeURIComponent(youtubeUrl)}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch transcript');
    }

    const transcriptData: TranscriptEntry[] = await response.json();
    
    // Filter out empty entries and [Music] tags, then join the text
    const transcription = transcriptData
      .filter(entry => entry.text && entry.text !== '[Music]')
      .map(entry => entry.text)
      .join(' ');

    if (!transcription) {
      throw new Error('No valid transcription found');
    }

    return transcription;
  } catch (error: any) {
    console.error('Transcription error:', error);
    throw new ProcessingError({
      stage: 'transcription',
      message: error.message || 'Failed to get video transcription',
      timestamp: new Date(),
    });
  }
}

/**
 * Gets or creates transcription with caching
 * Note: In a browser-only environment, we'll use localStorage for caching
 */
export async function getOrCreateTranscription(youtubeUrl: string): Promise<string> {
  try {
    const youtubeId = extractYouTubeId(youtubeUrl);
    const cacheKey = `transcription_${youtubeId}`;

    // Check cache first
    const cachedTranscription = localStorage.getItem(cacheKey);
    if (cachedTranscription) {
      return cachedTranscription;
    }

    // Fetch new transcription
    const transcription = await getTranscription(youtubeUrl);

    // Cache the result
    localStorage.setItem(cacheKey, transcription);

    return transcription;
  } catch (error: any) {
    throw new ProcessingError({
      stage: 'transcription',
      message: error.message || 'Failed to get or create transcription',
      timestamp: new Date(),
    });
  }
} 