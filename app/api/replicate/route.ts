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
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio :aspect_ratio,
          output_format: "png",
          output_quality: 80,
          num_inference_steps: 4
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