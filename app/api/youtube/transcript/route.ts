import { NextResponse } from 'next/server';
import { convertToWatchUrl } from '@/lib/services/youtube';

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

    // Convert to watch URL format
    const watchUrl = convertToWatchUrl(youtubeUrl);
    console.log('[YouTube API] Using watch URL:', watchUrl);

    const transcriptUrl = `https://cjsubtitle.ananth-c-jayan.workers.dev/api/transcript?url=${encodeURIComponent(watchUrl)}&output=json`;
    console.log('[YouTube API] Fetching from:', transcriptUrl);
    
    const response = await fetch(transcriptUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.statusText}`);
    }

    const transcriptData = await response.json();
    
    // Basic validation of transcript data
    if (!Array.isArray(transcriptData)) {
      throw new Error('Invalid transcript format: expected an array');
    }

    // Validate that each segment has text
    if (!transcriptData.every(segment => typeof segment.text === 'string')) {
      throw new Error('Invalid transcript format: segments missing text');
    }

    console.log('[YouTube API] Transcript fetched successfully:', {
      segmentCount: transcriptData.length,
      sampleText: transcriptData[0]?.text
    });

    return NextResponse.json(transcriptData);
  } catch (error: any) {
    console.error('[YouTube API] Transcript fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
} 