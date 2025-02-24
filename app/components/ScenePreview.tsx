'use client';

import React from 'react';
import { Scene } from '@/types';
import { generateAudio } from '@/lib/services/openai';
import { generateImage } from '@/lib/services/replicate';
import { useProjectActions } from '@/lib/store';
import { AudioPlayer } from './AudioPlayer';

interface ScenePreviewProps {
  scene: Scene;
}

export function ScenePreview({ scene }: ScenePreviewProps) {
  const { updateScene, setError } = useProjectActions();
  const [isGeneratingAudio, setIsGeneratingAudio] = React.useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = React.useState(false);

  // Ensure scene has status
  const status = scene.status || { audioGenerated: false, imageGenerated: false };

  const handleGenerateAudio = async () => {
    setIsGeneratingAudio(true);
    try {
      const audio = await generateAudio(scene.narration);
      updateScene(scene.id, {
        audio,
        status: { ...status, audioGenerated: true }
      });
    } catch (error: any) {
      setError({
        stage: 'audio-generation',
        message: error.message,
        timestamp: new Date(),
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      const imageUrl = await generateImage(scene.imagePrompt);
      updateScene(scene.id, {
        image: imageUrl,
        status: { ...status, imageGenerated: true }
      });
    } catch (error: any) {
      setError({
        stage: 'image-generation',
        message: error.message,
        timestamp: new Date(),
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="p-6 border rounded-lg space-y-4 bg-white">
      <div className="flex justify-between items-start">
        <h3 className="font-medium">Scene {scene.order}</h3>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateAudio}
            disabled={isGeneratingAudio || status.audioGenerated}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingAudio ? 'Generating...' : status.audioGenerated ? 'Audio Generated' : 'Generate Audio'}
          </button>
          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage || status.imageGenerated}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingImage ? 'Generating...' : status.imageGenerated ? 'Image Generated' : 'Generate Image'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <h4 className="text-sm font-medium text-gray-700">Narration</h4>
          <p className="text-sm text-gray-600">{scene.narration}</p>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700">Image Prompt</h4>
          <p className="text-sm text-gray-600">{scene.imagePrompt}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700">Mood</h4>
          <p className="text-sm text-gray-600 capitalize">{scene.mood}</p>
        </div>
      </div>

      {scene.audio && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Generated Audio</h4>
          <AudioPlayer audioBlob={scene.audio} />
        </div>
      )}

      {scene.image && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Generated Image</h4>
          <img
            src={scene.image}
            alt={`Scene ${scene.order}`}
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>
      )}
    </div>
  );
} 