import OpenAI from 'openai';
import { Scene, YouTubeDetails } from '@/types';
import { ProcessingError } from '../types/errors';
import { useSettingsStore } from '@/lib/store/settings';
import { usePromptStore } from '@/lib/store/prompts';

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

// Helper function to handle errors
const handleError = (error: any, stage: string): never => {
  console.error(`[OpenAI] Error in ${stage}:`, error);
  
  if (error instanceof ProcessingError) {
    throw error;
  }
  
  throw new ProcessingError({
    stage,
    message: error.message || 'Unknown error',
    timestamp: new Date(),
  });
};

// Validate OpenAI API key
export async function validateApiKey(): Promise<boolean> {
  try {
    const openai = getOpenAIClient();
    await openai.models.list();
    return true;
  } catch (error) {
    console.error('[OpenAI] API key validation error:', error);
    return false;
  }
}

export async function generateScenesAndDetails(transcription: string): Promise<{
  scenes: Scene[];
  youtubeDetails: YouTubeDetails;
}> {
  try {
    const openai = getOpenAIClient();
    const { selectedModel } = useSettingsStore.getState();
    const { 
      sceneGenerationSystemPrompt, 
      sceneGenerationUserPrompt,
      narrationDescription,
      imagePromptDescription
    } = usePromptStore.getState();

    // Replace placeholders in the user prompt
    const formattedUserPrompt = sceneGenerationUserPrompt.replace('{transcription}', transcription);

    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: "system",
          content: sceneGenerationSystemPrompt
        },
        {
          role: "user",
          content: formattedUserPrompt
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
                        description: narrationDescription
                      },
                      imagePrompt: {
                        type: "string",
                        description: imagePromptDescription
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
    
    // Get voice from prompt store
    const { audioVoice } = usePromptStore.getState();

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: audioVoice,
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