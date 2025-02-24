// Scene represents a single segment of the video with narration and visuals
export interface Scene {
  id: string;
  narration: string;
  imagePrompt: string;
  mood: 'adventure' | 'dramatic' | 'happy' | 'romantic' | 'suspense';
  audio?: Blob;
  image?: string;
  order: number;
  status: {
    audioGenerated: boolean;
    imageGenerated: boolean;
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
  youtubeUrl: string;
  transcription: string;
  scenes: Scene[];
  youtubeDetails?: YouTubeDetails;
  status: 'draft' | 'processing' | 'completed' | 'failed';
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
  details?: any;
  timestamp: Date;
} 