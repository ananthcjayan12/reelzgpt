import React from 'react';
import { Github, Twitter, Youtube } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

export function Footer() {
  return (
    <footer className="border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-6 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="font-medium text-base">ReelzGPT</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create engaging AI-powered videos
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="ghost" size="icon" asChild className="h-9 w-9 hover:scale-105 transition-transform">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
                <span className="sr-only">GitHub</span>
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild className="h-9 w-9 hover:scale-105 transition-transform">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                <Twitter className="h-4 w-4" />
                <span className="sr-only">Twitter</span>
              </a>
            </Button>
            <Button variant="ghost" size="icon" asChild className="h-9 w-9 hover:scale-105 transition-transform">
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer">
                <Youtube className="h-4 w-4" />
                <span className="sr-only">YouTube</span>
              </a>
            </Button>
          </div>
        </div>
        
        <Separator className="my-6" />
        
        <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2024 ReelzGPT</p>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
} 