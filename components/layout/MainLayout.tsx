import React, { useState } from 'react';
import { useProcessingState } from '@/lib/store';
import { Progress } from '../ui/Progress';
import { Toast } from '../ui/Toast';
import { Settings } from '../Settings';
import { Settings as SettingsIcon } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isProcessing, progress, error } = useProcessingState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6">
        <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-8 pb-8">
          {children}
        </div>
      </main>

      {/* Settings Dialog */}
      <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-lg bg-white shadow-lg focus:outline-none">
            <Settings />
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg"
            >
              <span className="sr-only">Close</span>
              <svg
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Toast for errors */}
      <Toast />
    </div>
  );
} 