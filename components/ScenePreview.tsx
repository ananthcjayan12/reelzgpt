'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Scene } from '@/types';
import { generateAudio } from '@/lib/services/openai';
import { generateImage, downloadImage } from '@/lib/services/replicate';
import { FileSystemService } from '@/lib/services/filesystem';
import { useProjectActions } from '@/lib/store';
import { VideoPlayerWithSubtitles } from './VideoPlayerWithSubtitles';
import { transcribeAudio } from '@/lib/services/whisper';
import { useSettingsStore } from '@/lib/store/settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Mic, 
  Image as ImageIcon, 
  Play, 
  Upload, 
  Save, 
  Trash2,
  Subtitles
} from 'lucide-react';

interface ScenePreviewProps {
  scene: Scene;
  onDelete: (sceneId: string) => void;
}

export function ScenePreview({ scene, onDelete }: ScenePreviewProps) {
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  
  // Edit mode states
  const [isEditingNarration, setIsEditingNarration] = useState(false);
  const [isEditingImagePrompt, setIsEditingImagePrompt] = useState(false);
  const [editedNarration, setEditedNarration] = useState(scene.narration);
  const [editedImagePrompt, setEditedImagePrompt] = useState(scene.imagePrompt);
  
  const { updateScene, setError } = useProjectActions();
  const fileSystem = new FileSystemService();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Refs for file inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

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

  // Update audio URL when audio is generated or uploaded
  useEffect(() => {
    async function loadAudio() {
      if (scene.audioPath) {
        try {
          const audioBlob = await fileSystem.readFile(scene.audioPath, 'audio');
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl); // Clean up old URL
          }
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
        } catch (error) {
          console.error('Error loading audio:', error);
        }
      }
    }

    loadAudio();
  }, [scene.audioPath]); // Re-run when audioPath changes

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
      
      // Create audio URL for immediate preview
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      const newAudioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(newAudioUrl);
      
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

      // Process segments to ensure they have the correct format
      const subtitleSegments = transcription.segments.map(segment => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
        words: segment.words || []
      }));
      
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
      
      console.log('[ScenePreview] Subtitles generated and saved:', {
        segmentsCount: subtitleSegments.length,
        hasWordTimings: subtitleSegments.some(s => s.words && s.words.length > 0)
      });
    } catch (error: any) {
      console.error('[ScenePreview] Error generating subtitles:', error);
      
      if (error.message.includes('API key')) {
        alert('Failed to transcribe audio: Please check your OpenAI API key in settings.');
      } else {
        setError({
          stage: 'subtitle-generation',
          message: error.message,
          timestamp: new Date(),
        });
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

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setIsUploadingImage(true);
      
      // Initialize file system with user interaction
      await fileSystem.initialize(true);
      
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }
      
      // Save image to file system
      const filename = `scene-${scene.id}-image-custom.${file.name.split('.').pop()}`;
      const imagePath = await fileSystem.saveFile(file, filename, 'image');
      
      // Update scene with image path
      updateScene(scene.id, { 
        imagePath,
        status: { 
          ...scene.status, 
          imageGenerated: true 
        }
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setError({
        stage: 'image-upload',
        message: error.message,
        timestamp: new Date(),
      });
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setIsUploadingAudio(true);
      
      // Initialize file system with user interaction
      await fileSystem.initialize(true);
      
      // Check if file is an audio
      if (!file.type.startsWith('audio/')) {
        throw new Error('Please upload an audio file');
      }
      
      // Save audio to file system
      const filename = `scene-${scene.id}-audio-custom.${file.name.split('.').pop()}`;
      const audioPath = await fileSystem.saveFile(file, filename, 'audio');
      
      // Create audio URL for immediate preview
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      const newAudioUrl = URL.createObjectURL(file);
      setAudioUrl(newAudioUrl);
      
      // Update scene with audio path
      updateScene(scene.id, { 
        audioPath,
        status: { 
          ...scene.status, 
          audioGenerated: true 
        },
        // Clear subtitles if they exist since we have new audio
        subtitles: undefined
      });
    } catch (error: any) {
      console.error('Error uploading audio:', error);
      setError({
        stage: 'audio-upload',
        message: error.message,
        timestamp: new Date(),
      });
    } finally {
      setIsUploadingAudio(false);
      // Reset file input
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    }
  };

  // Clean up URLs when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Scene {scene.id}</CardTitle>
          <Button variant="destructive" size="icon" onClick={() => onDelete(scene.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Narration</label>
            <div className="mt-1 relative">
              <Textarea
                value={editedNarration}
                onChange={(e) => setEditedNarration(e.target.value)}
                placeholder="Enter the narration text for this scene. This will be converted to speech."
                className="min-h-[120px] text-base leading-relaxed resize-y"
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {editedNarration?.length || 0} characters
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <Button variant="outline" size="sm" onClick={handleSaveNarration}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Image Prompt</label>
            <div className="mt-1 relative">
              <Textarea
                value={editedImagePrompt}
                onChange={(e) => setEditedImagePrompt(e.target.value)}
                placeholder="Describe the image you want to generate. Be specific and detailed for better results."
                className="min-h-[120px] text-base leading-relaxed resize-y"
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {editedImagePrompt?.length || 0} characters
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <Button variant="outline" size="sm" onClick={handleSaveImagePrompt}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Audio</h3>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio || !scene.narration}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Generate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => audioInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleUploadAudio}
                  className="hidden"
                />
              </div>
            </div>
            {audioUrl && (
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="p-4">
                  <audio controls className="w-full">
                    <source src={audioUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Image</h3>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage || !editedImagePrompt}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Generate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImage}
                  className="hidden"
                />
              </div>
            </div>
            {scene.imagePath && (
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                <img
                  src={imageUrl || ''}
                  alt="Scene"
                  className="w-full h-48 object-cover"
                />
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Preview</h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSubtitles}
                disabled={isGeneratingSubtitles || !scene.audioPath}
              >
                <Subtitles className="h-4 w-4 mr-2" />
                {isGeneratingSubtitles ? 'Generating...' : 'Generate Subtitles'}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePlayPreview}
                disabled={!scene.audioPath || !scene.imagePath}
              >
                <Play className="h-4 w-4 mr-2" />
                Play
              </Button>
            </div>
          </div>

          {isPlaying && scene.audioPath && scene.imagePath && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <VideoPlayerWithSubtitles
                  videoSrc={imageUrl || ''}
                  audioSrc={audioUrl || ''}
                  subtitles={scene.subtitles?.segments || []}
                  width="100%"
                  height="auto"
                  onError={(error: Error) => {
                    console.error('[ScenePreview] Video player error:', error);
                    setError({
                      stage: 'preview-playback',
                      message: 'Error playing preview: ' + error.message,
                      timestamp: new Date(),
                    });
                  }}
                />
              </div>

              {/* Subtitle timeline preview */}
              {scene.subtitles?.segments && scene.subtitles.segments.length > 0 && (
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Subtitles Timeline</h4>
                    <span className="text-sm text-muted-foreground">
                      {scene.subtitles.segments.length} segments
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {scene.subtitles.segments.map((segment, index) => (
                      <div 
                        key={segment.id || index} 
                        className="text-sm p-2 rounded bg-background hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-mono">
                            {Math.floor(segment.start)}s - {Math.floor(segment.end)}s
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Duration: {Math.round(segment.end - segment.start)}s
                          </span>
                        </div>
                        <p className="mt-1">{segment.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show subtitle status when not playing */}
          {!isPlaying && scene.subtitles?.segments && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Subtitles className="h-4 w-4" />
              <span>{scene.subtitles.segments.length} subtitle segments generated</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 