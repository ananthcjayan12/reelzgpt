import { NextResponse } from 'next/server';
import Replicate from 'replicate';

export async function POST(request: Request) {
  try {
    const { prompt, width, height, apiKey, aspect_ratio } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Replicate API token is required' },
        { status: 401 }
      );
    }

    const replicate = new Replicate({
      auth: apiKey,
    });

    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt,
          negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy",
          width,
          height,
          aspect_ratio,
          scheduler: "K_EULER",
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 50,
          seed: Math.floor(Math.random() * 1000000)
        }
      }
    );

    return NextResponse.json({ output });
  } catch (error: any) {
    console.error('Replicate API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: error.response?.status || 500 }
    );
  }
} 