import OpenAI from 'openai';
import { Scene, YouTubeDetails } from '@/types';
import { ProcessingError } from '../types/errors';
import { useSettingsStore } from '@/lib/store/settings';

// Initialize OpenAI client with dynamic configuration
const getOpenAIClient = () => {
  const settings = useSettingsStore.getState();
  const openaiApiKey = settings.openaiApiKey;
  
  if (!openaiApiKey) {
    throw new ProcessingError({
      stage: 'openai-initialization',
      message: 'OpenAI API key is not set. Please configure it in settings.',
      timestamp: new Date(),
    });
  }

  return new OpenAI({
    apiKey: openaiApiKey,
    dangerouslyAllowBrowser: true
  });
};

// Error handler utility
const handleError = (error: any, stage: string): ProcessingError => {
  if (error.response?.status === 401) {
    return new ProcessingError({
      stage,
      message: 'Invalid or missing API key. Please check your OpenAI API key in settings.',
      timestamp: new Date(),
    });
  }
  return new ProcessingError({
    stage,
    message: error.message || 'An unknown error occurred',
    timestamp: new Date(),
  });
};

export async function generateScenesAndDetails(transcription: string): Promise<{
  scenes: Scene[];
  youtubeDetails: YouTubeDetails;
}> {
  try {
    const openai = getOpenAIClient();
    const { selectedModel } = useSettingsStore.getState();

    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: `You are a creative video script writer and scene designer. Your task is to:
          1. Break down the transcription into engaging scenes
          2. Create compelling narration for each scene
          3. Generate detailed image prompts for scene visualization
          4. Assign appropriate moods to each scene
          5. Create an engaging YouTube title and description`
        },
        {
          role: "user",
          content: `Create an engaging video script and scenes from this transcription: "${transcription}"`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_scenes",
            description: "Generates scenes with narration and image prompts",
            parameters: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      narration: {
                        type: "string",
                        description: "Scene narration text (max 200 words)"
                      },
                      imagePrompt: {
                        type: "string",
                        description: "Detailed prompt for image generation"
                      },
                      mood: {
                        type: "string",
                        enum: ["adventure", "dramatic", "happy", "romantic", "suspense"]
                      }
                    },
                    required: ["narration", "imagePrompt", "mood"]
                  }
                },
                youtubeDetails: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string",
                      description: "Engaging YouTube video title"
                    },
                    description: {
                      type: "string",
                      description: "SEO-friendly video description"
                    },
                    thumbnailTitle: {
                      type: "string",
                      description: "Short, catchy title for thumbnail"
                    },
                    thumbnailPrompt: {
                      type: "string",
                      description: "Image generation prompt for thumbnail"
                    }
                  },
                  required: ["title", "description", "thumbnailTitle", "thumbnailPrompt"]
                }
              },
              required: ["scenes", "youtubeDetails"]
            }
          }
        }
      ]
    });

    const result = completion.choices[0].message.tool_calls?.[0];
    if (!result || result.function.name !== 'generate_scenes') {
      throw new Error('Invalid response from OpenAI');
    }

    const { scenes, youtubeDetails } = JSON.parse(result.function.arguments);

    // Add IDs and order to scenes
    const processedScenes = scenes.map((scene: Omit<Scene, 'id' | 'order'>, index: number) => ({
      ...scene,
      id: `scene-${index + 1}`,
      order: index + 1
    }));

    return {
      scenes: processedScenes,
      youtubeDetails
    };
  } catch (error: any) {
    throw handleError(error, 'scene-generation');
  }
}

export async function generateAudio(text: string): Promise<Blob> {
  try {
    console.log('[OpenAI] Starting audio generation with text:', text);
    const openai = getOpenAIClient();
    console.log('[OpenAI] Client initialized');

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: text,
    });
    console.log('[OpenAI] Received audio response');

    // Convert the response to a Blob
    const audioData = await response.arrayBuffer();
    console.log('[OpenAI] Converted response to ArrayBuffer, size:', audioData.byteLength);
    
    const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
    console.log('[OpenAI] Created audio blob:', {
      type: audioBlob.type,
      size: audioBlob.size
    });
    
    return audioBlob;
  } catch (error: any) {
    console.error('[OpenAI] Audio generation error:', error);
    throw handleError(error, 'audio-generation');
  }
}

// Utility function to validate OpenAI API key
export async function validateApiKey(): Promise<boolean> {
  try {
    const { openaiApiKey } = useSettingsStore.getState();
    if (!openaiApiKey) return false;

    const openai = new OpenAI({
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: true
    });

    await openai.models.list();
    return true;
  } catch (error) {
    console.error('OpenAI API key validation failed:', error);
    return false;
  }
} 