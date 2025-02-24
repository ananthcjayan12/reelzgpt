import Replicate from 'replicate';
import { ProcessingError } from '@/types';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN,
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

interface ImageGenerationOptions {
  isReel?: boolean;
  enhancePrompt?: boolean;
  retryCount?: number;
}

const defaultOptions: Required<ImageGenerationOptions> = {
  isReel: false,
  enhancePrompt: true,
  retryCount: 3,
};

/**
 * Enhances the image generation prompt for better results
 */
const enhancePrompt = (prompt: string): string => {
  const enhancers = [
    "high quality, detailed, sharp focus",
    "cinematic lighting",
    "professional photography",
    "4K, high resolution",
  ];
  return `${prompt}, ${enhancers.join(", ")}`;
};

/**
 * Generates an image using Replicate's API
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<string> {
  const { isReel, enhancePrompt: shouldEnhancePrompt, retryCount } = {
    ...defaultOptions,
    ...options,
  };

  const finalPrompt = shouldEnhancePrompt ? enhancePrompt(prompt) : prompt;
  const aspectRatio = isReel ? "9:16" : "16:9";
  const width = isReel ? 1080 : 1920;
  const height = isReel ? 1920 : 1080;

  let lastError: any;
  
  // Implement retry logic
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const output = await replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        {
          input: {
            prompt: finalPrompt,
            negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy",
            width,
            height,
            scheduler: "K_EULER",
            num_outputs: 1,
            guidance_scale: 7.5,
            num_inference_steps: 50,
            seed: Math.floor(Math.random() * 1000000)
          }
        }
      );

      // Replicate returns an array of image URLs
      if (Array.isArray(output) && output.length > 0) {
        return output[0];
      }

      throw new Error('No image was generated');
    } catch (error: any) {
      lastError = error;
      
      // If this is not our last attempt, wait before retrying
      if (attempt < retryCount) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        continue;
      }
      
      throw handleError(lastError, 'image-generation');
    }
  }

  // This should never be reached due to the throw in the loop
  throw handleError(lastError || new Error('Failed to generate image'), 'image-generation');
}

/**
 * Generates a thumbnail image with specific optimization for YouTube thumbnails
 */
export async function generateThumbnail(
  prompt: string,
  title: string
): Promise<string> {
  const thumbnailPrompt = `YouTube thumbnail: ${prompt}. Title text: "${title}". 
    Style: Eye-catching, vibrant colors, professional quality, trending on YouTube`;

  return generateImage(thumbnailPrompt, {
    isReel: false,
    enhancePrompt: true,
    retryCount: 3
  });
}

/**
 * Validates the Replicate API token
 */
export async function validateApiKey(): Promise<boolean> {
  try {
    // Attempt to list models as a validation check
    await replicate.models.list();
    return true;
  } catch (error) {
    console.error('Replicate API key validation failed:', error);
    return false;
  }
}

/**
 * Downloads and converts an image URL to a Blob
 */
export async function downloadImage(url: string): Promise<Blob> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    return await response.blob();
  } catch (error: any) {
    throw handleError(error, 'image-download');
  }
} 