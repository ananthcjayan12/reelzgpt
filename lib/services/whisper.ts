import { ProcessingError as ProcessingErrorClass } from '@/types';
import { useSettingsStore } from '@/lib/store/settings';

// Create a proper error class
class ProcessingError extends Error {
  stage: string;
  timestamp: Date;

  constructor({ stage, message, timestamp }: { stage: string; message: string; timestamp: Date }) {
    super(message);
    this.stage = stage;
    this.timestamp = timestamp;
    this.name = 'ProcessingError';
  }
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperTranscriptionResult {
  text: string;
  segments: {
    id: number;
    start: number;
    end: number;
    text: string;
    confidence: number;
    words?: WhisperWord[];
  }[];
  words?: WhisperWord[];
}

export interface SubtitleSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
}

/**
 * Transcribe audio using OpenAI's Whisper API
 * @param audioBlob The audio blob to transcribe
 * @returns A promise that resolves to the transcription result
 */
export async function transcribeAudio(audioBlob: Blob): Promise<WhisperTranscriptionResult> {
  try {
    console.log('[WhisperService] Transcribing audio...');
    
    // Get API key from settings store
    const settings = useSettingsStore.getState();
    const apiKey = settings.openaiApiKey;
    
    if (!apiKey) {
      throw new Error('OpenAI API key is not set. Please configure it in settings.');
    }
    
    // Create form data for the API request
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    
    // Important: Use array format for timestamp_granularities
    formData.append('timestamp_granularities[]', 'word');
    
    // Make the API request
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Whisper API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const result = await response.json();
    console.log('[WhisperService] Transcription successful');
    
    // Log the full response structure to debug
    console.log('[WhisperService] Raw API response:', JSON.stringify(result, null, 2));
    
    // Check if the response has the expected structure
    if (!result.text) {
      throw new Error('Invalid response from Whisper API: Missing text field');
    }
    
    // Process the result to include word-level timestamps
    const processedResult: WhisperTranscriptionResult = {
      text: result.text,
      segments: []
    };
    
    // Check if segments exist before mapping
    if (result.segments && Array.isArray(result.segments)) {
      processedResult.segments = result.segments.map((segment: any) => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        confidence: segment.confidence,
        words: segment.words || [] // Include word-level timestamps if available
      }));
    } else {
      console.warn('[WhisperService] No segments found in Whisper response, creating a single segment');
      // Create a single segment if none exist
      processedResult.segments = [{
        id: 0,
        start: 0,
        end: 30, // Assume 30 seconds if we don't know
        text: result.text,
        confidence: 1.0
      }];
    }
    
    // Add global words if available
    if (result.words && Array.isArray(result.words)) {
      processedResult.words = result.words;
      
      // If we have global words but no segments with words, add words to the first segment
      if (processedResult.segments.length > 0 && 
          (!processedResult.segments[0].words || processedResult.segments[0].words.length === 0)) {
        processedResult.segments[0].words = result.words;
      }
      
      console.log('[WhisperService] Word-level timestamps received:', result.words.length);
      console.log('[WhisperService] Sample words:', result.words.slice(0, 3));
    } else {
      console.warn('[WhisperService] No word-level timestamps found in response');
    }
    
    return processedResult;
  } catch (error: any) {
    console.error('[WhisperService] Transcription error:', error);
    throw new ProcessingError({
      stage: 'audio-transcription',
      message: `Failed to transcribe audio: ${error.message}`,
      timestamp: new Date()
    });
  }
}

/**
 * Generate timestamped subtitles in SRT format
 * @param transcription The Whisper transcription result
 * @returns SRT formatted subtitles
 */
export function generateSRT(transcription: WhisperTranscriptionResult): string {
  return transcription.segments.map((segment, index) => {
    // Format start and end times as HH:MM:SS,mmm
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const milliseconds = Math.floor((seconds % 1) * 1000);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
    };
    
    return `${index + 1}
${formatTime(segment.start)} --> ${formatTime(segment.end)}
${segment.text.trim()}
`;
  }).join('\n');
}

/**
 * Generate timestamped subtitles in VTT format
 * @param transcription The Whisper transcription result
 * @returns WebVTT formatted subtitles
 */
export function generateVTT(transcription: WhisperTranscriptionResult): string {
  const header = 'WEBVTT\n\n';
  
  const cues = transcription.segments.map((segment, index) => {
    // Format start and end times as HH:MM:SS.mmm
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const milliseconds = Math.floor((seconds % 1) * 1000);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    };
    
    return `${index + 1}
${formatTime(segment.start)} --> ${formatTime(segment.end)}
${segment.text.trim()}`;
  }).join('\n\n');
  
  return header + cues;
}

/**
 * Convert Whisper transcription to subtitle segments for rendering
 * @param transcription The Whisper transcription result
 * @returns Array of subtitle segments
 */
export function getSubtitleSegments(transcription: WhisperTranscriptionResult): SubtitleSegment[] {
  return transcription.segments.map(segment => ({
    id: segment.id,
    start: segment.start,
    end: segment.end,
    text: segment.text.trim(),
    words: segment.words || [] // Include word-level timestamps if available
  }));
}