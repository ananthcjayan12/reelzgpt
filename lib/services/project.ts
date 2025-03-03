import { v4 as uuidv4 } from 'uuid';
import { Project, Scene, YouTubeDetails, ProgressStatus, ProcessingError as ProcessingErrorClass } from '@/types';
import { generateScenesAndDetails, generateAudio } from './openai';
import { generateImage, generateThumbnail, downloadImage } from './replicate';
import { VideoProcessor } from './video';
import { useProjectStore } from '@/lib/store';
import { useSettingsStore } from '@/lib/store/settings';
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
  private progressCallback: ((progress: number) => void) | null = null;
  private progressDetails: {
    currentScene?: number;
    totalScenes?: number;
    sceneProgress?: number;
  } | null = null;

  constructor() {
    this.videoProcessor = new VideoProcessor(this.updateProgress);
    this.fileSystem = new FileSystemService();
  }

  /**
   * Sets a callback function to receive progress updates directly
   */
  setProgressCallback(callback: ((progress: number) => void) | null) {
    this.progressCallback = callback;
  }

  /**
   * Gets the current progress details
   */
  getProgressDetails() {
    return this.progressDetails;
  }

  /**
   * Updates the progress status in the store
   */
  private updateProgress = (progress: number) => {
    // Call the direct callback if set
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    
    // Also update the store
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
      console.log('[ProjectService] Generating video from scenes using optimized frame-based approach');
      
      // Check if MediaRecorder is supported
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder is not supported in this browser');
      }
      
      // Check if browser is mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log(`[ProjectService] Browser environment: ${isMobile ? 'Mobile' : 'Desktop'}`);
      
      // Get subtitle settings from the store
      const { subtitleSettings } = useSettingsStore.getState();
      const { highlightColor, displayWordCount, fontSize, showProgressBar } = subtitleSettings;
      
      // Sort scenes by order
      const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);
      
      // OPTIMIZATION: Pre-load all assets in parallel
      this.updateProgress(0.05);
      console.log('[ProjectService] Pre-loading all assets in parallel');
      
      // Create arrays to store all the loaded assets
      interface SceneAsset {
        scene: Scene;
        image: HTMLImageElement | null;
        audio: HTMLAudioElement | null;
        audioDuration: number;
        success: boolean;
        frameCount?: number;
      }
      
      const sceneAssets = await Promise.all(
        sortedScenes.map(async (scene) => {
          try {
            if (!scene.imagePath || !scene.audioPath) {
              return { scene, image: null, audio: null, audioDuration: 0, success: false } as SceneAsset;
            }
            
            // Load image and audio in parallel
            const [image, audio] = await Promise.all([
              this.loadImage(scene.imagePath),
              this.loadAudio(scene.audioPath)
            ]);
            
            return {
              scene,
              image,
              audio,
              audioDuration: audio.duration,
              success: true
            } as SceneAsset;
          } catch (error) {
            console.error(`[ProjectService] Failed to load assets for scene ${scene.id}:`, error);
            return { scene, image: null, audio: null, audioDuration: 0, success: false } as SceneAsset;
          }
        })
      );
      
      // Filter out failed assets
      const validSceneAssets = sceneAssets.filter(asset => asset.success);
      
      if (validSceneAssets.length === 0) {
        throw new Error('Failed to load any scene assets');
      }
      
      console.log(`[ProjectService] Successfully loaded assets for ${validSceneAssets.length}/${sortedScenes.length} scenes`);
      this.updateProgress(0.1);
      
      // Set up canvas for rendering
      const isReel = project.videoFormat === 'reel';
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Set canvas dimensions
      canvas.width = isReel ? 1080 : 1920;
      canvas.height = isReel ? 1920 : 1080;
      
      // OPTIMIZATION: Reduce video quality on mobile for better performance
      const videoBitrate = isMobile ? 2500000 : 5000000;
      
      // Get supported MIME type
      const getSupportedMimeType = () => {
        const types = [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4'
        ];
        
        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            console.log(`[ProjectService] Using supported MIME type: ${type}`);
            return type;
          }
        }
        
        console.warn('[ProjectService] No preferred MIME types supported, using default');
        return '';
      };
      
      const selectedMimeType = getSupportedMimeType() || 'video/webm';
      
      // OPTIMIZATION: Pre-render all frames for each scene
      console.log('[ProjectService] Starting frame pre-rendering process');
      
      // Calculate total frames and duration
      const FPS = isMobile ? 20 : 30; // Lower FPS on mobile
      let totalFrames = 0;
      let totalDuration = 0;
      
      validSceneAssets.forEach(asset => {
        asset.frameCount = Math.ceil(asset.audioDuration * FPS);
        totalFrames += asset.frameCount || 0;
        totalDuration += asset.audioDuration;
      });
      
      console.log(`[ProjectService] Total video will be ${totalDuration.toFixed(2)} seconds (${totalFrames} frames)`);
      
      // Create a MediaRecorder
      const stream = canvas.captureStream(FPS);
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();
      
      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);
      
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: videoBitrate
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
          const videoBlob = new Blob(chunks, { type: selectedMimeType });
          console.log(`[ProjectService] Video generation complete, created ${videoBlob.size} byte video`);
          resolve(videoBlob);
        };
      });
      
      // Start recording
      mediaRecorder.start(1000);
      console.log('[ProjectService] Started media recorder');
      
      // OPTIMIZATION: Pre-render frames for each scene
      let frameIndex = 0;
      
      // Create a function to render a specific frame
      const renderFrame = (asset: SceneAsset, frameNumber: number, actualAudioTime: number) => {
        if (!asset.image) return;
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the image
        const imageAspectRatio = asset.image.width / asset.image.height;
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imageAspectRatio > canvas.width / canvas.height) {
          // Image is wider than canvas (relative to their heights)
          drawHeight = canvas.height;
          drawWidth = drawHeight * imageAspectRatio;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        } else {
          // Image is taller than canvas (relative to their widths)
          drawWidth = canvas.width;
          drawHeight = drawWidth / imageAspectRatio;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        }
        
        ctx.drawImage(asset.image, offsetX, offsetY, drawWidth, drawHeight);
        
        // Use the actual audio time instead of calculating from frame number
        const currentTime = actualAudioTime;
        
        // Get subtitle settings
        const subtitleSettings = useSettingsStore.getState().subtitleSettings;
        const fontSize = subtitleSettings.fontSize || 32;
        
        // Find the subtitle segments for this scene
        const subtitles = asset.scene.subtitles;
        if (!subtitles || !subtitles.segments || subtitles.segments.length === 0) {
          return;
        }
        
        // Extract all words with their timing data
        const allWords: {word: string, start: number, end: number}[] = [];
        
        // Flatten all words from all segments
        subtitles.segments.forEach(segment => {
          const segmentWithWords = segment as {
            words?: Array<{ word: string; start: number; end: number }>;
          };
          
          if (segmentWithWords.words) {
            segmentWithWords.words.forEach(word => {
              allWords.push({
                word: word.word,
                start: word.start,
                end: word.end
              });
            });
          }
        });
        
        if (allWords.length === 0) {
          return; // No words with timing data
        }
        
        // Find all words that should be visible at the current time
        const visibleWords = allWords.filter(word => 
          currentTime >= word.start && currentTime <= word.end + 0.3 // Add small buffer
        );
        
        if (visibleWords.length === 0) {
          // If no words are exactly at this time, show the most recent word
          let mostRecentWord = allWords[0];
          let smallestTimeDiff = Number.MAX_VALUE;
          
          for (const word of allWords) {
            if (word.start <= currentTime) {
              const timeDiff = currentTime - word.start;
              if (timeDiff < smallestTimeDiff) {
                smallestTimeDiff = timeDiff;
                mostRecentWord = word;
              }
            }
          }
          
          visibleWords.push(mostRecentWord);
        }
        
        // Create the text to display
        const displayText = visibleWords.map(w => w.word).join(' ');
        
        // Set up text rendering
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        // Calculate text position (centered at bottom of canvas with padding)
        const textX = canvas.width / 2;
        const textY = canvas.height - 20; // 20px padding from bottom
        
        // Measure text for background
        const textMetrics = ctx.measureText(displayText);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        // Draw semi-transparent background for better readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(
          textX - textWidth / 2 - 10,
          textY - textHeight - 10,
          textWidth + 20,
          textHeight + 20
        );
        
        // Draw the text
        ctx.fillStyle = 'white';
        ctx.fillText(displayText, textX, textY);
        
        // Add debugging information
        if (frameNumber % 30 === 0) { // Only log every 30 frames to reduce spam
          console.log(`[Subtitle Debug] Time: ${currentTime.toFixed(2)}s, Words: "${displayText}"`);
        }
      };
      
      // Process each scene sequentially but with optimized frame rendering
      console.log('[ProjectService] Starting optimized scene processing');
      
      // Create a more efficient processing loop using requestAnimationFrame
      const processScenes = async () => {
        let currentSceneIndex = 0;
        let currentFrameInScene = 0;
        let lastFrameTime = 0;
        
        // Function to process the next frame
        const processNextFrame = async (timestamp: number) => {
          // Skip if we're processing too quickly
          if (timestamp - lastFrameTime < 1000 / FPS) {
            requestAnimationFrame(processNextFrame);
            return;
          }
          
          lastFrameTime = timestamp;
          
          // Check if we've completed all scenes
          if (currentSceneIndex >= validSceneAssets.length) {
            console.log('[ProjectService] All frames rendered, stopping recorder');
            mediaRecorder.stop();
            return;
          }
          
          const asset = validSceneAssets[currentSceneIndex];
          const frameCount = asset.frameCount || Math.ceil(asset.audioDuration * FPS);
          
          // Get the actual audio time for the current scene
          let currentAudioTime = 0;
          if (asset.audio && !asset.audio.paused) {
            currentAudioTime = asset.audio.currentTime;
          }
          
          // Connect audio if this is the first frame of the scene
          if (currentFrameInScene === 0 && asset.audio) {
            console.log(`[ProjectService] Starting audio for scene ${currentSceneIndex + 1}`);
            const audioSource = audioContext.createMediaElementSource(asset.audio);
            audioSource.connect(audioDestination);
            asset.audio.play().catch(err => console.error('Error playing audio:', err));
          }
          
          // Render the current frame with actual audio time
          renderFrame(asset, currentFrameInScene, currentAudioTime);
          
          // Update progress (allocate 80% of progress to frame rendering)
          const overallFrameIndex = validSceneAssets.slice(0, currentSceneIndex).reduce(
            (sum, a) => sum + (a.frameCount || Math.ceil(a.audioDuration * FPS)), 0
          ) + currentFrameInScene;
          
          const totalFrames = validSceneAssets.reduce(
            (sum, a) => sum + (a.frameCount || Math.ceil(a.audioDuration * FPS)), 0
          );
          
          const progress = 0.1 + (overallFrameIndex / totalFrames) * 0.8;
          
          // Update progress details for UI feedback
          this.progressDetails = {
            currentScene: currentSceneIndex + 1,
            totalScenes: validSceneAssets.length,
            sceneProgress: frameCount ? (currentFrameInScene / frameCount * 100) : 0
          };
          
          this.updateProgress(progress);
          
          // Update user-facing feedback every second
          if (currentFrameInScene % FPS === 0) {
            const sceneProgress = (currentFrameInScene / frameCount * 100).toFixed(0);
            const overallProgress = (progress * 100).toFixed(0);
            console.log(`[ProjectService] Scene ${currentSceneIndex + 1}/${validSceneAssets.length}: ${sceneProgress}% (Overall: ${overallProgress}%)`);
          }
          
          // Move to next frame
          currentFrameInScene++;
          
          // Check if we've completed the current scene
          if (currentFrameInScene >= frameCount) {
            // Stop the audio for the current scene
            if (asset.audio) {
              asset.audio.pause();
            }
            
            // Move to the next scene
            currentSceneIndex++;
            currentFrameInScene = 0;
          }
          
          // Continue the animation loop
          requestAnimationFrame(processNextFrame);
        };
        
        // Start the processing loop
        requestAnimationFrame(processNextFrame);
      };
      
      // Start processing and wait for completion
      await processScenes();
      
      // Wait for recording to complete
      this.updateProgress(0.9);
      console.log('[ProjectService] Finalizing video...');
      const videoBlob = await recordingPromise;
      this.updateProgress(1.0);
      
      return videoBlob;
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