'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { VideoProcessor } from '@/components/VideoProcessor';

export default function Home() {
  return (
    <MainLayout>
      <VideoProcessor />
    </MainLayout>
  );
}
