import React, { useState } from 'react';
import { useProcessingState } from '@/lib/store';
import { Progress } from '../ui/Progress';
import { Toast } from '../ui/Toast';
import { Settings } from '../Settings';
import { Settings as SettingsIcon, Menu, Home, FileVideo, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Separator } from '../ui/separator';
import { Footer } from './Footer';
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

  const navigationItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/projects', label: 'Projects', icon: FileVideo },
    { href: '/about', label: 'About', icon: Info },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden -ml-3">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px]">
                  <nav className="flex flex-col space-y-6">
                    <a href="/" className="flex items-center space-x-2 font-bold text-lg">
                      <span>ReelzGPT</span>
                    </a>
                    <Separator />
                    <div className="flex flex-col space-y-4">
                      {navigationItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 px-3 py-2 text-base text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                          >
                            <Icon className="h-5 w-5" />
                            {item.label}
                          </a>
                        );
                      })}
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
              <a href="/" className="flex items-center space-x-2">
                <span className="hidden font-bold text-xl sm:inline-block">ReelzGPT</span>
                <span className="font-bold text-xl sm:hidden">RGP</span>
              </a>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    <span className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-foreground scale-x-0 group-hover:scale-x-100 transition-transform" />
                  </a>
                );
              })}
            </nav>

            <div className="flex items-center gap-4">
              {isProcessing && progress && (
                <div className="hidden sm:block w-48">
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
        </div>
        {isProcessing && progress && (
          <div className="sm:hidden">
            <Progress value={progress.progress * 100} className="h-1" />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 py-6 sm:py-10">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:gap-8">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

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