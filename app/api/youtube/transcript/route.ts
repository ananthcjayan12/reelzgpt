import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const youtubeUrl = searchParams.get('url');

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }

    const transcriptUrl = `https://cjsubtitle.ananth-c-jayan.workers.dev/api/transcript?url=${encodeURIComponent(youtubeUrl)}&output=json`;
    
    const response = await fetch(transcriptUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.statusText}`);
    }

    const transcriptData = await response.json();
    return NextResponse.json(transcriptData);
  } catch (error: any) {
    console.error('Transcript fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
} 