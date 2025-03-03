'use client';

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useProjectActions, useProcessingState, useScenes, useCurrentProject } from '@/lib/store';
import { ProjectService } from '@/lib/services/project';
import { getOrCreateTranscription } from '@/lib/services/youtube';
import { Scene, ProgressStatus } from '@/types';
import { ScenePreview } from '@/components/ScenePreview';
import { ProjectList } from '@/components/ProjectList';
import { generateAudio } from '@/lib/services/openai';
import { generateImage, downloadImage } from '@/lib/services/replicate';
import { FileSystemService } from '@/lib/services/filesystem';
import { transcribeAudio, generateVTT, SubtitleSegment } from '@/lib/services/whisper';
import { useSettingsStore } from '@/lib/store/settings';
import { Settings } from '@/components/Settings';
import { VideoPlayerWithSubtitles } from '@/components/VideoPlayerWithSubtitles';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/Progress';
import { 
  Video, 
  Image as ImageIcon, 
  Mic, 
  Subtitles, 
  Trash2, 
  RefreshCw,
  Youtube,
  Loader2
} from 'lucide-react';

interface VideoPlayerWithSubtitlesProps {
  videoUrl: string;
  posterUrl?: string;
}

interface ScenePreviewProps {
  scene: Scene;
  onDelete: (id: string) => void;
  index: number;
}

