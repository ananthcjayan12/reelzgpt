'use client';

import React from 'react';
import { Scene } from '@/types';
import { generateAudio } from '@/lib/services/openai';
import { generateImage, downloadImage } from '@/lib/services/replicate';
import { useProjectActions, useCurrentProject } from '@/lib/store';
import { AudioPlayer } from './AudioPlayer';
import { Trash2 } from 'lucide-react';
import { FileSystemService } from '@/lib/services/filesystem';

interface ScenePreviewProps {
  scene: Scene;
  onDelete: (sceneId: string) => void;
}

export function ScenePreview({ scene, onDelete }: ScenePreviewProps) {
  const { updateScene, setError } = useProjectActions();
  const currentProject = useCurrentProject();
  const [isGeneratingAudio, setIsGeneratingAudio] = React.useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = React.useState(false);
  const [isEditingNarration, setIsEditingNarration] = React.useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = React.useState(false);
  const [narration, setNarration] = React.useState(scene.narration);
  const [imagePrompt, setImagePrompt] = React.useState(scene.imagePrompt);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const fileSystem = new FileSystemService();

  // Ensure scene has status
  const status = scene.status || { audioGenerated: false, imageGenerated: false };

  // Load image when imagePath changes
  React.useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (scene.imagePath) {
        try {
          console.log('[ScenePreview] Loading image from cache:', scene.imagePath);
          const imageBlob = await fileSystem.readFile(scene.imagePath, 'image');
          if (isMounted) {
            const url = URL.createObjectURL(imageBlob);
            setImageUrl(url);
            console.log('[ScenePreview] Image loaded and URL created');
          }
        } catch (error: any) {
          console.error('[ScenePreview] Failed to load image:', error);
          setError({
            stage: 'image-loading',
            message: `Failed to load image: ${error.message}`,
            timestamp: new Date(),
          });
        }
      } else {
        setImageUrl(null);
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [scene.imagePath]);

  const handleGenerateAudio = async () => {
    setIsGeneratingAudio(true);
    try {
      console.log('[ScenePreview] Starting audio generation for scene:', scene.id);
      
      // Step 1: Initialize file system
      console.log('[ScenePreview] Initializing file system...');
      await fileSystem.initialize(true);
      
      // Step 2: Generate audio
      console.log('[ScenePreview] Generating audio for narration:', narration);
      const audioResponse = await generateAudio(narration);
      console.log('[ScenePreview] Audio generation successful');
      
      // Step 3: Prepare audio blob
      const audioBlob = audioResponse instanceof Blob 
        ? audioResponse 
        : new Blob([audioResponse], { type: 'audio/mpeg' });
      
      console.log('[ScenePreview] Audio blob prepared:', {
        type: audioBlob.type,
        size: audioBlob.size
      });
      
      // Step 4: Save file
      const filename = `scene-${scene.id}-audio.mp3`;
      console.log('[ScenePreview] Saving audio file:', filename);
      const audioPath = await fileSystem.saveFile(audioBlob, filename, 'audio');
      console.log('[ScenePreview] Audio file saved at:', audioPath);
      
      // Step 5: Update scene
      const updatedScene = {
        ...scene,
        audioPath,
        status: { ...status, audioGenerated: true }
      };
      console.log('[ScenePreview] Updating scene with:', updatedScene);
      updateScene(scene.id, updatedScene);
      
      // Step 6: Verify file exists
      try {
        const savedFile = await fileSystem.readFile(audioPath, 'audio');
        console.log('[ScenePreview] Verified saved file:', {
          type: savedFile.type,
          size: savedFile.size
        });
      } catch (verifyError) {
        console.error('[ScenePreview] Failed to verify saved file:', verifyError);
        throw new Error('Failed to verify saved audio file');
      }

    } catch (error: any) {
      console.error('[ScenePreview] Audio generation error:', error);
      setError({
        stage: 'audio-generation',
        message: error.message,
        timestamp: new Date(),
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Add error boundary for AudioPlayer
  const renderAudioPlayer = () => {
    if (!scene.audioPath) return null;
    
    try {
      return (
        <>
          <div className="text-sm text-gray-500 mb-2">
            Audio file ID: {scene.audioPath.split('-').pop()}
          </div>
          <AudioPlayer key={scene.audioPath} audioPath={scene.audioPath} />
        </>
      );
    } catch (error) {
      console.error('[ScenePreview] Error rendering AudioPlayer:', error);
      return (
        <div className="text-red-500">
          Error loading audio player. Please try regenerating the audio.
        </div>
      );
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      // Initialize file system with user interaction
      await fileSystem.initialize(true);
      
      const imageUrl = await generateImage(imagePrompt, {
        isReel: currentProject?.videoFormat === 'reel'
      });
      const image = await downloadImage(imageUrl);
      const imagePath = await fileSystem.saveFile(image, `scene-${scene.id}-image.png`, 'image');
      
      updateScene(scene.id, {
        imagePath,
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

  const handleSaveNarration = () => {
    updateScene(scene.id, {
      narration,
      status: { ...status, audioGenerated: false }
    });
    setIsEditingNarration(false);
  };

  const handleSavePrompt = () => {
    updateScene(scene.id, {
      imagePrompt,
      status: { ...status, imageGenerated: false }
    });
    setIsEditingPrompt(false);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this scene? This action cannot be undone.')) {
      // Delete associated files
      if (scene.audioPath) {
        fileSystem.deleteFile(scene.audioPath, 'audio').catch(console.error);
      }
      if (scene.imagePath) {
        fileSystem.deleteFile(scene.imagePath, 'image').catch(console.error);
      }
      onDelete(scene.id);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Scene number and delete button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Scene {scene.order}</h3>
        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700"
          title="Delete scene"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Narration section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-medium">Narration</h4>
          <button
            onClick={() => setIsEditingNarration(!isEditingNarration)}
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            {isEditingNarration ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {isEditingNarration ? (
          <div className="space-y-2">
            <textarea
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full h-24 p-2 border rounded"
            />
            <button
              onClick={handleSaveNarration}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        ) : (
          <p className="text-sm">{scene.narration}</p>
        )}
      </div>

      {/* Audio section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-medium">Audio</h4>
          <button
            onClick={handleGenerateAudio}
            disabled={isGeneratingAudio}
            className="bg-green-500 text-white px-4 py-1 rounded text-sm hover:bg-green-600 disabled:bg-gray-400"
          >
            {isGeneratingAudio ? 'Generating...' : 'Generate Audio'}
          </button>
        </div>
        {renderAudioPlayer()}
      </div>

      {/* Image prompt section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-medium">Image Prompt</h4>
          <button
            onClick={() => setIsEditingPrompt(!isEditingPrompt)}
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            {isEditingPrompt ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {isEditingPrompt ? (
          <div className="space-y-2">
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              className="w-full h-24 p-2 border rounded"
            />
            <button
              onClick={handleSavePrompt}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        ) : (
          <p className="text-sm">{scene.imagePrompt}</p>
        )}
      </div>

      {/* Image section */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-medium">Image</h4>
          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
            className="bg-green-500 text-white px-4 py-1 rounded text-sm hover:bg-green-600 disabled:bg-gray-400"
          >
            {isGeneratingImage ? 'Generating...' : 'Generate Image'}
          </button>
        </div>
        {imageUrl && (
          <div className="relative aspect-video">
            <img
              src={imageUrl}
              alt={`Scene ${scene.order}`}
              className="rounded-lg object-cover w-full h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
} 