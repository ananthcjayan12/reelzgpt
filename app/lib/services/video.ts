import { ProcessingError } from '../types/errors';
import { Scene } from '@/types';
import { CreateFFmpegOptions } from '@ffmpeg/ffmpeg';

export class VideoProcessor {
  private ffmpeg: any;
  private progressCallback?: (progress: number) => void;
  private isInitialized: boolean = false;

  constructor(onProgress?: (progress: number) => void) {
    this.progressCallback = onProgress;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      if (typeof window === 'undefined') {
        throw new Error('FFmpeg can only be run in the browser');
      }

      const { createFFmpeg } = await import('@ffmpeg/ffmpeg');
      
      const config: CreateFFmpegOptions = {
        log: true,
        progress: ({ ratio }: { ratio: number }) => {
          if (this.progressCallback) {
            this.progressCallback(ratio);
          }
        },
        corePath: '/ffmpeg/ffmpeg-core.js'
      };

      this.ffmpeg = createFFmpeg(config);

      await this.ffmpeg.load();
      this.isInitialized = true;
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('Error initializing FFmpeg:', error);
      throw new ProcessingError({
        stage: 'initialization',
        message: 'Failed to initialize FFmpeg',
        timestamp: new Date(),
      });
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  async createVideoSegment(imageBuffer: Buffer, audioBlob: Blob, outputName: string, duration: number) {
    try {
      await this.ensureInitialized();
      
      // Write the image file to memory
      this.ffmpeg.FS('writeFile', 'image.png', new Uint8Array(imageBuffer));

      // Convert audio blob to buffer and write to memory
      const audioArrayBuffer = await audioBlob.arrayBuffer();
      this.ffmpeg.FS('writeFile', 'audio.mp3', new Uint8Array(audioArrayBuffer));

      // Create video from image and audio
      await this.ffmpeg.run(
        // Input image
        '-loop', '1',
        '-i', 'image.png',
        // Input audio
        '-i', 'audio.mp3',
        // Video settings
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        '-t', duration.toString(),
        outputName
      );

      // Read the output file
      const data = this.ffmpeg.FS('readFile', outputName);

      // Clean up
      this.ffmpeg.FS('unlink', 'image.png');
      this.ffmpeg.FS('unlink', 'audio.mp3');
      this.ffmpeg.FS('unlink', outputName);

      return Buffer.from(data.buffer);
    } catch (error) {
      throw new ProcessingError({
        stage: 'segment_creation',
        message: `Failed to create video segment: ${error}`,
        timestamp: new Date(),
      });
    }
  }

  async concatenateVideos(videoBuffers: Buffer[], outputName: string) {
    try {
      await this.ensureInitialized();
      
      // Write each video buffer to the virtual filesystem
      const inputFiles = videoBuffers.map((buffer, index) => {
        const filename = `input${index}.mp4`;
        this.ffmpeg.FS('writeFile', filename, new Uint8Array(buffer));
        return filename;
      });

      // Create a concat file
      const concatContent = inputFiles.map(file => `file '${file}'`).join('\n');
      this.ffmpeg.FS('writeFile', 'concat.txt', new TextEncoder().encode(concatContent));

      // Concatenate videos
      await this.ffmpeg.run(
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        outputName
      );

      // Read the result
      const data = this.ffmpeg.FS('readFile', outputName);

      // Clean up
      inputFiles.forEach(file => this.ffmpeg.FS('unlink', file));
      this.ffmpeg.FS('unlink', 'concat.txt');
      this.ffmpeg.FS('unlink', outputName);

      return Buffer.from(data.buffer);
    } catch (error) {
      throw new ProcessingError({
        stage: 'concatenation',
        message: `Failed to concatenate videos: ${error}`,
        timestamp: new Date(),
      });
    }
  }

  async processCompleteVideo(segments: Buffer[]) {
    try {
      await this.ensureInitialized();
      
      // Concatenate all segments into final video
      const finalVideo = await this.concatenateVideos(segments, 'output.mp4');
      return finalVideo;
    } catch (error) {
      throw new ProcessingError({
        stage: 'complete_processing',
        message: `Failed to process complete video: ${error}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Process a complete video from scenes with audio and images
   */
  async processVideo(scenes: Scene[]): Promise<Blob> {
    try {
      await this.ensureInitialized();
      
      // Convert scenes to video segments sequentially
      const segments = [];
      for (const scene of scenes) {
        if (!scene.audio || !scene.image) {
          throw new ProcessingError({
            stage: 'video-processing',
            message: `Missing audio or image for scene ${scene.order}`,
            timestamp: new Date(),
          });
        }

        // Get image buffer
        const imageBuffer = await fetch(scene.image).then(res => res.arrayBuffer());
        
        // Get audio as blob
        let audioBlob: Blob;
        if (typeof scene.audio === 'string') {
          // If audio is a data URL, fetch it first
          const response = await fetch(scene.audio);
          audioBlob = await response.blob();
        } else {
          audioBlob = scene.audio;
        }

        // Get audio duration
        const audioDuration = await this.getAudioDuration(audioBlob);
        if (!audioDuration) {
          throw new ProcessingError({
            stage: 'video-processing',
            message: `Could not determine audio duration for scene ${scene.order}`,
            timestamp: new Date(),
          });
        }

        // Create video segment
        const segment = await this.createVideoSegment(
          Buffer.from(imageBuffer),
          audioBlob,
          `segment${segments.length}.mp4`,
          audioDuration
        );
        segments.push(segment);
      }

      // Concatenate all segments
      const finalVideoBuffer = await this.concatenateVideos(segments, 'output.mp4');
      return new Blob([finalVideoBuffer], { type: 'video/mp4' });
    } catch (error: any) {
      throw new ProcessingError({
        stage: 'video-processing',
        message: error.message || 'Failed to process video',
        timestamp: new Date(),
      });
    }
  }

  private getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio();
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(audioUrl);
        resolve(audio.duration);
      });

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Failed to load audio'));
      });

      audio.src = audioUrl;
    });
  }
} 