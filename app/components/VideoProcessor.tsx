'use client';

import React, { useState } from 'react';
import { useProjectActions, useProcessingState, useScenes, useCurrentProject } from '@/lib/store';
import { ProjectService } from '@/lib/services/project';
import { getOrCreateTranscription } from '@/lib/services/youtube';
import { Scene } from '@/types';
import { ScenePreview } from '@/components/ScenePreview';
import { ProjectList } from '@/components/ProjectList';
import { generateAudio } from '@/lib/services/openai';
import { generateImage } from '@/lib/services/replicate';

export function VideoProcessor() {
  const [url, setUrl] = useState('');
  const { isProcessing, progress } = useProcessingState();
  const scenes = useScenes();
  const currentProject = useCurrentProject();
  const { createProject, setError, setScenes, updateScene } = useProjectActions();
  const projectService = new ProjectService();
  const [isGeneratingAllAudio, setIsGeneratingAllAudio] = useState(false);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    try {
      // Create new project
      const project = createProject(url);

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
    setIsGeneratingAllAudio(true);
    try {
      for (const scene of scenes) {
        if (!scene.status?.audioGenerated) {
          const audio = await generateAudio(scene.narration);
          
          // Convert Blob to data URL for storage
          const audioUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(audio);
          });

          updateScene(scene.id, {
            audio: audioUrl,
            status: { ...scene.status, audioGenerated: true }
          });
        }
      }
    } catch (error: any) {
      setError({
        stage: 'audio-generation',
        message: error.message,
        timestamp: new Date(),
      });
    } finally {
      setIsGeneratingAllAudio(false);
    }
  };

  const handleGenerateAllImages = async () => {
    setIsGeneratingAllImages(true);
    try {
      for (const scene of scenes) {
        if (!scene.status?.imageGenerated) {
          const imageUrl = await generateImage(scene.imagePrompt);
          updateScene(scene.id, {
            image: imageUrl,
            status: { ...scene.status, imageGenerated: true }
          });
        }
      }
    } catch (error: any) {
      setError({
        stage: 'image-generation',
        message: error.message,
        timestamp: new Date(),
      });
    } finally {
      setIsGeneratingAllImages(false);
    }
  };

  const handleGenerateVideo = async () => {
    try {
      if (!scenes || scenes.length === 0) {
        throw new Error('No scenes available to process');
      }

      // Check if all scenes have audio and images
      const allScenesReady = scenes.every(
        scene => scene.status?.audioGenerated && scene.status?.imageGenerated
      );

      if (!allScenesReady) {
        throw new Error('Please generate all audio and images before creating the video');
      }

      // Process scenes sequentially
      const processedScenes = [];
      for (const scene of scenes) {
        // Convert data URL to Blob
        const audioDataUrl = scene.audio as string;
        const response = await fetch(audioDataUrl);
        const audioBlob = await response.blob();

        processedScenes.push({
          ...scene,
          audio: audioBlob
        });
      }

      // Generate final video with processed scenes
      const video = await projectService.generateVideo(processedScenes);
      
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
                disabled={!scenes.every(scene => scene.status?.audioGenerated && scene.status?.imageGenerated)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Final Video
              </button>
            </div>
          </div>
          <div className="grid gap-6">
            {scenes.map((scene) => (
              <ScenePreview 
                key={scene.id} 
                scene={scene} 
                onDelete={handleDeleteScene}
              />
            ))}
          </div>
        </div>
      )}

      {!currentProject && <ProjectList />}
    </div>
  );
} 