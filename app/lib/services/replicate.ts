'use client';

import { useSettingsStore } from '@/lib/store/settings';

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
 * Proxies an image URL through our server to handle CORS
 */
const proxyImageUrl = (url: string): string => {
  return `/api/replicate/image?url=${encodeURIComponent(url)}`;
};

/**
 * Generates an image using Replicate's API through server-side route
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
  
  // Set dimensions based on video format
  const width = isReel ? 1080 : 1920;
  const height = isReel ? 1920 : 1080;

  let lastError: any;
  
  // Get API key from settings
  const settings = useSettingsStore.getState();
  const apiKey = settings.replicateApiKey;

  if (!apiKey) {
    throw new Error('Replicate API token is not set. Please configure it in settings.');
  }

  // Implement retry logic
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch('/api/replicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          width,
          height,
          apiKey,
          aspect_ratio: isReel ? "9:16" : "16:9"
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate image');
      }

      const { output } = await response.json();

      // Replicate returns an array of image URLs
      if (Array.isArray(output) && output.length > 0) {
        // Return proxied URL instead of direct Replicate URL
        return proxyImageUrl(output[0]);
      }

      throw new Error('No image was generated');
    } catch (error: any) {
      lastError = error;
      
      // If this is not our last attempt, wait before retrying
      if (attempt < retryCount) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
        continue;
      }
      
      throw new Error(error.message || 'Failed to generate image');
    }
  }

  // This should never be reached due to the throw in the loop
  throw new Error(lastError?.message || 'Failed to generate image');
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
    const settings = useSettingsStore.getState();
    const apiKey = settings.replicateApiKey;
    if (!apiKey) return false;

    const response = await fetch('/api/replicate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'test',
        width: 512,
        height: 512,
        apiKey,
      }),
    });

    return response.ok;
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
    // If the URL is already proxied, use it directly
    const imageUrl = url.startsWith('/api/replicate/image') ? url : proxyImageUrl(url);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    return await response.blob();
  } catch (error: any) {
    throw new Error(error.message || 'Failed to download image');
  }
}