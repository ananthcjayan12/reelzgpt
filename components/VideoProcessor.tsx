'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProjectActions, useProcessingState, useScenes, useCurrentProject } from '@/lib/store';
import { ProjectService } from '@/lib/services/project';
import { getOrCreateTranscription } from '@/lib/services/youtube';
import { Scene } from '@/types';
import { ScenePreview } from '@/components/ScenePreview';
import { ProjectList } from '@/components/ProjectList';
import { generateAudio } from '@/lib/services/openai';
import { generateImage, downloadImage } from '@/lib/services/replicate';
import { FileSystemService } from '@/lib/services/filesystem';

export function VideoProcessor() {
  const [url, setUrl] = useState('');
  const [videoFormat, setVideoFormat] = useState<'landscape' | 'reel'>('landscape');
  const { isProcessing, progress } = useProcessingState();
  const scenes = useScenes();
  const currentProject = useCurrentProject();
  const { createProject, setError, setScenes, updateScene } = useProjectActions();
  const projectService = new ProjectService();
  const [isGeneratingAllAudio, setIsGeneratingAllAudio] = useState(false);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [cacheSize, setCacheSize] = useState<{ total: number; audio: number; image: number; video: number } | null>(null);
  const [isLoadingCacheSize, setIsLoadingCacheSize] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileSystemRef = useRef<FileSystemService | null>(null);

  // Initialize FileSystemService only on the client side
  useEffect(() => {
    fileSystemRef.current = new FileSystemService();
    // Load cache size after FileSystemService is initialized
    loadCacheSize();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
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

  const handleGenerateVideo = async () => {
    try {
      if (!scenes || scenes.length === 0 || !currentProject) {
        throw new Error('No scenes available to process');
      }

      // Check if all scenes have audio and images
      const allScenesReady = scenes.every(
        scene => (scene.status?.audioGenerated || scene.audioPath) && 
                (scene.status?.imageGenerated || scene.imagePath)
      );

      if (!allScenesReady) {
        throw new Error('Please generate all audio and images before creating the video');
      }

      // Generate the video
      const video = await projectService.generateVideo(scenes, currentProject);
      
      // Create download link
      const videoUrl = URL.createObjectURL(video);
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'generated-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(videoUrl);

    } catch (error: any) {
      setError({
        stage: 'video-processing',
        message: error.message,
        details: error,
        timestamp: new Date(),
      });
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-center">
          Generate AI Videos from YouTube Content
        </h1>
        <p className="text-gray-500 text-center">
          Enter a YouTube URL to create an AI-powered video with narration and visuals
        </p>
      </div>

      {/* Cache info and clear button */}
      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
        <div>
          {isLoadingCacheSize ? (
            <p className="text-sm text-gray-500">Loading cache info...</p>
          ) : cacheSize ? (
            <div className="text-sm">
              <p className="font-medium">Cache usage:</p>
              <p>Total: {(cacheSize.total / (1024 * 1024)).toFixed(2)} MB</p>
              <p>Audio: {(cacheSize.audio / (1024 * 1024)).toFixed(2)} MB</p>
              <p>Images: {(cacheSize.image / (1024 * 1024)).toFixed(2)} MB</p>
              <p>Videos: {(cacheSize.video / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Cache info not available</p>
          )}
        </div>
        <button
          onClick={handleClearCache}
          disabled={isClearing || !cacheSize || cacheSize.total === 0}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isClearing ? 'Clearing...' : 'Clear Cache'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter YouTube URL"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          />
          <select
            value={videoFormat}
            onChange={(e) => setVideoFormat(e.target.value as 'landscape' | 'reel')}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          >
            <option value="landscape">Landscape (16:9)</option>
            <option value="reel">Vertical Reel (9:16)</option>
          </select>
          <button
            type="submit"
            disabled={isProcessing || !url}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Generate Scenes'}
          </button>
        </div>
      </form>

      {isProcessing && progress && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{progress.message}</p>
          <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress.progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {currentProject && scenes.length > 0 && !isProcessing && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Current Project</h2>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateAllAudio}
                disabled={isGeneratingAllAudio || scenes.every(scene => scene.status?.audioGenerated)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingAllAudio ? 'Generating...' : 'Generate All Audio'}
              </button>
              <button
                onClick={handleGenerateAllImages}
                disabled={isGeneratingAllImages || scenes.every(scene => scene.status?.imageGenerated)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingAllImages ? 'Generating...' : 'Generate All Images'}
              </button>
              <button
                onClick={handleGenerateVideo}
                disabled={!scenes.every(scene => 
                  (scene.status?.audioGenerated || scene.audioPath) && 
                  (scene.status?.imageGenerated || scene.imagePath)
                )}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Final Video
              </button>
            </div>
          </div>
          <div className="grid gap-6">
            {scenes.map((scene) => {
              console.log('[VideoProcessor] Rendering scene:', scene);
              return (
                <ScenePreview 
                  key={scene.id} 
                  scene={scene} 
                  onDelete={handleDeleteScene}
                />
              );
            })}
          </div>
        </div>
      )}

      {!currentProject && <ProjectList />}
    </div>
  );
} 