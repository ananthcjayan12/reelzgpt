import { v4 as uuidv4 } from 'uuid';
import { Project, Scene, YouTubeDetails, ProgressStatus, ProcessingError as ProcessingErrorClass } from '@/types';
import { generateScenesAndDetails, generateAudio } from './openai';
import { generateImage, generateThumbnail, downloadImage } from './replicate';
import { VideoProcessor } from './video';
import { useProjectStore } from '@/lib/store';
import { FileSystemService } from './filesystem';

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

export class ProjectService {
  private videoProcessor: VideoProcessor;
  private fileSystem: FileSystemService;

  constructor() {
    this.videoProcessor = new VideoProcessor(this.updateProgress);
    this.fileSystem = new FileSystemService();
  }

  /**
   * Updates the progress status in the store
   */
  private updateProgress = (progress: number) => {
    const { setProgress } = useProjectStore.getState();
    setProgress({
      stage: 'video-processing',
      progress,
      message: `Processing video: ${Math.round(progress * 100)}%`
    });
  };

  /**
   * Creates a new project from a YouTube URL
   */
  async createProject(youtubeUrl: string, videoFormat: 'landscape' | 'reel'): Promise<Project> {
    const { createProject, setProcessing, setProgress, setError } = useProjectStore.getState();
    
    try {
      setProcessing(true);
      
      // Create initial project
      const project = createProject(youtubeUrl, videoFormat);
      return project;
    } catch (error: any) {
      setError({
        stage: 'project-creation',
        message: error.message,
        details: error,
        timestamp: new Date(),
      });
      throw error;
    } finally {
      setProcessing(false);
    }
  }

  /**
   * Generates scenes and details from transcription
   */
  async generateScenes(transcription: string): Promise<{ scenes: Scene[]; youtubeDetails: YouTubeDetails }> {
    const { setScenes, setYouTubeDetails, setProcessing, setProgress, setError } = useProjectStore.getState();
    
    try {
      setProcessing(true);
      setProgress({
        stage: 'scene-generation',
        progress: 0,
        message: 'Generating scenes and narration...'
      });

      const { scenes, youtubeDetails } = await generateScenesAndDetails(transcription);
      
      setScenes(scenes);
      setYouTubeDetails(youtubeDetails);
      
      setProgress({
        stage: 'scene-generation',
        progress: 1,
        message: 'Scene generation complete'
      });

      return { scenes, youtubeDetails };
    } catch (error: any) {
      setError({
        stage: 'scene-generation',
        message: error.message,
        details: error,
        timestamp: new Date(),
      });
      throw error;
    } finally {
      setProcessing(false);
    }
  }