export function VideoProcessor() {
  const [url, setUrl] = useState('');
  const [videoFormat, setVideoFormat] = useState<'landscape' | 'reel'>('reel');
  const { isProcessing, progress } = useProcessingState();
  const scenes = useScenes();
  const currentProject = useCurrentProject();
  const { createProject, setError, setScenes, updateScene } = useProjectActions();
  const projectService = new ProjectService();
  const [isGeneratingAllAudio, setIsGeneratingAllAudio] = useState(false);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isGeneratingAllSubtitles, setIsGeneratingAllSubtitles] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [cacheSize, setCacheSize] = useState<{ total: number; audio: number; image: number; video: number } | null>(null);
  const [isLoadingCacheSize, setIsLoadingCacheSize] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileSystemRef = useRef<FileSystemService | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [posterImageUrl, setPosterImageUrl] = useState<string | null>(null);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState<{
    stage: 'preparing' | 'processing' | 'finalizing';
    progress: number;
    currentScene?: number;
    totalScenes?: number;
    sceneProgress?: number;
  } | null>(null);

  // Initialize FileSystemService only on the client side
  useEffect(() => {
    fileSystemRef.current = new FileSystemService();
    // Load cache size after FileSystemService is initialized
    loadCacheSize();
  }, []);

  // Load poster image when scenes change
  useEffect(() => {
    const loadPosterImage = async () => {
      if (scenes.length > 0 && scenes[0].imagePath && fileSystemRef.current) {
        try {
          const imageBlob = await fileSystemRef.current.readFile(scenes[0].imagePath, 'image');
          const imageUrl = URL.createObjectURL(imageBlob);
          setPosterImageUrl(imageUrl);
        } catch (error) {
          console.error('Failed to load poster image:', error);
        }
      }
    };
    
    loadPosterImage();
    
    // Clean up function to revoke object URL
    return () => {
      if (posterImageUrl) {
        URL.revokeObjectURL(posterImageUrl);
      }
    };
  }, [scenes]);

  // Debug log for video button state
  useEffect(() => {
    if (scenes.length > 0) {
      console.log('Scenes for video button:', scenes.map(s => ({
        id: s.id,
        hasAudio: !!s.audioPath,
        hasImage: !!s.imagePath,
        audioGenerated: !!s.status?.audioGenerated,
        imageGenerated: !!s.status?.imageGenerated,
        buttonEnabled: (s.status?.audioGenerated || s.audioPath) && (s.status?.imageGenerated || s.imagePath)
      })));
    }
  }, [scenes]);

  // Clean up video URL when component unmounts
  useEffect(() => {
    return () => {
      if (generatedVideoUrl) {
        URL.revokeObjectURL(generatedVideoUrl);
      }
    };
  }, [generatedVideoUrl]);

  const loadCacheSize = async () => {
    if (!fileSystemRef.current) return;
    
    try {
      setIsLoadingCacheSize(true);
      const size = await fileSystemRef.current.getCacheSize();
      setCacheSize(size);
    } catch (error) {
      console.error('Failed to get cache size:', error);
    } finally {
      setIsLoadingCacheSize(false);
    }
  };

  const handleClearCache = async () => {
    if (!fileSystemRef.current) return;
    
    if (confirm('Are you sure you want to clear all cached files? This will remove all saved audio and images.')) {
      try {
        setIsClearing(true);
        await fileSystemRef.current.clearCache();
        await loadCacheSize();
      } catch (error: any) {
        setError({
          stage: 'cache-clear',
          message: error.message,
          timestamp: new Date(),
        });
      } finally {
        setIsClearing(false);
      }
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!url) return;

    try {
      // Initialize file system with user interaction
      await fileSystemRef.current?.initialize(true);

      // Create new project with selected video format
      const project = await projectService.createProject(url, videoFormat);

      // Get YouTube transcription
      const transcription = await getOrCreateTranscription(url);
      console.log('Transcription:', transcription);

      // Generate scenes (only narration and prompts)
      const result = await projectService.generateScenes(transcription);
      
      // Initialize scenes with status
      const scenesWithStatus = result.scenes.map((scene: Omit<Scene, 'status'>) => ({
        ...scene,
        status: {
          audioGenerated: false,
          imageGenerated: false
        }
      }));
      
      setScenes(scenesWithStatus);

    } catch (error: any) {
      setError({
        stage: 'video-processing',
        message: error.message,
        details: error,
        timestamp: new Date(),
      });
    }
  };

  const handleGenerateAllAudio = async () => {
    if (!currentProject) {
      alert('Please create a project first');
      return;
    }

    if (!scenes || scenes.length === 0) {
      alert('No scenes to generate audio for');
      return;
    }

    try {
      setIsGeneratingAllAudio(true);
      
      // Initialize file system with user interaction
      if (fileSystemRef.current) {
        await fileSystemRef.current.initialize(true);
      }

      // Create new project with selected video format
      for (const scene of scenes) {
        if (!scene.narration) continue;
        
        try {
          console.log(`[VideoProcessor] Generating audio for scene ${scene.id}`);
          
          // Skip if already has audio
          if (scene.audioPath) {
            console.log(`[VideoProcessor] Scene ${scene.id} already has audio, skipping`);
            continue;
          }
          
          // Generate audio from narration
          const audioBlob = await generateAudio(scene.narration);
          
          if (audioBlob) {
            // Save audio to file system
            if (fileSystemRef.current) {
              const filename = `scene-${scene.id}-audio.mp3`;
              console.log(`[VideoProcessor] Saving audio file: ${filename}`);
              const audioPath = await fileSystemRef.current.saveFile(audioBlob, filename, 'audio');
              console.log(`[VideoProcessor] Audio saved at path: ${audioPath}`);
              
              // Update scene with audio path
              updateScene(scene.id, { 
                audioPath,
                status: { 
                  ...scene.status, 
                  audioGenerated: true 
                }
              });
            } else {
              console.warn('[VideoProcessor] File system not available, cannot save audio');
            }
          }
        } catch (error: any) {
          console.error(`[VideoProcessor] Error generating audio for scene ${scene.id}:`, error);
          setError({
            message: `Failed to generate audio for scene ${scene.id}: ${error.message}`,
            stage: 'audio-generation',
            timestamp: new Date()
          });
        }
      }
      
      console.log('[VideoProcessor] All audio generation complete');
    } catch (error: any) {
      console.error('[VideoProcessor] Error generating all audio:', error);
      setError({
        message: `Failed to generate all audio: ${error.message}`,
        stage: 'audio-generation',
        timestamp: new Date()
      });
    } finally {
      setIsGeneratingAllAudio(false);
    }
  };

  const handleGenerateAllImages = async () => {
    if (!currentProject) {
      alert('Please create a project first');
      return;
    }

    if (!scenes || scenes.length === 0) {
      alert('No scenes to generate images for');
      return;
    }

    try {
      setIsGeneratingAllImages(true);
      
      // Initialize file system with user interaction
      if (fileSystemRef.current) {
        await fileSystemRef.current.initialize(true);
      }

      for (const scene of scenes) {
        if (!scene.imagePrompt) continue;
        
        try {
          console.log(`[VideoProcessor] Generating image for scene ${scene.id}`);
          
          // Skip if already has image
          if (scene.imagePath) {
            console.log(`[VideoProcessor] Scene ${scene.id} already has image, skipping`);
            continue;
          }
          
          // Generate image from image prompt
          const imageUrl = await generateImage(scene.imagePrompt, {
            isReel: currentProject?.videoFormat === 'reel'
          });
          
          if (imageUrl) {
            // Download and save image
            const image = await downloadImage(imageUrl);
            
            if (image && fileSystemRef.current) {
              const filename = `scene-${scene.id}-image.png`;
              console.log(`[VideoProcessor] Saving image file: ${filename}`);
              const imagePath = await fileSystemRef.current.saveFile(image, filename, 'image');
              console.log(`[VideoProcessor] Image saved at path: ${imagePath}`);
              
              // Update scene with image path
              updateScene(scene.id, { 
                imagePath,
                status: { 
                  ...scene.status, 
                  imageGenerated: true 
                }
              });
            } else {
              console.warn('[VideoProcessor] File system not available or image download failed, cannot save image');
            }
          }
        } catch (error: any) {
          console.error(`[VideoProcessor] Error generating image for scene ${scene.id}:`, error);
          setError({
            message: `Failed to generate image for scene ${scene.id}: ${error.message}`,
            stage: 'image-generation',
            timestamp: new Date()
          });
        }
      }
      
      console.log('[VideoProcessor] All image generation complete');
    } catch (error: any) {
      console.error('[VideoProcessor] Error generating all images:', error);
      setError({
        message: `Failed to generate all images: ${error.message}`,
        stage: 'image-generation',
        timestamp: new Date()
      });
    } finally {
      setIsGeneratingAllImages(false);
    }
  };

  const handleGenerateAllSubtitles = async () => {
    if (!scenes.length) {
      alert('No scenes to process');
      return;
    }

    try {
      setIsGeneratingAllSubtitles(true);
      
      // Initialize file system with user interaction
      if (fileSystemRef.current) {
        await fileSystemRef.current.initialize(true);
      }

      for (const scene of scenes) {
        if (!scene.audioPath) {
          console.log(`[VideoProcessor] Scene ${scene.id} has no audio, skipping subtitle generation`);
          continue;
        }
        
        // Skip if already has subtitles
        if (scene.subtitles?.segments?.length) {
          console.log(`[VideoProcessor] Scene ${scene.id} already has subtitles, skipping`);
          continue;
        }
        
        try {
          console.log(`[VideoProcessor] Generating subtitles for scene ${scene.id}`);
          
          // Get the audio blob
          let audioBlob: Blob;
          if (fileSystemRef.current) {
            audioBlob = await fileSystemRef.current.readFile(scene.audioPath, 'audio');
          } else {
            console.warn('[VideoProcessor] File system not available, cannot read audio');
            continue;
          }
          
          // Transcribe audio using Whisper
          const transcription = await transcribeAudio(audioBlob);
          
          // Process segments to ensure they have the correct format
          const subtitleSegments = transcription.segments.map(segment => ({
            id: segment.id,
            start: segment.start,
            end: segment.end,
            text: segment.text.trim(),
            words: segment.words?.map(word => ({
              word: word.word.trim(),
              start: word.start,
              end: word.end
            }))
          }));
          
          // Generate VTT format for saving
          const vttContent = generateVTT(transcription);
          
          // Save VTT file
          if (fileSystemRef.current) {
            const filename = `scene-${scene.id}-subtitles.vtt`;
            console.log(`[VideoProcessor] Saving subtitles file: ${filename}`);
            await fileSystemRef.current.saveFile(
              new Blob([vttContent], { type: 'text/vtt' }), 
              filename, 
              'video'
            );
          }
          
          // Update scene with subtitles
          updateScene(scene.id, { 
            subtitles: {
              segments: subtitleSegments,
              format: 'vtt',
              style: 'tiktok'
            },
            status: { 
              ...scene.status, 
              subtitlesGenerated: true 
            }
          });
          
          console.log(`[VideoProcessor] Subtitles generated for scene ${scene.id}:`, {
            segmentsCount: subtitleSegments.length,
            hasWordTimings: subtitleSegments.some(s => s.words && s.words.length > 0),
            firstSegment: subtitleSegments[0]
          });
        } catch (error: any) {
          console.error(`[VideoProcessor] Error generating subtitles for scene ${scene.id}:`, error);
          
          if (error.message.includes('API key')) {
            alert(`Failed to transcribe audio for scene ${scene.id}: Please check your OpenAI API key in settings.`);
            break;
          } else {
            setError({
              message: `Failed to generate subtitles for scene ${scene.id}: ${error.message}`,
              stage: 'subtitle-generation',
              timestamp: new Date()
            });
          }
        }
      }
      
      console.log('[VideoProcessor] All subtitles generation complete');
    } catch (error: any) {
      console.error('[VideoProcessor] Error generating all subtitles:', error);
      
      if (error.message.includes('API key')) {
        alert('Failed to transcribe audio: Please check your OpenAI API key in settings.');
      } else {
        setError({
          message: `Failed to generate all subtitles: ${error.message}`,
          stage: 'subtitle-generation',
          timestamp: new Date()
        });
      }
    } finally {
      setIsGeneratingAllSubtitles(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!currentProject) {
      console.error('[VideoProcessor] No current project');
      return;
    }

    // Check if all scenes have been processed
    const unprocessedScenes = scenes.filter(scene => !scene.audioPath || !scene.imagePath);
    if (unprocessedScenes.length > 0) {
      const proceed = window.confirm(
        `Some scenes (${unprocessedScenes.length}) are missing audio or images. Do you want to generate them now?`
      );
      if (proceed) {
        await handleGenerateAllAudio();
        await handleGenerateAllImages();
      } else {
        return;
      }
    }

    // Check if there are too many scenes for mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // More detailed warning for mobile users
      if (scenes.length > 8) {
        const proceed = window.confirm(
          `You're trying to generate a video with ${scenes.length} scenes on a mobile device. This may cause performance issues or browser crashes.\n\nRecommendations for mobile:\n- Use 5 or fewer scenes for best results\n- Close other browser tabs\n- Ensure your device has sufficient battery\n\nContinue anyway?`
        );
        if (!proceed) return;
      } else if (scenes.length > 5) {
        // Softer warning for 5-8 scenes
        const proceed = window.confirm(
          `You're generating a video with ${scenes.length} scenes on a mobile device. For best results on mobile, we recommend 5 or fewer scenes.\n\nContinue?`
        );
        if (!proceed) return;
      }
    }

    setIsGeneratingVideo(true);
    setVideoGenerationProgress({ stage: 'preparing', progress: 0 });
    console.log('[VideoProcessor] Starting video generation process...', {
      projectTitle: currentProject.title,
      videoFormat: currentProject.videoFormat,
      numberOfScenes: scenes.length
    });

    // Set up progress tracking with enhanced feedback
    const progressHandler = (progress: number) => {
      let stage: 'preparing' | 'processing' | 'finalizing';
      
      // Map progress to stages
      if (progress < 0.1) {
        stage = 'preparing';
        setVideoGenerationProgress({ 
          stage, 
          progress: progress * 10 * 100
        });
      } else if (progress < 0.9) {
        stage = 'processing';
        
        // Extract scene information from the progress message if available
        const { currentScene, totalScenes, sceneProgress } = projectService.getProgressDetails() || {};
        
        setVideoGenerationProgress({ 
          stage, 
          progress: ((progress - 0.1) / 0.8) * 100,
          currentScene,
          totalScenes,
          sceneProgress
        });
      } else {
        stage = 'finalizing';
        setVideoGenerationProgress({ 
          stage, 
          progress: (progress - 0.9) * 10 * 100
        });
      }
    };
    
    // Use the project service's progress callback
    projectService.setProgressCallback(progressHandler);

    try {
      // Generate video with timeout protection
      const timeoutPromise = new Promise<Blob>((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video generation timed out. Try with fewer scenes or a desktop browser.'));
        }, 420000); // 7 minute timeout
        return () => clearTimeout(timeout);
      });
      
      const videoPromise = projectService.generateVideo(scenes, currentProject);
      const video = await Promise.race([videoPromise, timeoutPromise]);
      
      // Create video URL for preview
      if (generatedVideoUrl) {
        console.log('[VideoProcessor] Revoking previous video URL');
        URL.revokeObjectURL(generatedVideoUrl);
      }
      const videoUrl = URL.createObjectURL(video);
      console.log('[VideoProcessor] Created new video URL for preview');
      setGeneratedVideoUrl(videoUrl);
      
      // Create download link
      const projectTitle = currentProject.title || 'generated-video';
      const safeTitle = projectTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Determine file extension based on MIME type
      const getFileExtension = (mimeType: string) => {
        if (mimeType.includes('mp4')) return 'mp4';
        if (mimeType.includes('webm')) return 'webm';
        return 'mp4'; // Default to mp4 as a fallback
      };
      
      const fileExtension = getFileExtension(video.type);
      const filename = `${safeTitle}-${timestamp}.${fileExtension}`;
      
      console.log('[VideoProcessor] Initiating video download', { filename, type: video.type });
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('[VideoProcessor] Video generation error:', error);
      setError({
        stage: 'video-generation',
        message: error.message || 'Failed to generate video',
        details: error,
        timestamp: new Date(),
      });
    } finally {
      setIsGeneratingVideo(false);
      setVideoGenerationProgress(null);
      projectService.setProgressCallback(null);
    }
  };

  const handleDeleteScene = (sceneId: string) => {
    const updatedScenes = scenes.filter(scene => scene.id !== sceneId)
      .map((scene, index) => ({
        ...scene,
        order: index + 1
      }));
    setScenes(updatedScenes);
  };

  // Enhanced progress display component
  const renderProgressBar = () => {
    if (!videoGenerationProgress) return null;
    
    const { stage, progress, currentScene, totalScenes, sceneProgress } = videoGenerationProgress;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let statusText = '';
    let statusProgress = 0;
    
    // Determine the appropriate status text and progress value
    if (stage === 'preparing') {
      statusText = 'Preparing assets...';
      statusProgress = progress;
    } else if (stage === 'processing') {
      if (currentScene && totalScenes) {
        statusText = `Processing scene ${currentScene}/${totalScenes}${sceneProgress ? ` (${Math.round(sceneProgress)}%)` : ''}`;
      } else {
        statusText = 'Processing scenes...';
      }
      statusProgress = progress;
    } else if (stage === 'finalizing') {
      statusText = 'Finalizing video...';
      statusProgress = progress;
    }
    
    return (
      <div className="w-full space-y-2 mt-4 mb-6 px-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{statusText}</span>
          <span>{Math.round(statusProgress)}%</span>
        </div>
        <Progress value={statusProgress} className="h-2" />
        {stage === 'preparing' && progress > 40 && progress < 60 && isMobile && (
          <p className="text-xs text-amber-500 mt-1">
            <strong>Mobile device detected:</strong> This stage may take longer on mobile. Please be patient and keep the browser tab open.
          </p>
        )}
        {stage === 'processing' && (
          <p className="text-xs text-muted-foreground mt-1">
            This may take several minutes depending on the number of scenes. Please don't close this tab.
            {isMobile && ' On mobile devices, this process can take significantly longer.'}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Video</CardTitle>
          <CardDescription>Enter a YouTube URL to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Youtube className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube URL here"
                className="w-full pl-12 pr-4 h-14 text-lg"
                disabled={isProcessing}
              />
            </div>

            {/* Format Selection and Submit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden sm:col-span-2">
                <Button
                  type="button"
                  variant={videoFormat === 'landscape' ? 'default' : 'outline'}
                  onClick={() => setVideoFormat('landscape')}
                  disabled={isProcessing}
                  className="rounded-none border-r-0 h-12 text-base"
                >
                  Landscape
                </Button>
                <Button
                  type="button"
                  variant={videoFormat === 'reel' ? 'default' : 'outline'}
                  onClick={() => setVideoFormat('reel')}
                  disabled={isProcessing}
                  className="rounded-none h-12 text-base"
                >
                  Reel
                </Button>
              </div>
              <Button 
                type="submit" 
                disabled={isProcessing || !url}
                className="h-12 text-base w-full"
              >
                <Youtube className="mr-2 h-5 w-5" />
                Process
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {currentProject ? (
        <Card>
          <CardHeader className="flex flex-col gap-4">
            <div>
              <CardTitle>Project: {currentProject.title}</CardTitle>
              <CardDescription>Manage your video scenes and assets</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <Button
                  variant="outline"
                  onClick={handleGenerateAllAudio}
                  disabled={isGeneratingAllAudio || isProcessing || isGeneratingVideo}
                  className="h-10"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  Generate All Audio
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateAllImages}
                  disabled={isGeneratingAllImages || isProcessing || isGeneratingVideo}
                  className="h-10"
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate All Images
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateAllSubtitles}
                  disabled={isGeneratingAllSubtitles || isProcessing || isGeneratingVideo}
                  className="h-10"
                >
                  <Subtitles className="mr-2 h-4 w-4" />
                  Generate All Subtitles
                </Button>
              </div>
              <Button
                variant="default"
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo || isProcessing}
                className="h-10"
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Generate Video
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isGeneratingVideo && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle>Generating Video</CardTitle>
                  <CardDescription>
                    Creating your video with {scenes.length} scenes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderProgressBar()}
                </CardContent>
              </Card>
            )}
            
            <Tabs defaultValue="scenes" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scenes">Scenes</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="scenes" className="mt-4">
                <div className="grid gap-6">
                  {scenes.map((scene) => (
                    <ScenePreview
                      key={scene.id}
                      scene={scene}
                      onDelete={() => handleDeleteScene(scene.id)}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="preview" className="mt-4">
                {generatedVideoUrl && (
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                    <VideoPlayerWithSubtitles
                      videoSrc={generatedVideoUrl}
                      width="100%"
                      height="auto"
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <ProjectList />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cache Management</CardTitle>
          <CardDescription>Manage your local cache storage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {cacheSize && (
                <div className="text-sm">
                  <p>Total: {(cacheSize.total / 1024 / 1024).toFixed(2)} MB</p>
                  <p>Audio: {(cacheSize.audio / 1024 / 1024).toFixed(2)} MB</p>
                  <p>Images: {(cacheSize.image / 1024 / 1024).toFixed(2)} MB</p>
                  <p>Video: {(cacheSize.video / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={loadCacheSize}
                disabled={isLoadingCacheSize}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearCache}
                disabled={isClearing || !cacheSize}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Cache
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 