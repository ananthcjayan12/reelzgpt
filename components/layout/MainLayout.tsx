import React, { useState } from 'react';
import { useProcessingState } from '@/lib/store';
import { Progress } from '../ui/Progress';
import { Toast } from '../ui/Toast';
import { Settings } from '../Settings';
import { Settings as SettingsIcon, Menu } from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isProcessing, progress, error } = useProcessingState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-16 items-center">
          <div className="flex items-center space-x-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[280px]">
                <nav className="flex flex-col space-y-4">
                  <a href="/" className="flex items-center space-x-2 font-bold">
                    <span>YouTube Video Generator</span>
                  </a>
                  <Separator />
                  {/* Add your navigation items here */}
                </nav>
              </SheetContent>
            </Sheet>
            <a href="/" className="flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block">YouTube Video Generator</span>
              <span className="font-bold sm:hidden">YVG</span>
            </a>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            {isProcessing && progress && (
              <div className="w-[200px]">
                <Progress value={progress.progress * 100} className="h-2" />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <SettingsIcon className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsSettingsOpen(true)}>
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-8">
        <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-8 pb-8">
          {children}
        </div>
      </main>

      {/* Settings Dialog */}
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetContent side="right" className="w-[90vw] sm:max-w-[540px]">
          <div className="h-full overflow-y-auto py-6 px-4">
            <Settings />
          </div>
        </SheetContent>
      </Sheet>

      {/* Toast for errors */}
      <Toast />
    </div>
  );
} 