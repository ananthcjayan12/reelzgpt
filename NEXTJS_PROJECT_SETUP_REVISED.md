# Next.js YouTube Video Processor - Implementation Guide


## Project Overview
A browser-based application that creates AI-powered narrated videos from YouTube content using:
- OpenAI API for script generation and text-to-speech
- Replicate API for image generation
- Browser-based video processing


We have already a project intialised like this 

├── app
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib
│   └── utils.ts
├── components.json
├── eslint.config.mjs
├── filstruct.txt
├── filstruct.yxy
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
└── tsconfig.json

## Core Implementation

### 1. Type Definitions (types/index.ts)

```typescript
export interface Scene {
  id: string;
  narration: string;
  imagePrompt: string;
  mood: 'adventure' | 'dramatic' | 'happy' | 'romantic' | 'suspense';
  audio?: Blob;
  image?: string;
  order: number;
}

export interface YouTubeDetails {
  title: string;
  description: string;
  thumbnailTitle: string;
  thumbnailPrompt: string;
}

export interface Project {
  id: string;
  youtubeUrl: string;
  transcription: string;
  scenes: Scene[];
  youtubeDetails?: YouTubeDetails;
  status: 'draft' | 'processing' | 'completed' | 'failed';
}
```

### 2. OpenAI Service (lib/services/openai.ts)

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function generateScenesAndDetails(transcription: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that creates engaging and original YouTube video scripts."
      },
      {
        role: "user",
        content: `Create a modified and complete YouTube video script from this content: '${transcription}'...`
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "generate_scenes_and_narration",
          description: "Generates engaging narration and Disney-style image prompts...",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Narration content, less than 200 words"
              },
              prompt: { type: "string" },
              mood: {
                type: "string",
                enum: ["adventure", "dramatic", "happy", "romantic", "suspense"]
              }
            },
            required: ["content", "prompt", "mood"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_youtube_details",
          description: "Generates YouTube title, description, and thumbnail prompt",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              prompt: { type: "string" },
              thumbnail_title: { type: "string" },
              description: { type: "string" }
            },
            required: ["title", "thumbnail_title", "description", "prompt"]
          }
        }
      }
    ]
  });

  return completion.choices[0].message;
}

export async function generateAudio(text: string): Promise<Blob> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: text
  });

  return new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' });
}
```

### 3. Replicate Service (lib/services/replicate.ts)

```typescript
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN,
});

export async function generateImage(prompt: string, isReel: boolean = false) {
  const aspectRatio = isReel ? "9:16" : "16:9";
  const width = isReel ? 1080 : 1280;
  const height = isReel ? 1920 : 720;

  const output = await replicate.run(
    "black-forest-labs/flux-schnell",
    {
      input: {
        prompt,
        seed: 5,
        num_outputs: 1,
        aspect_ratio: aspectRatio,
        output_format: "png",
        output_quality: 80
      }
    }
  );

  const response = await fetch(output[0]);
  const blob = await response.blob();
  return blob;
}
```

### 4. Browser Video Processing (lib/services/video.ts)

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export class VideoProcessor {
  private ffmpeg: FFmpeg;
  
  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  async init() {
    await this.ffmpeg.load({
      coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
      wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm')
    });
  }

  async generateVideo(scenes: Scene[]): Promise<Blob> {
    const videoChunks: Blob[] = [];
    
    for (const scene of scenes) {
      // Create video segment from image and audio
      const videoSegment = await this.createVideoSegment(
        scene.image as string,
        scene.audio as Blob,
        scene.narration
      );
      videoChunks.push(videoSegment);
    }

    // Concatenate video chunks
    return await this.concatenateVideos(videoChunks);
  }

  private async createVideoSegment(
    imageBlob: string,
    audioBlob: Blob,
    narration: string
  ): Promise<Blob> {
    // Implementation using FFmpeg.wasm
    // Convert image to video duration of audio
    // Add subtitles if needed
    // Return video segment
  }

  private async concatenateVideos(chunks: Blob[]): Promise<Blob> {
    // Implementation using FFmpeg.wasm
    // Concatenate all video segments
    // Return final video
  }
}
```

### 5. Main Component (app/components/VideoProcessor/index.tsx)

```typescript
'use client';

import { useState } from 'react';
import { useProjectStore } from '@/lib/store/projectStore';
import { VideoProcessor } from '@/lib/services/video';
import { generateScenesAndDetails, generateAudio } from '@/lib/services/openai';
import { generateImage } from '@/lib/services/replicate';

export function VideoProcessor() {
  const [step, setStep] = useState<'input' | 'processing' | 'complete'>('input');
  const { project, setProject } = useProjectStore();
  
  async function processVideo(youtubeUrl: string) {
    try {
      setStep('processing');
      
      // 1. Extract YouTube subtitles
      const transcription = await extractSubtitles(youtubeUrl);
      
      // 2. Generate scenes and details
      const generated = await generateScenesAndDetails(transcription);
      
      // 3. Process each scene
      const scenes = [];
      for (const scene of generated.scenes) {
        // Generate audio
        const audio = await generateAudio(scene.narration);
        
        // Generate image
        const image = await generateImage(scene.imagePrompt);
        
        scenes.push({
          ...scene,
          audio,
          image
        });
      }
      
      // 4. Generate final video in browser
      const videoProcessor = new VideoProcessor();
      await videoProcessor.init();
      const finalVideo = await videoProcessor.generateVideo(scenes);
      
      // 5. Complete
      setStep('complete');
      
    } catch (error) {
      console.error('Error processing video:', error);
      setStep('input');
    }
  }
  
  return (
    <div>
      {/* Render appropriate component based on step */}
    </div>
  );
}
```

## Environment Setup

