import React from 'react';
import { useProcessingState } from '@/lib/store';
import { Progress } from '../ui/Progress';
import { Toast } from '../ui/Toast';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isProcessing, progress, error } = useProcessingState();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <span className="font-bold">YouTube Video Generator</span>
            </a>
          </div>
          <div className="flex flex-1 items-center space-x-2 justify-end">
            {isProcessing && progress && (
              <div className="w-[200px]">
                <Progress value={progress.progress * 100} />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-8 pb-8">
          {children}
        </div>
      </main>

      {/* Toast for errors */}
      <Toast />
    </div>
  );
} 