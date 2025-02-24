import OpenAI from 'openai';
import { Scene, YouTubeDetails, ProcessingError } from '@/types';

// Initialize OpenAI client with browser support
const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Enable browser usage
});

// Error handler utility
const handleError = (error: any, stage: string): ProcessingError => {
  return {
    stage,
    message: error.message || 'An unknown error occurred',
    details: error.response?.data || error,
    timestamp: new Date(),
  };
};

export async function generateScenesAndDetails(transcription: string): Promise<{
  scenes: Scene[];
  youtubeDetails: YouTubeDetails;
}> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
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
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: text,
    });

    // Convert the response to a Blob
    const audioData = await response.arrayBuffer();
    return new Blob([audioData], { type: 'audio/mpeg' });
  } catch (error: any) {
    throw handleError(error, 'audio-generation');
  }
}

// Utility function to validate OpenAI API key
export async function validateApiKey(): Promise<boolean> {
  try {
    await openai.models.list();
    return true;
  } catch (error) {
    console.error('OpenAI API key validation failed:', error);
    return false;
  }
} 