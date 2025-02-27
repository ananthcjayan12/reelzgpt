'use client';

import { useSettingsStore } from '@/lib/store/settings';
import { usePromptStore } from '@/lib/store/prompts';

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

// Validate Replicate API key
export async function validateApiKey(): Promise<boolean> {
  try {
    const { replicateApiKey } = useSettingsStore.getState();
    if (!replicateApiKey) return false;

    const response = await fetch('/api/replicate/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey: replicateApiKey }),
    });

    return response.ok;
  } catch (error) {
    console.error('Replicate API key validation failed:', error);
    return false;
  }
}

// Helper function to enhance image prompts using the template from the store
function enhancePrompt(prompt: string, isReel: boolean = false): string {
  const { imageEnhancementTemplate, imageEnhancementEnabled } = usePromptStore.getState();
  
  if (!imageEnhancementEnabled) return prompt;
  
  const aspectRatio = isReel ? "vertical (9:16)" : "horizontal (16:9)";
  return imageEnhancementTemplate
    .replace('{prompt}', prompt)
    .replace('{aspect_ratio}', aspectRatio);
}

// Helper function to proxy image URLs through our own server to avoid CORS issues
function proxyImageUrl(url: string): string {
  // If we're already using a proxied URL, return it
  if (url.startsWith('/api/replicate/image')) return url;
  
  // Otherwise, proxy the URL through our own server
  return `/api/replicate/image?url=${encodeURIComponent(url)}`;
}

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

  const finalPrompt = shouldEnhancePrompt ? enhancePrompt(prompt, isReel) : prompt;
  
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

  // This should never be reached due to the throw in the loop, but TypeScript requires it
  throw new Error(lastError?.message || 'Failed to generate image after multiple attempts');
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
 * Downloads an image from a URL and returns it as a Blob
 */
export async function downloadImage(url: string): Promise<Blob> {
  try {
    console.log('[Replicate] Downloading image from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('[Replicate] Image download failed with status:', response.status, response.statusText);
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('[Replicate] Image downloaded successfully:', {
      type: blob.type,
      size: blob.size
    });
    
    return blob;
  } catch (error: any) {
    console.error('[Replicate] Image download error:', error);
    throw new Error(`Failed to download image: ${error.message}`);
  }
}