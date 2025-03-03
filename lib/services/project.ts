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
      console.log('[ProjectService] Generating video from scenes');
      
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
      
      // OPTIMIZATION: Batch scenes for more efficient processing
      // Process scenes in batches of 3 to avoid memory issues
      const BATCH_SIZE = isMobile ? 2 : 3;
      const sceneBatches = [];
      for (let i = 0; i < sortedScenes.length; i += BATCH_SIZE) {
        sceneBatches.push(sortedScenes.slice(i, i + BATCH_SIZE));
      }
      console.log(`[ProjectService] Split ${sortedScenes.length} scenes into ${sceneBatches.length} batches`);
      
      // Create a canvas for rendering
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for better performance
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Set canvas dimensions based on project format
      const isReel = project.videoFormat === 'reel';
      canvas.width = isReel ? 1080 : 1920;
      canvas.height = isReel ? 1920 : 1080;
      
      // OPTIMIZATION: Reduce video quality on mobile for better performance
      const videoBitrate = isMobile ? 2500000 : 5000000; // 2.5 Mbps for mobile, 5 Mbps for desktop
      
      // Check for supported MIME types
      const getSupportedMimeType = () => {
        const types = [
          'video/webm;codecs=vp9,opus',
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
        return '';  // Let the browser choose the default
      };
      
      // Store the selected MIME type
      const selectedMimeType = getSupportedMimeType() || 'video/webm';
      
      // Process each batch of scenes and collect the resulting video blobs
      const batchBlobs: Blob[] = [];
      
      for (let batchIndex = 0; batchIndex < sceneBatches.length; batchIndex++) {
        const batch = sceneBatches[batchIndex];
        console.log(`[ProjectService] Processing batch ${batchIndex + 1}/${sceneBatches.length} with ${batch.length} scenes`);
        
        // Create a MediaRecorder to capture the canvas for this batch
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
          mimeType: selectedMimeType,
          videoBitsPerSecond: videoBitrate
        });
        
        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        
        // Create a promise that resolves when batch recording is complete
        const batchRecordingPromise = new Promise<Blob>((resolve) => {
          mediaRecorder.onstop = () => {
            const batchBlob = new Blob(chunks, { type: selectedMimeType });
            console.log(`[ProjectService] Batch ${batchIndex + 1} complete, created ${batchBlob.size} byte video`);
            resolve(batchBlob);
          };
        });
        
        // Start recording this batch
        mediaRecorder.start(1000); // Collect data every second
        console.log(`[ProjectService] Started media recorder for batch ${batchIndex + 1}`);
        
        // Process each scene in the batch
        for (let i = 0; i < batch.length; i++) {
          const scene = batch[i];
          const overallSceneIndex = batchIndex * BATCH_SIZE + i;
          const totalScenes = sortedScenes.length;
          
          // Update progress (each scene is worth 90% / totalScenes of the progress)
          this.updateProgress(overallSceneIndex / totalScenes * 0.9);
          
          if (!scene.imagePath || !scene.audioPath) {
            console.warn(`[ProjectService] Scene ${scene.id} is missing image or audio, skipping`);
            continue;
          }
          
          console.log(`[ProjectService] Processing scene ${overallSceneIndex + 1}/${totalScenes}`);
          
          try {
            // Load image
            const image = await this.loadImage(scene.imagePath);
            console.log(`[ProjectService] Loaded image: ${image.width}x${image.height}`);
            
            // Load audio
            const audio = await this.loadAudio(scene.audioPath);
            console.log(`[ProjectService] Loaded audio, duration: ${audio.duration}s`);
            
            // Get audio duration
            const audioDuration = audio.duration;
            
            // OPTIMIZATION: Pre-calculate image positioning to avoid doing it in the render loop
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
            
            // Connect audio to the media stream
            const audioSource = audioContext.createMediaElementSource(audio);
            audioSource.connect(audioDestination);
            
            // OPTIMIZATION: Pre-process subtitle segments for faster rendering
            let processedSubtitles: Array<{
              segment: any;
              displayWords: Array<{ word: string; isFocus: boolean }>;
              start: number;
              end: number;
            }> = [];
            
            if (scene.subtitles?.segments?.length) {
              processedSubtitles = scene.subtitles.segments.map(segment => {
                // Pre-process words for each segment
                // Use type assertion to handle optional words property
                const segmentWithWords = segment as {
                  id: number;
                  start: number;
                  end: number;
                  text: string;
                  words?: Array<{ word: string; start: number; end: number }>;
                };
                
                const words = segmentWithWords.words || segmentWithWords.text.split(/\s+/);
                return {
                  segment: segmentWithWords,
                  displayWords: Array.isArray(words) 
                    ? words.map((w: any) => ({ 
                        word: typeof w === 'string' ? w : w.word, 
                        isFocus: false 
                      }))
                    : [],
                  start: segment.start,
                  end: segment.end
                };
              });
            }
            
            // Start playing audio
            audio.play().catch(err => console.error('Error playing audio:', err));
            
            // Render frames with subtitles
            await new Promise<void>((resolve) => {
              const startTime = Date.now();
              let lastRenderTime = 0;
              
              // OPTIMIZATION: Use requestAnimationFrame more efficiently
              const renderFrame = () => {
                // Calculate current playback time
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                
                // OPTIMIZATION: Skip frames if we're rendering too frequently
                // Only render at ~30fps (33ms between frames)
                const now = performance.now();
                const timeSinceLastRender = now - lastRenderTime;
                
                if (elapsedSeconds >= audioDuration) {
                  // Animation complete
                  audio.pause();
                  audio.currentTime = 0;
                  resolve();
                  return;
                }
                
                // Skip this frame if we're rendering too frequently
                if (timeSinceLastRender < 33 && elapsedSeconds < audioDuration - 0.1) {
                  requestAnimationFrame(renderFrame);
                  return;
                }
                
                lastRenderTime = now;
                
                // Clear canvas and draw image
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
                
                // Find the active subtitle segment
                if (processedSubtitles.length > 0) {
                  const activeSegment = processedSubtitles.find(
                    s => elapsedSeconds >= s.start && elapsedSeconds <= s.end
                  );
                  
                  if (activeSegment) {
                    // Calculate progress through this subtitle (0-1)
                    const segmentDuration = activeSegment.end - activeSegment.start;
                    const segmentProgress = (elapsedSeconds - activeSegment.start) / segmentDuration;
                    const progress = Math.min(Math.max(segmentProgress, 0), 1);
                    
                    // Prepare display words
                    let displayWords = activeSegment.displayWords;
                    
                    // Find the current focus word
                    if (activeSegment.segment.words && activeSegment.segment.words.length > 0) {
                      // Find the current focus word based on timestamp
                      const focusWordIndex = activeSegment.segment.words.findIndex(
                        (word: { word: string; start: number; end: number }) => 
                          elapsedSeconds >= word.start && elapsedSeconds <= word.end
                      );
                      
                      // Update focus state
                      displayWords = displayWords.map((w, idx) => ({
                        ...w,
                        isFocus: idx === focusWordIndex
                      }));
                    } else {
                      // Fallback to estimating focus word by progress
                      const estimatedFocusIndex = Math.min(
                        Math.floor(displayWords.length * progress),
                        displayWords.length - 1
                      );
                      
                      // Update focus state
                      displayWords = displayWords.map((w, idx) => ({
                        ...w,
                        isFocus: idx === estimatedFocusIndex
                      }));
                    }
                    
                    // Set up subtitle area (bottom 20% of canvas)
                    const subtitleAreaHeight = canvas.height * 0.2;
                    const subtitleAreaY = canvas.height - subtitleAreaHeight;
                    
                    // Clear subtitle area with semi-transparent background
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(0, subtitleAreaY, canvas.width, subtitleAreaHeight);
                    
                    // Calculate text positioning
                    const textY = subtitleAreaY + (subtitleAreaHeight * 0.5);
                    
                    // Set text properties
                    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // OPTIMIZATION: Limit displayed words for better performance
                    const maxDisplayWords = Math.min(displayWordCount, displayWords.length);
                    const displaySubset = displayWords.slice(0, maxDisplayWords);
                    
                    // Calculate total width of all words
                    const totalTextWidth = displaySubset.reduce((width, word, index) => {
                      const wordWidth = ctx.measureText(word.word).width;
                      return width + wordWidth + (index < displaySubset.length - 1 ? fontSize * 0.5 : 0);
                    }, 0);
                    
                    // Start position for the first word
                    let currentX = (canvas.width - totalTextWidth) / 2;
                    
                    // Draw each word
                    displaySubset.forEach(word => {
                      const wordWidth = ctx.measureText(word.word).width;
                      
                      // Draw word
                      ctx.fillStyle = word.isFocus ? highlightColor : 'white';
                      ctx.fillText(word.word, currentX + (wordWidth / 2), textY);
                      
                      // Move to next word position
                      currentX += wordWidth + fontSize * 0.5;
                    });
                    
                    // Draw progress bar if enabled
                    if (showProgressBar) {
                      const progressBarHeight = 4;
                      const progressBarWidth = canvas.width * 0.5;
                      const progressBarX = (canvas.width - progressBarWidth) / 2;
                      const progressBarY = subtitleAreaY + subtitleAreaHeight - 20;
                      
                      // Background of progress bar
                      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                      ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
                      
                      // Filled part of progress bar
                      ctx.fillStyle = highlightColor;
                      ctx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, progressBarHeight);
                    }
                  }
                }
                
                // Continue animation
                requestAnimationFrame(renderFrame);
              };
              
              // Start animation loop
              renderFrame();
            });
            
            // Disconnect audio source after playing
            audioSource.disconnect();
          } catch (error: any) {
            console.error(`[ProjectService] Error processing scene ${scene.id}:`, error);
            // Continue with next scene instead of failing the entire batch
          }
        }
        
        // Stop recording this batch
        console.log(`[ProjectService] All scenes in batch ${batchIndex + 1} processed, stopping media recorder`);
        mediaRecorder.stop();
        
        // Wait for batch recording to complete and add to batch blobs
        const batchBlob = await batchRecordingPromise;
        batchBlobs.push(batchBlob);
        
        // Update progress (last 10% is for combining batches)
        this.updateProgress(0.9 + (batchIndex / sceneBatches.length) * 0.1);
      }
      
      // Combine all batch blobs into a single video
      console.log(`[ProjectService] Combining ${batchBlobs.length} batch videos`);
      let finalVideo: Blob;
      
      if (batchBlobs.length === 1) {
        // Only one batch, use it directly
        finalVideo = batchBlobs[0];
      } else {
        // Multiple batches, combine them
        // For simplicity, we'll just concatenate the blobs
        // In a more advanced implementation, you could use FFmpeg.wasm to properly combine videos
        finalVideo = new Blob(batchBlobs, { type: selectedMimeType });
      }
      
      console.log(`[ProjectService] Video generation complete, created ${finalVideo.size} byte video`);
      return finalVideo;
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