Create `.env.local`:
```
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_REPLICATE_API_TOKEN=your_replicate_token
```

## Implementation Steps

1. Setup project and install dependencies
2. Implement YouTube subtitle extraction
3. Implement OpenAI integration for script and audio
4. Implement Replicate integration for images
5. Implement browser-based video processing
6. Add progress tracking and error handling
7. Add proper cleanup and memory management

## Key Features

1. **YouTube Processing**
   - Extract subtitles using YouTube API
   - Process transcription with OpenAI

2. **Scene Generation**
   - Generate script and scenes using OpenAI
   - Generate images using Replicate
   - Generate audio using OpenAI TTS

3. **Browser Video Processing**
   - Process video entirely in browser using FFmpeg.wasm
   - Handle memory efficiently with chunked processing
   - Show progress for each step

## Notes

- All processing happens in the browser
- Uses the same APIs as your current implementation
- No server-side processing required
- Proper error handling and progress tracking
- Memory-efficient processing with chunking

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Replicate API Documentation](https://replicate.com/docs)
- [FFmpeg.wasm Documentation](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [Next.js Documentation](https://nextjs.org/docs)

## API Integration Examples

### 1. OpenAI API Calls

#### A. Scene and Details Generation
```typescript
// Request
const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    {
      role: "system",
      content: "You are a helpful assistant that creates engaging and original YouTube video scripts."
    },
    {
      role: "user",
      content: `Create a modified and complete YouTube video script from this content: '${transcription}'...`
    }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "generate_scenes_and_narration",
        description: "Generates engaging narration and Disney-style image prompts...",
        parameters: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Narration content, less than 200 words"
            },
            prompt: { type: "string" },
            mood: {
              type: "string",
              enum: ["adventure", "dramatic", "happy", "romantic", "suspense"]
            }
          },
          required: ["content", "prompt", "mood"]
        }
      }
    }
  ]
});

// Example Response
{
  "choices": [{
    "message": {
      "tool_calls": [{
        "function": {
          "name": "generate_scenes_and_narration",
          "arguments": {
            "content": "In a cozy village nestled among rolling hills...",
            "prompt": "A charming animated village with colorful cottages...",
            "mood": "happy"
          }
        }
      }]
    }
  }]
}
```

#### B. Audio Generation
```typescript
// Request
const response = await openai.audio.speech.create({
  model: "tts-1",
  voice: "alloy",
  input: "Scene narration text here"
});

// Response is a binary audio stream that can be converted to Blob
const audioBlob = new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' });
```

### 2. Replicate API Calls

#### Image Generation
```typescript
// Request
const output = await replicate.run(
  "black-forest-labs/flux-schnell",
  {
    input: {
      prompt: "A charming animated village with colorful cottages...",
      seed: 5,
      num_outputs: 1,
      aspect_ratio: "16:9",  // or "9:16" for reels
      output_format: "png",
      output_quality: 80
    }
  }
);

// Example Response
{
  "0": "https://replicate-output.example.com/generated-image.png"
}

// Convert URL to Blob
const response = await fetch(output[0]);
const imageBlob = await response.blob();
```

### 3. YouTube Subtitle Extraction

```typescript
// Using your custom endpoint
const response = await fetch(
  `https://cjsubtitle.ananth-c-jayan.workers.dev/api/transcript?url=${youtubeUrl}&output=json`
);

// Example Response
[
  {
    "text": "Welcome to this amazing story...",
    "start": 0.0,
    "duration": 2.5
  },
  {
    "text": "Let me tell you about...",
    "start": 2.5,
    "duration": 3.0
  }
]
```

### 4. Video Processing with FFmpeg.wasm

```typescript
// Initialize FFmpeg
const ffmpeg = new FFmpeg();
await ffmpeg.load({
  coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
  wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm')
});

// Example command to create video from image and audio
await ffmpeg.exec([
  '-loop', '1',           // Loop the image
  '-i', 'image.png',      // Input image
  '-i', 'audio.mp3',      // Input audio
  '-c:v', 'libx264',      // Video codec
  '-c:a', 'aac',          // Audio codec
  '-b:a', '192k',         // Audio bitrate
  '-pix_fmt', 'yuv420p',  // Pixel format
  '-shortest',            // Duration based on audio
  'output.mp4'            // Output file
]);

// Read the result
const data = await ffmpeg.readFile('output.mp4');
const videoBlob = new Blob([data], { type: 'video/mp4' });
```

## Complete Processing Flow

1. **Extract YouTube Subtitles**
```typescript
const subtitles = await extractSubtitles(youtubeUrl);
const transcription = subtitles.map(s => s.text).join(' ');
```

2. **Generate Scenes and Details**
```typescript
const generated = await generateScenesAndDetails(transcription);
const scenes = generated.choices[0].message.tool_calls
  .filter(call => call.function.name === 'generate_scenes_and_narration')
  .map(call => JSON.parse(call.function.arguments));
```

3. **Process Each Scene**
```typescript
for (const scene of scenes) {
  // Generate audio
  const audio = await generateAudio(scene.narration);
  
  // Generate image
  const image = await generateImage(scene.prompt, isReel);
  
  // Create video segment
  const videoSegment = await createVideoSegment(image, audio);
  videoSegments.push(videoSegment);
}
```

4. **Combine Final Video**
```typescript
const finalVideo = await concatenateVideos(videoSegments);
```

## Error Handling Examples

```typescript
try {
  const response = await openai.chat.completions.create({...});
} catch (error) {
  if (error.response) {
    switch (error.response.status) {
      case 401:
        throw new Error('Invalid API key');
      case 429:
        throw new Error('Rate limit exceeded');
      case 500:
        throw new Error('OpenAI API error');
      default:
        throw new Error(`API error: ${error.message}`);
    }
  }
} 