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
      
      // MOBILE OPTIMIZATION: Load assets in batches for mobile to reduce memory pressure
      let validSceneAssets: SceneAsset[] = [];
      
      if (isMobile && sortedScenes.length > 3) {
        // For mobile, load assets in smaller batches to reduce memory pressure
        console.log('[ProjectService] Mobile detected, loading assets in batches');
        
        // Process in batches of 2 scenes at a time for mobile
        const batchSize = 2;
        for (let i = 0; i < sortedScenes.length; i += batchSize) {
          const batch = sortedScenes.slice(i, i + batchSize);
          console.log(`[ProjectService] Loading batch ${i/batchSize + 1}/${Math.ceil(sortedScenes.length/batchSize)}`);
          
          const batchAssets = await Promise.all(
            batch.map(async (scene) => {
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
          
          // Add valid assets from this batch
          validSceneAssets = [...validSceneAssets, ...batchAssets.filter(asset => asset.success)];
          
          // Update progress based on how many batches we've loaded
          this.updateProgress(0.05 + (i / sortedScenes.length) * 0.05);
        }
      } else {
        // For desktop, load all assets at once
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
        validSceneAssets = sceneAssets.filter(asset => asset.success);
      }
      
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
      
      // MOBILE OPTIMIZATION: Reduce canvas size for mobile
      if (isMobile) {
        // Use smaller canvas dimensions for mobile to reduce memory usage
        canvas.width = isReel ? 720 : 1280;
        canvas.height = isReel ? 1280 : 720;
      } else {
        // Full resolution for desktop
        canvas.width = isReel ? 1080 : 1920;
        canvas.height = isReel ? 1920 : 1080;
      }
      
      // OPTIMIZATION: Reduce video quality on mobile for better performance
      const videoBitrate = isMobile ? 1500000 : 5000000;
      
      // Get supported MIME type
      const getSupportedMimeType = () => {
        // Prioritize MP4 over WebM for better compatibility and reliability with longer videos
        const types = [
          'video/mp4',
          'video/webm;codecs=h264,opus',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
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
      
      const selectedMimeType = getSupportedMimeType() || 'video/mp4';
      
      // OPTIMIZATION: Pre-render all frames for each scene
      console.log('[ProjectService] Starting frame pre-rendering process');
      
      // Calculate total frames and duration
      const FPS = isMobile ? 15 : 30; // Even lower FPS on mobile
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
      
      // For better reliability, use smaller data chunks
      const dataAvailableInterval = 500; // ms
      
      // Create a promise that resolves when recording is complete
      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: selectedMimeType });
          console.log(`[ProjectService] Video generation complete, created ${videoBlob.size} byte video`);
          resolve(videoBlob);
        };
      });
      
      // Start recording
      mediaRecorder.start(dataAvailableInterval);
      console.log('[ProjectService] Started media recorder');
      
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
        
        // Get subtitle settings from the store
        const subtitleSettings = useSettingsStore.getState().subtitleSettings;
        const fontSize = subtitleSettings.fontSize || 32; // Use the font size from settings
        const wordsToDisplay = subtitleSettings.displayWordCount || 5;
        const highlightColor = subtitleSettings.highlightColor || '#FF0000';
        
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
        
        // Find the current word based on the current time
        let currentWordIndex = -1;
        
        // First try to find an exact match (word being spoken right now)
        for (let i = 0; i < allWords.length; i++) {
          if (currentTime >= allWords[i].start && currentTime <= allWords[i].end) {
            currentWordIndex = i;
            break;
          }
        }
        
        // If no exact match, find the most recent word
        if (currentWordIndex === -1) {
          let smallestTimeDiff = Number.MAX_VALUE;
          
          for (let i = 0; i < allWords.length; i++) {
            if (allWords[i].start <= currentTime) {
              const timeDiff = currentTime - allWords[i].start;
              if (timeDiff < smallestTimeDiff) {
                smallestTimeDiff = timeDiff;
                currentWordIndex = i;
              }
            }
          }
        }
        
        // If we found a word, display it and surrounding words based on wordsToDisplay setting
        if (currentWordIndex >= 0) {
          // Determine the range of words to display
          const halfCount = Math.floor(wordsToDisplay / 2);
          const startWordIndex = Math.max(0, currentWordIndex - halfCount);
          const endWordIndex = Math.min(allWords.length - 1, startWordIndex + wordsToDisplay - 1);
          
          // Set up text rendering with the font size from settings
          const scaledFontSize = isMobile ? Math.floor(fontSize * 0.75) : fontSize;
          ctx.font = `${scaledFontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          
          // Calculate text position (centered at bottom of canvas with padding)
          const textX = canvas.width / 2;
          const textY = canvas.height - 20; // 20px padding from bottom
          
          // Draw semi-transparent background for better readability
          // First measure the total text width to create the background
          let totalTextWidth = 0;
          for (let i = startWordIndex; i <= endWordIndex; i++) {
            totalTextWidth += ctx.measureText(allWords[i].word + ' ').width;
          }
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(
            textX - totalTextWidth / 2 - 10,
            textY - scaledFontSize - 10,
            totalTextWidth + 20,
            scaledFontSize + 20
          );
          
          // Draw each word individually to apply highlighting to the current word
          let currentX = textX - totalTextWidth / 2;
          
          for (let i = startWordIndex; i <= endWordIndex; i++) {
            const word = allWords[i].word;
            const wordWidth = ctx.measureText(word + ' ').width;
            
            // Set color based on whether this is the current word
            if (i === currentWordIndex) {
              ctx.fillStyle = highlightColor; // Use highlight color for the current word
            } else {
              ctx.fillStyle = 'white'; // Use white for other words
            }
            
            // Draw the word
            ctx.textAlign = 'left';
            ctx.fillText(word + ' ', currentX, textY);
            
            // Move to the next word position
            currentX += wordWidth;
          }
          
          // MOBILE OPTIMIZATION: Reduce debug logging on mobile
          if (!isMobile && frameNumber % 30 === 0) { // Only log every 30 frames to reduce spam
            console.log(`[Subtitle Debug] Time: ${currentTime.toFixed(2)}s, Current Word: "${allWords[currentWordIndex].word}", Word Start: ${allWords[currentWordIndex].start.toFixed(2)}s, Word End: ${allWords[currentWordIndex].end.toFixed(2)}s, Font Size: ${scaledFontSize}, Highlight Color: ${highlightColor}`);
          }
        }
      };
      
      // Create a more efficient processing loop using requestAnimationFrame
      const processScenes = async () => {
        let currentSceneIndex = 0;
        let currentFrameInScene = 0;
        let lastFrameTime = 0;
        let audioSources: AudioNode[] = [];
        
        // Add a small delay between scenes to ensure smooth transitions
        const sceneTransitionDelay = 0; // No delay between scenes to avoid gaps
        
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
            
            // Disconnect all audio sources before stopping
            audioSources.forEach(source => {
              try {
                source.disconnect();
              } catch (e) {
                // Ignore errors when disconnecting
              }
            });
            
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
            try {
              const audioSource = audioContext.createMediaElementSource(asset.audio);
              audioSource.connect(audioDestination);
              audioSources.push(audioSource);
              
              // Ensure audio starts from the beginning
              asset.audio.currentTime = 0;
              
              // Play audio with error handling
              const playPromise = asset.audio.play();
              if (playPromise !== undefined) {
                playPromise.catch(err => {
                  console.error('Error playing audio:', err);
                  // Continue to next frame even if audio fails
                  currentFrameInScene++;
                  requestAnimationFrame(processNextFrame);
                });
              }
            } catch (err) {
              console.error('Error setting up audio:', err);
              // Continue to next frame even if audio setup fails
              currentFrameInScene++;
              requestAnimationFrame(processNextFrame);
              return;
            }
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
              try {
                asset.audio.pause();
                // Don't set currentTime to 0 here to avoid audio gaps
              } catch (e) {
                console.error('Error pausing audio:', e);
              }
            }
            
            // Move to the next scene immediately without delay
            currentSceneIndex++;
            currentFrameInScene = 0;
            
            // If we're moving to a new scene, add a small transition frame to avoid gaps
            if (currentSceneIndex < validSceneAssets.length && sceneTransitionDelay > 0) {
              // Add a small delay before starting the next scene to ensure smooth transition
              setTimeout(() => {
                requestAnimationFrame(processNextFrame);
              }, sceneTransitionDelay);
              return;
            }
          }
          
          // Continue the animation loop
          requestAnimationFrame(processNextFrame);
        };
        
        // Start the processing loop
        requestAnimationFrame(processNextFrame);
      };
      
      // Start processing scenes
      processScenes();
      
      // Wait for recording to complete
      const videoBlob = await recordingPromise;
      
      // Update progress to 100%
      this.updateProgress(1.0);
      
      // Return the final video blob
      return videoBlob;
    } catch (error: any) {
      console.error('[ProjectService] Error generating video:', error);
      throw new ProcessingError({
        stage: 'video-generation',
        message: error.message || 'Failed to generate video',
        timestamp: new Date(),
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

  // Add this new method for handling longer videos with multiple scenes
  private async generateSegmentedVideo(
    validSceneAssets: Array<{
      scene: Scene;
      image: HTMLImageElement | null;
      audio: HTMLAudioElement | null;
      audioDuration: number;
      success: boolean;
      frameCount?: number;
    }>,
    project: Project,
    FPS: number
  ): Promise<Blob> {
    console.log('[ProjectService] Starting segmented video generation');
    
    // Create canvas and context
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const videoWidth = isMobile ? 1280 : 1920;
    const videoHeight = project.videoFormat === 'landscape' ? videoWidth * 9/16 : videoWidth * 16/9;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext('2d')!;
    
    // Calculate video bitrate based on resolution (lower for mobile)
    const videoBitrate = isMobile ? 1500000 : 2500000; // 1.5Mbps for mobile, 2.5Mbps for desktop
    
    // Get supported MIME type
    const getSupportedMimeType = () => {
      // Prioritize MP4 over WebM for better compatibility
      const types = [
        'video/mp4',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
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
    
    const selectedMimeType = getSupportedMimeType() || 'video/mp4';
    
    // Calculate total frames and duration
    let totalFrames = 0;
    let totalDuration = 0;
    
    validSceneAssets.forEach(asset => {
      asset.frameCount = Math.ceil(asset.audioDuration * FPS);
      totalFrames += asset.frameCount || 0;
      totalDuration += asset.audioDuration;
    });
    
    console.log(`[ProjectService] Total video will be ${totalDuration.toFixed(2)} seconds (${totalFrames} frames)`);
    
    // Determine optimal segment size (aim for 3-4 scenes per segment, but respect MAX_SEGMENT_DURATION)
    const MAX_SEGMENT_DURATION = 60; // seconds
    const OPTIMAL_SCENES_PER_SEGMENT = 3;
    
    // Create segments
    const segments: Array<Array<typeof validSceneAssets[0]>> = [];
    let currentSegment: Array<typeof validSceneAssets[0]> = [];
    let currentSegmentDuration = 0;
    
    for (let i = 0; i < validSceneAssets.length; i++) {
      const asset = validSceneAssets[i];
      
      // If adding this scene would exceed MAX_SEGMENT_DURATION or we've reached OPTIMAL_SCENES_PER_SEGMENT,
      // and we already have at least one scene in the current segment, start a new segment
      if (currentSegment.length > 0 && 
          (currentSegmentDuration + asset.audioDuration > MAX_SEGMENT_DURATION || 
           currentSegment.length >= OPTIMAL_SCENES_PER_SEGMENT)) {
        segments.push([...currentSegment]);
        currentSegment = [];
        currentSegmentDuration = 0;
      }
      
      // Add the scene to the current segment
      currentSegment.push(asset);
      currentSegmentDuration += asset.audioDuration;
    }
    
    // Add the last segment if it's not empty
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    console.log(`[ProjectService] Split video into ${segments.length} segments`);
    segments.forEach((segment, i) => {
      const segmentDuration = segment.reduce((sum, asset) => sum + asset.audioDuration, 0);
      console.log(`[ProjectService] Segment ${i+1}: ${segment.length} scenes, ${segmentDuration.toFixed(2)} seconds`);
    });
    
    // Process each segment
    const segmentBlobs: Blob[] = [];
    
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      console.log(`[ProjectService] Processing segment ${segmentIndex + 1}/${segments.length}`);
      
      // Create a MediaRecorder for this segment
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
      
      // For better reliability, use smaller data chunks
      const dataAvailableInterval = 500; // ms
      
      // Create a promise that resolves when recording is complete
      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: selectedMimeType });
          console.log(`[ProjectService] Segment ${segmentIndex + 1} complete, created ${videoBlob.size} byte video`);
          resolve(videoBlob);
        };
      });
      
      // Start recording
      mediaRecorder.start(dataAvailableInterval);
      console.log(`[ProjectService] Started media recorder for segment ${segmentIndex + 1}`);
      
      // Create a function to render a specific frame
      const renderFrame = (asset: typeof validSceneAssets[0], frameNumber: number, actualAudioTime: number) => {
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
        
        // Get subtitle settings from the store
        const subtitleSettings = useSettingsStore.getState().subtitleSettings;
        const fontSize = subtitleSettings.fontSize || 32; // Use the font size from settings
        const wordsToDisplay = subtitleSettings.displayWordCount || 5;
        const highlightColor = subtitleSettings.highlightColor || '#FF0000';
        
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
        
        // Find the current word based on the current time
        let currentWordIndex = -1;
        
        // First try to find an exact match (word being spoken right now)
        for (let i = 0; i < allWords.length; i++) {
          if (currentTime >= allWords[i].start && currentTime <= allWords[i].end) {
            currentWordIndex = i;
            break;
          }
        }
        
        // If no exact match, find the most recent word
        if (currentWordIndex === -1) {
          let smallestTimeDiff = Number.MAX_VALUE;
          
          for (let i = 0; i < allWords.length; i++) {
            if (allWords[i].start <= currentTime) {
              const timeDiff = currentTime - allWords[i].start;
              if (timeDiff < smallestTimeDiff) {
                smallestTimeDiff = timeDiff;
                currentWordIndex = i;
              }
            }
          }
        }
        
        // If we found a word, display it and surrounding words based on wordsToDisplay setting
        if (currentWordIndex >= 0) {
          // Determine the range of words to display
          const halfCount = Math.floor(wordsToDisplay / 2);
          const startWordIndex = Math.max(0, currentWordIndex - halfCount);
          const endWordIndex = Math.min(allWords.length - 1, startWordIndex + wordsToDisplay - 1);
          
          // Set up text rendering with the font size from settings
          const scaledFontSize = isMobile ? Math.floor(fontSize * 0.75) : fontSize;
          ctx.font = `${scaledFontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          
          // Calculate text position (centered at bottom of canvas with padding)
          const textX = canvas.width / 2;
          const textY = canvas.height - 20; // 20px padding from bottom
          
          // Draw semi-transparent background for better readability
          // First measure the total text width to create the background
          let totalTextWidth = 0;
          for (let i = startWordIndex; i <= endWordIndex; i++) {
            totalTextWidth += ctx.measureText(allWords[i].word + ' ').width;
          }
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(
            textX - totalTextWidth / 2 - 10,
            textY - scaledFontSize - 10,
            totalTextWidth + 20,
            scaledFontSize + 20
          );
          
          // Draw each word individually to apply highlighting to the current word
          let currentX = textX - totalTextWidth / 2;
          
          for (let i = startWordIndex; i <= endWordIndex; i++) {
            const word = allWords[i].word;
            const wordWidth = ctx.measureText(word + ' ').width;
            
            // Set color based on whether this is the current word
            if (i === currentWordIndex) {
              ctx.fillStyle = highlightColor; // Use highlight color for the current word
            } else {
              ctx.fillStyle = 'white'; // Use white for other words
            }
            
            // Draw the word
            ctx.textAlign = 'left';
            ctx.fillText(word + ' ', currentX, textY);
            
            // Move to the next word position
            currentX += wordWidth;
          }
        }
      };
      
      // Create a more efficient processing loop using requestAnimationFrame
      const processSegment = async () => {
        let currentSceneIndex = 0;
        let currentFrameInScene = 0;
        let lastFrameTime = 0;
        let audioSources: AudioNode[] = [];
        
        // Function to process the next frame
        const processNextFrame = async (timestamp: number) => {
          // Skip if we're processing too quickly
          if (timestamp - lastFrameTime < 1000 / FPS) {
            requestAnimationFrame(processNextFrame);
            return;
          }
          
          lastFrameTime = timestamp;
          
          // Check if we've completed all scenes in this segment
          if (currentSceneIndex >= segment.length) {
            console.log(`[ProjectService] All frames rendered for segment ${segmentIndex + 1}, stopping recorder`);
            
            // Disconnect all audio sources before stopping
            audioSources.forEach(source => {
              try {
                source.disconnect();
              } catch (e) {
                // Ignore errors when disconnecting
              }
            });
            
            mediaRecorder.stop();
            return;
          }
          
          const asset = segment[currentSceneIndex];
          const frameCount = asset.frameCount || Math.ceil(asset.audioDuration * FPS);
          
          // Get the actual audio time for the current scene
          let currentAudioTime = 0;
          if (asset.audio && !asset.audio.paused) {
            currentAudioTime = asset.audio.currentTime;
          }
          
          // Connect audio if this is the first frame of the scene
          if (currentFrameInScene === 0 && asset.audio) {
            console.log(`[ProjectService] Starting audio for scene in segment ${segmentIndex + 1}`);
            const audioSource = audioContext.createMediaElementSource(asset.audio);
            audioSource.connect(audioDestination);
            audioSources.push(audioSource);
            asset.audio.play().catch(err => console.error('Error playing audio:', err));
          }
          
          // Render the current frame with actual audio time
          renderFrame(asset, currentFrameInScene, currentAudioTime);
          
          // Calculate overall progress across all segments
          const segmentsCompleted = segmentIndex;
          const currentSegmentProgress = (currentSceneIndex / segment.length) + 
                                        (currentFrameInScene / frameCount / segment.length);
          
          const overallProgress = (segmentsCompleted + currentSegmentProgress) / segments.length;
          const progress = 0.1 + overallProgress * 0.8; // Allocate 80% of progress to frame rendering
          
          // Update progress details for UI feedback
          this.progressDetails = {
            currentScene: validSceneAssets.indexOf(segment[currentSceneIndex]) + 1,
            totalScenes: validSceneAssets.length,
            sceneProgress: frameCount ? (currentFrameInScene / frameCount * 100) : 0
          };
          
          this.updateProgress(progress);
          
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
      
      // Start processing the segment
      processSegment();
      
      // Wait for segment recording to complete
      const segmentBlob = await recordingPromise;
      segmentBlobs.push(segmentBlob);
      
      // Clean up resources
      try {
        audioContext.close();
      } catch (e) {
        console.error('Error closing audio context:', e);
      }
      
      // Update progress
      const segmentProgress = (segmentIndex + 1) / segments.length;
      this.updateProgress(0.1 + segmentProgress * 0.8);
    }
    
    console.log(`[ProjectService] All ${segments.length} segments processed, combining...`);
    
    // If we only have one segment, return it directly
    if (segmentBlobs.length === 1) {
      return segmentBlobs[0];
    }
    
    // Combine all segments into a single video
    try {
      // Use FFmpeg to concatenate the video segments
      const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
      const ffmpeg = createFFmpeg({ log: true });
      await ffmpeg.load();
      
      // Write each segment to FFmpeg's virtual file system
      for (let i = 0; i < segmentBlobs.length; i++) {
        const fileName = `segment_${i}.${selectedMimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        // Convert Blob to ArrayBuffer before passing to fetchFile
        const arrayBuffer = await segmentBlobs[i].arrayBuffer();
        ffmpeg.FS('writeFile', fileName, new Uint8Array(arrayBuffer));
      }
      
      // Create a concat file
      const concatContent = segmentBlobs.map((_, i) => 
        `file 'segment_${i}.${selectedMimeType.includes('mp4') ? 'mp4' : 'webm'}'`
      ).join('\n');
      
      ffmpeg.FS('writeFile', 'concat.txt', new TextEncoder().encode(concatContent));
      
      // Execute the concat command
      const outputExt = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
      await ffmpeg.run(
        '-f', 'concat', 
        '-safe', '0', 
        '-i', 'concat.txt', 
        '-c', 'copy', 
        `output.${outputExt}`
      );
      
      // Read the output file
      const data = ffmpeg.FS('readFile', `output.${outputExt}`);
      // Create a Blob from the Uint8Array directly, not from its buffer property
      const finalBlob = new Blob([data], { type: selectedMimeType });
      
      console.log(`[ProjectService] Successfully combined ${segmentBlobs.length} segments into a ${finalBlob.size} byte video`);
      
      // Update progress to 100%
      this.updateProgress(1.0);
      
      return finalBlob;
    } catch (error) {
      console.error('Error combining video segments:', error);
      
      // Fallback: If FFmpeg fails, just return the first segment
      console.warn('[ProjectService] Falling back to returning first segment only');
      return segmentBlobs[0];
    }
  }
} 