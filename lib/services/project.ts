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
          console.log(`[ProjectService] Video generation complete, created ${videoBlob.size} byte video`);
          resolve(videoBlob);
        };
      });
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      console.log('[ProjectService] Started media recorder');
      
      // Process each scene
      for (const scene of sortedScenes) {
        if (!scene.imagePath || !scene.audioPath) {
          console.warn(`[ProjectService] Scene ${scene.id} is missing image or audio, skipping`);
          continue;
        }
        
        console.log(`[ProjectService] Processing scene ${scene.id}`);
        
        // Load image
        const image = await this.loadImage(scene.imagePath);
        console.log(`[ProjectService] Loaded image: ${image.width}x${image.height}`);
        
        // Load audio
        const audio = await this.loadAudio(scene.audioPath);
        console.log(`[ProjectService] Loaded audio, duration: ${audio.duration}s`);
        
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
        
        // Connect audio to the media stream
        const audioSource = audioContext.createMediaElementSource(audio);
        audioSource.connect(audioDestination);
        
        // Add subtitles if available
        if (scene.subtitles?.segments?.length) {
          console.log(`[ProjectService] Scene has ${scene.subtitles.segments.length} subtitle segments with words`);
          
          // Start playing audio
          audio.play().catch(err => console.error('Error playing audio:', err));
          
          // Render frames with subtitles
          await new Promise<void>((resolve) => {
            const startTime = Date.now();
            
            const renderFrame = () => {
              // Calculate current playback time
              const elapsedSeconds = (Date.now() - startTime) / 1000;
              
              if (elapsedSeconds >= audioDuration) {
                // Animation complete
                audio.pause();
                audio.currentTime = 0;
                resolve();
                return;
              }
              
              // Clear canvas and draw image
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
              
              // Find the active subtitle segment
              const activeSegment = scene.subtitles?.segments.find(
                segment => elapsedSeconds >= segment.start && elapsedSeconds <= segment.end
              ) as {
                id: number;
                start: number;
                end: number;
                text: string;
                words?: Array<{ word: string; start: number; end: number }>;
              } | undefined;
              
              if (activeSegment) {
                // Calculate progress through this subtitle (0-1)
                const segmentDuration = activeSegment.end - activeSegment.start;
                const segmentProgress = (elapsedSeconds - activeSegment.start) / segmentDuration;
                const progress = Math.min(Math.max(segmentProgress, 0), 1);
                
                // Prepare display words
                let displayWords: { word: string; isFocus: boolean }[] = [];
                
                // If we have word-level timestamps, use them for precise highlighting
                if (activeSegment.words && activeSegment.words.length > 0) {
                  // Find the current focus word based on timestamp
                  const focusWordIndex = activeSegment.words.findIndex(
                    (word: { word: string; start: number; end: number }) => 
                      elapsedSeconds >= word.start && elapsedSeconds <= word.end
                  );
                  
                  // If no word is currently being spoken, find the next word
                  const effectiveFocusIndex = focusWordIndex >= 0 
                    ? focusWordIndex 
                    : activeSegment.words.findIndex(
                        (word: { word: string; start: number; end: number }) => 
                          word.start > elapsedSeconds
                      );
                  
                  // Determine which words to display (focus word, next word, and up to 2 preceding words)
                  const startIndex = Math.max(0, effectiveFocusIndex - 2);
                  const endIndex = Math.min(activeSegment.words.length, effectiveFocusIndex + 2);
                  
                  displayWords = activeSegment.words
                    .slice(startIndex, endIndex)
                    .map((word: { word: string; start: number; end: number }, index: number) => ({
                      word: word.word,
                      isFocus: index + startIndex === effectiveFocusIndex
                    }));
                } else {
                  // Fallback to splitting text if no word-level timestamps
                  const words = activeSegment.text.split(/\s+/);
                  
                  // Estimate which word is the focus based on progress
                  const estimatedFocusIndex = Math.min(
                    Math.floor(words.length * progress),
                    words.length - 1
                  );
                  
                  // Get a window of words around the focus word
                  const startIndex = Math.max(0, estimatedFocusIndex - 2);
                  const endIndex = Math.min(words.length, estimatedFocusIndex + 2);
                  
                  displayWords = words
                    .slice(startIndex, endIndex)
                    .map((word, index) => ({
                      word,
                      isFocus: index + startIndex === estimatedFocusIndex
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
                const fontSize = Math.max(canvas.width * 0.03, 24); // Responsive font size
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Calculate total width of all words
                const totalTextWidth = displayWords.reduce((width, word, index) => {
                  const wordWidth = ctx.measureText(word.word).width;
                  return width + wordWidth + (index < displayWords.length - 1 ? fontSize * 0.5 : 0);
                }, 0);
                
                // Start position for the first word
                let currentX = (canvas.width - totalTextWidth) / 2;
                
                // Draw each word
                displayWords.forEach(word => {
                  const wordWidth = ctx.measureText(word.word).width;
                  
                  // Draw word
                  ctx.fillStyle = word.isFocus ? '#ff4d4d' : 'white';
                  ctx.fillText(word.word, currentX + (wordWidth / 2), textY);
                  
                  // Move to next word position
                  currentX += wordWidth + fontSize * 0.5;
                });
                
                // Draw progress bar
                const progressBarHeight = 4;
                const progressBarWidth = canvas.width * 0.5;
                const progressBarX = (canvas.width - progressBarWidth) / 2;
                const progressBarY = subtitleAreaY + subtitleAreaHeight - 20;
                
                // Background of progress bar
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
                
                // Filled part of progress bar
                ctx.fillStyle = '#ff4d4d';
                ctx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, progressBarHeight);
              }
              
              // Continue animation
              requestAnimationFrame(renderFrame);
            };
            
            // Start animation loop
            renderFrame();
          });
        } else {
          // Just play audio without subtitles
          console.log(`[ProjectService] Scene has no subtitles, playing audio only`);
          await this.playAudioAndWait(audio, audioDuration);
        }
        
        // Disconnect audio source after playing
        audioSource.disconnect();
      }
      
      // Stop recording
      console.log('[ProjectService] All scenes processed, stopping media recorder');
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