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

interface WhisperTranscriptionResult {
  text: string;
  segments: {
    id: number;
    start: number;
    end: number;
    text: string;
    confidence: number;
  }[];
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
    
    return {
      text: result.text,
      segments: result.segments.map((segment: any) => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        confidence: segment.confidence
      }))
    };
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

export interface SubtitleSegment {
  id: number;
  start: number;
  end: number;
  text: string;
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
    text: segment.text.trim()
  }));
}