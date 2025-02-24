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

  async createVideoSegment(inputBuffer: Buffer, outputName: string, startTime: number, duration: number) {
    try {
      await this.ensureInitialized();
      
      // Write the input file to memory
      this.ffmpeg.FS('writeFile', 'input.mp4', new Uint8Array(inputBuffer));

      // Run FFmpeg command
      await this.ffmpeg.run(
        '-i', 'input.mp4',
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-c', 'copy',
        outputName
      );

      // Read the output file
      const data = this.ffmpeg.FS('readFile', outputName);

      // Clean up
      this.ffmpeg.FS('unlink', 'input.mp4');
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

  async processCompleteVideo(scenes: { buffer: Buffer; duration: number }[]) {
    try {
      await this.ensureInitialized();
      
      const segments = await Promise.all(
        scenes.map(async (scene, index) => {
          return this.createVideoSegment(
            scene.buffer,
            `segment${index}.mp4`,
            0,
            scene.duration
          );
        })
      );

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
      
      // Convert scenes to video segments
      const segments = await Promise.all(
        scenes.map(async (scene) => {
          if (!scene.audio || !scene.image) {
            throw new ProcessingError({
              stage: 'video-processing',
              message: `Missing audio or image for scene ${scene.order}`,
              timestamp: new Date(),
            });
          }

          // Create video segment from image and audio
          const imageBuffer = await fetch(scene.image).then(res => res.arrayBuffer());
          const audioBuffer = await scene.audio.arrayBuffer();

          return {
            buffer: Buffer.from(imageBuffer),
            duration: scene.audio.size / 16000 // Approximate duration based on audio size
          };
        })
      );

      // Process the complete video
      const finalVideoBuffer = await this.processCompleteVideo(segments);
      return new Blob([finalVideoBuffer], { type: 'video/mp4' });
    } catch (error: any) {
      throw new ProcessingError({
        stage: 'video-processing',
        message: error.message || 'Failed to process video',
        timestamp: new Date(),
      });
    }
  }
} 