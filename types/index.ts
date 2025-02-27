// Scene represents a single segment of the video with narration and visuals
export interface Scene {
  id: string;
  narration: string;
  imagePrompt: string;
  mood: 'adventure' | 'dramatic' | 'happy' | 'romantic' | 'suspense';
  audioPath?: string;  // Path to the audio file in local storage
  imagePath?: string;  // Path to the image file in local storage
  order: number;
  subtitles?: {
    segments: {
      id: number;
      start: number;
      end: number;
      text: string;
    }[];
    format?: 'srt' | 'vtt';
    style?: 'tiktok' | 'minimal' | 'caption';
  };
  status?: {
    audioGenerated?: boolean;
    imageGenerated?: boolean;
    subtitlesGenerated?: boolean;
  };
}

// YouTubeDetails contains metadata about the source YouTube video
export interface YouTubeDetails {
  title: string;
  description: string;
  thumbnailTitle: string;
  thumbnailPrompt: string;
}

// Project represents the entire video generation project
export interface Project {
  id: string;
  title: string;
  description?: string;
  youtubeUrl: string;
  transcription: string;
  scenes: Scene[];
  youtubeDetails?: YouTubeDetails;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  videoFormat: 'landscape' | 'reel';
  createdAt: Date;
  updatedAt: Date;
}

// Progress tracking for long-running operations
export interface ProgressStatus {
  stage: 'transcription' | 'scene-generation' | 'scene-processing' | 'audio-generation' | 'image-generation' | 'video-processing';
  progress: number;
  message: string;
}

// Error handling interface
export interface ProcessingError {
  stage: string;
  message: string;
  timestamp: Date;
  details?: any;
} 