  /**
   * Processes all scenes to generate audio and images
   */
  async processScenes(scenes: Scene[]): Promise<void> {
    const { updateScene, setProcessing, setProgress, setError } = useProjectStore.getState();
    
    try {
      setProcessing(true);
      
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        
        // Update progress
        setProgress({
          stage: 'scene-processing',
          progress: i / scenes.length,
          message: `Processing scene ${i + 1} of ${scenes.length}`
        });

        // Generate audio
        const audio = await generateAudio(scene.narration);
        const audioPath = await this.fileSystem.saveFile(audio, `scene-${scene.id}-audio.mp3`, 'audio');
        updateScene(scene.id, { audioPath });

        // Generate image
        const imageUrl = await generateImage(scene.imagePrompt);
        const image = await downloadImage(imageUrl);
        const imagePath = await this.fileSystem.saveFile(image, `scene-${scene.id}-image.png`, 'image');
        updateScene(scene.id, { imagePath });
      }

      setProgress({
        stage: 'scene-processing',
        progress: 1,
        message: 'Scene processing complete'
      });
    } catch (error: any) {
      setError({
        stage: 'scene-processing',
        message: error.message,
        details: error,
        timestamp: new Date(),
      });
      throw error;
    } finally {
      setProcessing(false);
    }
  }

  /**
   * Generates the final video from processed scenes
   */
  async generateVideo(scenes: Scene[], project: Project): Promise<Blob> {
    try {
      console.log('[ProjectService] Generating video from scenes');
      
      // Sort scenes by order
      const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);
      
      // Create a canvas for rendering
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Set canvas dimensions based on project format
      const isReel = project.videoFormat === 'reel';
      canvas.width = isReel ? 1080 : 1920;
      canvas.height = isReel ? 1920 : 1080;
      
      // Create a MediaRecorder to capture the canvas
      const stream = canvas.captureStream(30); // 30 FPS
      
      // Create an audio context for mixing audio
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();
      
      // Add the audio destination to the stream tracks
      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);
      
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000 // 5 Mbps
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      // Create a promise that resolves when recording is complete
      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: 'video/webm' });
          resolve(videoBlob);
        };
      });
      
      // Start recording
      mediaRecorder.start();
      
      // Process each scene
      for (const scene of sortedScenes) {
        if (!scene.imagePath || !scene.audioPath) {
          console.warn(`[ProjectService] Scene ${scene.id} is missing image or audio, skipping`);
          continue;
        }
        
        // Load image
        const image = await this.loadImage(scene.imagePath);
        
        // Load audio
        const audio = await this.loadAudio(scene.audioPath);
        
        // Get audio duration
        const audioDuration = audio.duration;
        
        // Draw image on canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate image position to center it
        const aspectRatio = image.width / image.height;
        let drawWidth, drawHeight, drawX, drawY;
        
        if (isReel) {
          // For vertical video (9:16)
          if (aspectRatio > 1) {
            // Landscape image in vertical video
            drawHeight = canvas.height;
            drawWidth = drawHeight * aspectRatio;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = 0;
          } else {
            // Portrait image in vertical video
            drawWidth = canvas.width;
            drawHeight = drawWidth / aspectRatio;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
          }
        } else {
          // For landscape video (16:9)
          if (aspectRatio > 16/9) {
            // Wider image in landscape video
            drawWidth = canvas.width;
            drawHeight = drawWidth / aspectRatio;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
          } else {
            // Taller image in landscape video
            drawHeight = canvas.height;
            drawWidth = drawHeight * aspectRatio;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = 0;
          }
        }
        
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        
        // Connect audio to the media stream
        const audioSource = audioContext.createMediaElementSource(audio);
        audioSource.connect(audioDestination);
        
        // Add subtitles if available
        if (scene.subtitles?.segments?.length) {
          // Play audio and render subtitles
          await this.renderSceneWithSubtitles(audio, scene.subtitles.segments, ctx, canvas, audioDuration);
        } else {
          // Just play audio without subtitles
          await this.playAudioAndWait(audio, audioDuration);
        }
        
        // Disconnect audio source after playing
        audioSource.disconnect();
      }
      
      // Stop recording
      mediaRecorder.stop();
      
      // Wait for recording to complete
      return await recordingPromise;
    } catch (error: any) {
      console.error('[ProjectService] Video generation error:', error);
      throw new ProcessingError({
        stage: 'video-generation',
        message: `Failed to generate video: ${error.message}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Load an image from the file system
   */
  private async loadImage(imagePath: string): Promise<HTMLImageElement> {
    try {
      const imageBlob = await this.fileSystem.readFile(imagePath, 'image');
      const imageUrl = URL.createObjectURL(imageBlob);
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve(img);
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        img.src = imageUrl;
      });
    } catch (error: any) {
      console.error('[ProjectService] Error loading image:', error);
      throw new ProcessingError({
        stage: 'image-loading',
        message: `Failed to load image: ${error.message}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Load an audio file from the file system
   */
  private async loadAudio(audioPath: string): Promise<HTMLAudioElement> {
    try {
      const audioBlob = await this.fileSystem.readFile(audioPath, 'audio');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.oncanplaythrough = () => {
          resolve(audio);
        };
        audio.onerror = () => {
          reject(new Error('Failed to load audio'));
        };
        audio.src = audioUrl;
      });
    } catch (error: any) {
      console.error('[ProjectService] Error loading audio:', error);
      throw new ProcessingError({
        stage: 'audio-loading',
        message: `Failed to load audio: ${error.message}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Play audio and wait for it to complete
   */
  private async playAudioAndWait(audio: HTMLAudioElement, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // Start playing audio
      audio.play().catch(err => console.error('Error playing audio:', err));
      
      // Function to check if audio has finished
      const checkAudioProgress = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        
        if (elapsed >= duration) {
          audio.pause();
          audio.currentTime = 0;
          resolve();
        } else {
          requestAnimationFrame(checkAudioProgress);
        }
      };
      
      requestAnimationFrame(checkAudioProgress);
    });
  }

  /**
   * Render a scene with subtitles
   */
  private async renderSceneWithSubtitles(
    audio: HTMLAudioElement, 
    subtitles: { id: number; start: number; end: number; text: string }[],
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let currentTime = 0;
      let animationFrameId: number;
      
      // Start playing audio
      audio.play().catch(err => console.error('Error playing audio:', err));
      
      // Render function for animation
      const render = () => {
        // Calculate current time in seconds
        currentTime = (Date.now() - startTime) / 1000;
        
        // Find current subtitle
        const currentSubtitle = subtitles.find(
          subtitle => currentTime >= subtitle.start && currentTime <= subtitle.end
        );
        
        // Clear subtitle area (full width, bottom 20% of the canvas)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, canvas.height - canvas.height * 0.2, canvas.width, canvas.height * 0.2);
        
        // Draw subtitle if available
        if (currentSubtitle) {
          // Calculate progress through the current subtitle (0 to 1)
          const subtitleDuration = currentSubtitle.end - currentSubtitle.start;
          const subtitleProgress = (currentTime - currentSubtitle.start) / subtitleDuration;
          
          // Split text into words
          const words = currentSubtitle.text.split(/\s+/);
          
          // TikTok-style: Show only a few words at a time
          // Calculate which word should be the focus based on progress
          const focusWordIndex = Math.min(Math.floor(subtitleProgress * words.length), words.length - 1);
          
          // Get the words to display (current word and next word if available)
          const displayWords = [];
          
          // Add up to 2 words before the focus word
          for (let i = Math.max(0, focusWordIndex - 2); i < focusWordIndex; i++) {
            displayWords.push({
              text: words[i],
              highlighted: false
            });
          }
          
          // Add the focus word
          displayWords.push({
            text: words[focusWordIndex],
            highlighted: true
          });
          
          // Add the next word if available
          if (focusWordIndex + 1 < words.length) {
            displayWords.push({
              text: words[focusWordIndex + 1],
              highlighted: false
            });
          }
          
          // Style for subtitles
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Calculate the total text to display
          const displayText = displayWords.map(w => w.text).join(' ');
          
          // Draw background for better readability
          const fontSize = Math.min(canvas.width * 0.05, 48); // Responsive font size
          ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
          const textMetrics = ctx.measureText(displayText);
          const textWidth = textMetrics.width + 40; // Add padding
          const textHeight = fontSize * 1.5;
          const textX = canvas.width / 2 - textWidth / 2;
          const textY = canvas.height - canvas.height * 0.1 - textHeight / 2;
          
          // Draw rounded rectangle background
          const radius = 10;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.moveTo(textX + radius, textY);
          ctx.lineTo(textX + textWidth - radius, textY);
          ctx.quadraticCurveTo(textX + textWidth, textY, textX + textWidth, textY + radius);
          ctx.lineTo(textX + textWidth, textY + textHeight - radius);
          ctx.quadraticCurveTo(textX + textWidth, textY + textHeight, textX + textWidth - radius, textY + textHeight);
          ctx.lineTo(textX + radius, textY + textHeight);
          ctx.quadraticCurveTo(textX, textY + textHeight, textX, textY + textHeight - radius);
          ctx.lineTo(textX, textY + radius);
          ctx.quadraticCurveTo(textX, textY, textX + radius, textY);
          ctx.closePath();
          ctx.fill();
          
          // Draw each word
          let xPos = canvas.width / 2 - textMetrics.width / 2;
          const yPos = canvas.height - canvas.height * 0.1;
          
          displayWords.forEach((word, index) => {
            // Set font based on highlight status
            if (word.highlighted) {
              ctx.fillStyle = '#FF5C5C'; // TikTok-style highlight color
              ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
            } else {
              ctx.fillStyle = '#FFFFFF';
              ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
            }
            
            // Measure this word
            const wordWidth = ctx.measureText(word.text).width;
            
            // Draw word
            ctx.fillText(word.text, xPos + wordWidth / 2, yPos);
            
            // Move position for next word
            xPos += wordWidth + ctx.measureText(' ').width;
          });
          
          // Add progress indicator at the bottom
          const progressBarHeight = 4;
          const progressBarWidth = canvas.width * 0.6;
          const progressBarX = (canvas.width - progressBarWidth) / 2;
          const progressBarY = canvas.height - 20;
          
          // Background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
          
          // Progress
          ctx.fillStyle = '#FF5C5C';
          ctx.fillRect(progressBarX, progressBarY, progressBarWidth * subtitleProgress, progressBarHeight);
        }
        
        // Check if we should continue animation
        if (currentTime < duration) {
          animationFrameId = requestAnimationFrame(render);
        } else {
          // Stop audio and animation
          audio.pause();
          audio.currentTime = 0;
          cancelAnimationFrame(animationFrameId);
          resolve();
        }
      };
      
      // Start animation
      animationFrameId = requestAnimationFrame(render);
    });
  }

  /**
   * Generates a thumbnail for the video
   */
  async generateVideoThumbnail(youtubeDetails: YouTubeDetails): Promise<string> {
    try {
      const thumbnailUrl = await generateThumbnail(
        youtubeDetails.thumbnailPrompt,
        youtubeDetails.thumbnailTitle
      );
      const thumbnail = await downloadImage(thumbnailUrl);
      const thumbnailPath = await this.fileSystem.saveFile(thumbnail, `thumbnail-${Date.now()}.png`, 'image');
      return thumbnailPath;
    } catch (error: any) {
      const { setError } = useProjectStore.getState();
      setError({
        stage: 'thumbnail-generation',
        message: error.message,
        details: error,
        timestamp: new Date(),
      });
      throw error;
    }
  }
} 