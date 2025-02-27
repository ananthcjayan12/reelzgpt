'use client';

import React, { useState, useEffect } from 'react';
import { Scene } from '@/types';
import { generateAudio } from '@/lib/services/openai';
import { generateImage, downloadImage } from '@/lib/services/replicate';
import { FileSystemService } from '@/lib/services/filesystem';
import { useProjectActions } from '@/lib/store';
import { VideoPlayerWithSubtitles } from './VideoPlayerWithSubtitles';
import { transcribeAudio } from '@/lib/services/whisper';
import { useSettingsStore } from '@/lib/store/settings';

interface ScenePreviewProps {
  scene: Scene;
  onDelete: (sceneId: string) => void;
}

export function ScenePreview({ scene, onDelete }: ScenePreviewProps) {
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Edit mode states
  const [isEditingNarration, setIsEditingNarration] = useState(false);
  const [isEditingImagePrompt, setIsEditingImagePrompt] = useState(false);
  const [editedNarration, setEditedNarration] = useState(scene.narration);
  const [editedImagePrompt, setEditedImagePrompt] = useState(scene.imagePrompt);
  
  const { updateScene, setError } = useProjectActions();
  const fileSystem = new FileSystemService();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Update edited content when scene changes
  useEffect(() => {
    setEditedNarration(scene.narration);
    setEditedImagePrompt(scene.imagePrompt);
  }, [scene.narration, scene.imagePrompt]);

  // Load image and audio when component mounts or paths change
  useEffect(() => {
    async function loadMedia() {
      try {
        // Load image if available
        if (scene.imagePath) {
          const imageBlob = await fileSystem.readFile(scene.imagePath, 'image');
          const url = URL.createObjectURL(imageBlob);
          setImageUrl(url);
        }

        // Load audio if available
        if (scene.audioPath) {
          const audioBlob = await fileSystem.readFile(scene.audioPath, 'audio');
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        }
      } catch (error) {
        console.error('Error loading media:', error);
      }
    }

    loadMedia();

    // Cleanup URLs on unmount
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [scene.imagePath, scene.audioPath]);

  const handleGenerateAudio = async () => {
    try {
      setIsGeneratingAudio(true);
      
      // Initialize file system with user interaction
      await fileSystem.initialize(true);
      
      // Generate audio from narration
      const audioBlob = await generateAudio(scene.narration);
      
      // Save audio to file system
      const filename = `scene-${scene.id}-audio.mp3`;
      const audioPath = await fileSystem.saveFile(audioBlob, filename, 'audio');
      
      // Update scene with audio path
      updateScene(scene.id, { 
        audioPath,
        status: { 
          ...scene.status, 
          audioGenerated: true 
        }
      });
    } catch (error: any) {
      console.error('Error generating audio:', error);
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
    try {
      setIsGeneratingImage(true);
      
      // Initialize file system with user interaction
      await fileSystem.initialize(true);
      
      // Generate image from prompt
      const imageUrl = await generateImage(scene.imagePrompt);
      
      // Download and save image
      const image = await downloadImage(imageUrl);
      
      // Save image to file system
      const filename = `scene-${scene.id}-image.png`;
      const imagePath = await fileSystem.saveFile(image, filename, 'image');
      
      // Update scene with image path
      updateScene(scene.id, { 
        imagePath,
        status: { 
          ...scene.status, 
          imageGenerated: true 
        }
      });
    } catch (error: any) {
      console.error('Error generating image:', error);
      setError({
        stage: 'image-generation',
        message: error.message,
        timestamp: new Date(),
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateSubtitles = async () => {
    if (!scene.audioPath) {
      alert('Please generate audio first');
      return;
    }

    // Check if OpenAI API key is set
    const settings = useSettingsStore.getState();
    if (!settings.openaiApiKey) {
      alert('OpenAI API key is not set. Please configure it in the settings.');
      return;
    }

    try {
      setIsGeneratingSubtitles(true);
      
      // Initialize file system with user interaction
      await fileSystem.initialize(true);
      
      // Get the audio blob
      const audioBlob = await fileSystem.readFile(scene.audioPath, 'audio');
      console.log('[ScenePreview] Audio blob retrieved:', {
        type: audioBlob.type,
        size: audioBlob.size
      });
      
      // Transcribe audio using Whisper
      console.log('[ScenePreview] Calling Whisper transcription service...');
      const transcription = await transcribeAudio(audioBlob);
      
      // Log the transcription result for debugging
      console.log('[ScenePreview] Transcription result:', {
        text: transcription.text,
        segmentsCount: transcription.segments?.length || 0,
        hasWords: Boolean(transcription.words && transcription.words.length > 0),
        firstSegment: transcription.segments && transcription.segments[0] ? {
          start: transcription.segments[0].start,
          end: transcription.segments[0].end,
          text: transcription.segments[0].text,
          hasWords: Boolean(transcription.segments[0].words && transcription.segments[0].words.length > 0)
        } : 'No segments'
      });
      
      // Update scene with subtitles, including word-level timestamps
      updateScene(scene.id, { 
        subtitles: {
          segments: transcription.segments.map(segment => ({
            id: segment.id,
            start: segment.start,
            end: segment.end,
            text: segment.text.trim(),
            words: segment.words || [] // Include word-level timestamps if available
          })),
          format: 'vtt',
          style: 'tiktok'
        },
        status: { 
          ...scene.status, 
          subtitlesGenerated: true 
        }
      });
      
      console.log('[ScenePreview] Generated subtitles with word-level timestamps:', 
        transcription.segments.some(s => s.words && s.words.length > 0) ? 'Yes' : 'No');
    } catch (error: any) {
      console.error('Error generating subtitles:', error);
      
      // Show a more user-friendly error message for API key issues
      if (error.message.includes('API key')) {
        alert('Failed to transcribe audio: Please check your OpenAI API key in settings.');
      } else {
        setError({
          stage: 'subtitle-generation',
          message: error.message,
          timestamp: new Date(),
        });
        
        // Show a more detailed alert for debugging
        alert(`Failed to generate subtitles: ${error.message}\nPlease check the console for more details.`);
      }
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  const handleSaveNarration = () => {
    updateScene(scene.id, { 
      narration: editedNarration,
      // If narration changes, mark audio as needing regeneration
      status: { 
        ...scene.status, 
        audioGenerated: false 
      },
      // Clear audio path if it exists
      audioPath: undefined,
      // Clear subtitles if they exist
      subtitles: undefined
    });
    setIsEditingNarration(false);
  };

  const handleSaveImagePrompt = () => {
    updateScene(scene.id, { 
      imagePrompt: editedImagePrompt,
      // If image prompt changes, mark image as needing regeneration
      status: { 
        ...scene.status, 
        imageGenerated: false 
      },
      // Clear image path if it exists
      imagePath: undefined
    });
    setIsEditingImagePrompt(false);
  };

  const handlePlayPreview = () => {
    setIsPlaying(true);
  };

  // Button component for regenerate/edit actions
  const ActionButton = ({ 
    onClick, 
    disabled = false, 
    className = "", 
    children 
  }: { 
    onClick: () => void, 
    disabled?: boolean, 
    className?: string, 
    children: React.ReactNode 
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 text-xs rounded-md ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-white shadow-sm">
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-lg">Scene {scene.order}</h3>
        <button
          onClick={() => onDelete(scene.id)}
          className="text-red-500 hover:text-red-700"
        >
          Delete
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Narration</h4>
              <div className="flex space-x-2">
                <ActionButton 
                  onClick={() => setIsEditingNarration(!isEditingNarration)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                >
                  {isEditingNarration ? 'Cancel' : 'Edit'}
                </ActionButton>
                {isEditingNarration && (
                  <ActionButton 
                    onClick={handleSaveNarration}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    Save
                  </ActionButton>
                )}
                {!isEditingNarration && scene.audioPath && (
                  <ActionButton 
                    onClick={handleGenerateAudio}
                    disabled={isGeneratingAudio}
                    className="bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingAudio ? 'Regenerating...' : 'Regenerate'}
                  </ActionButton>
                )}
              </div>
            </div>
            {isEditingNarration ? (
              <textarea
                value={editedNarration}
                onChange={(e) => setEditedNarration(e.target.value)}
                className="w-full h-32 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter narration text"
              />
            ) : (
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md h-32 overflow-y-auto">
                {scene.narration}
              </p>
            )}
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Image Prompt</h4>
              <div className="flex space-x-2">
                <ActionButton 
                  onClick={() => setIsEditingImagePrompt(!isEditingImagePrompt)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                >
                  {isEditingImagePrompt ? 'Cancel' : 'Edit'}
                </ActionButton>
                {isEditingImagePrompt && (
                  <ActionButton 
                    onClick={handleSaveImagePrompt}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    Save
                  </ActionButton>
                )}
                {!isEditingImagePrompt && scene.imagePath && (
                  <ActionButton 
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage}
                    className="bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingImage ? 'Regenerating...' : 'Regenerate'}
                  </ActionButton>
                )}
              </div>
            </div>
            {isEditingImagePrompt ? (
              <textarea
                value={editedImagePrompt}
                onChange={(e) => setEditedImagePrompt(e.target.value)}
                className="w-full h-32 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter image prompt"
              />
            ) : (
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md h-32 overflow-y-auto">
                {scene.imagePrompt}
              </p>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          {scene.imagePath ? (
            <div>
              <h4 className="font-medium mb-2">Generated Image</h4>
              <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Scene ${scene.order}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Loading image...</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h4 className="font-medium mb-2">Image</h4>
              <div className="flex justify-center items-center h-40 bg-gray-100 rounded-md">
                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                </button>
              </div>
            </div>
          )}
          
          <div>
            <h4 className="font-medium mb-2">Audio</h4>
            {scene.audioPath ? (
              <div className="space-y-2">
                {audioUrl ? (
                  <audio
                    src={audioUrl}
                    controls
                    className="w-full"
                  />
                ) : (
                  <div className="h-10 bg-gray-100 rounded-md flex items-center justify-center">
                    <p className="text-gray-500">Loading audio...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center items-center h-12 bg-gray-100 rounded-md">
                <button
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingAudio ? 'Generating...' : 'Generate Audio'}
                </button>
              </div>
            )}
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Subtitles</h4>
              {scene.subtitles && scene.subtitles.segments && scene.subtitles.segments.length > 0 && (
                <ActionButton 
                  onClick={handleGenerateSubtitles}
                  disabled={isGeneratingSubtitles || !scene.audioPath}
                  className="bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingSubtitles ? 'Regenerating...' : 'Regenerate'}
                </ActionButton>
              )}
            </div>
            {scene.subtitles && scene.subtitles.segments && scene.subtitles.segments.length > 0 ? (
              <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md max-h-32 overflow-y-auto">
                <p className="text-xs text-gray-500 mb-2">
                  {scene.subtitles.segments.length} subtitle segments generated
                </p>
                {scene.subtitles.segments.slice(0, 3).map((segment, index) => (
                  <div key={index} className="mb-2 pb-2 border-b border-gray-200 last:border-0">
                    <div className="text-xs text-gray-500">
                      {Math.floor(segment.start / 60)}:{(segment.start % 60).toFixed(2).padStart(5, '0')} - 
                      {Math.floor(segment.end / 60)}:{(segment.end % 60).toFixed(2).padStart(5, '0')}
                    </div>
                    <div>{segment.text}</div>
                  </div>
                ))}
                {scene.subtitles.segments.length > 3 && (
                  <p className="text-xs text-gray-500 mt-2">
                    ... and {scene.subtitles.segments.length - 3} more segments
                  </p>
                )}
              </div>
            ) : scene.audioPath ? (
              <div className="flex justify-center items-center h-12 bg-gray-100 rounded-md">
                <button
                  onClick={handleGenerateSubtitles}
                  disabled={isGeneratingSubtitles || !scene.audioPath}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingSubtitles ? 'Generating...' : 'Generate Subtitles'}
                </button>
              </div>
            ) : (
              <div className="flex justify-center items-center h-12 bg-gray-100 rounded-md">
                <p className="text-sm text-gray-500">Generate audio first</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {scene.audioPath && scene.imagePath && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Preview</h4>
          {isPlaying ? (
            <VideoPlayerWithSubtitles
              videoSrc={imageUrl || ''}
              audioSrc={audioUrl || ''}
              subtitles={scene.subtitles?.segments}
              subtitleStyle="tiktok"
              width="100%"
              height="240px"
            />
          ) : (
            <div className="flex justify-center items-center h-40 bg-gray-100 rounded-md">
              <button
                onClick={handlePlayPreview}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Play Preview
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 