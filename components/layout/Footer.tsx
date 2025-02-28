import React from 'react';
import { Github, Twitter, Youtube } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

export function Footer() {
  return (
    <footer className="border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">YouTube Video Generator</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create engaging AI-powered videos from YouTube content with ease.
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-base">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="/docs" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Documentation
                </a>
              </li>
              <li>
                <a href="/blog" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Blog
                </a>
              </li>
              <li>
                <a href="/examples" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Examples
                </a>
              </li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-base">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-base">Social</h4>
            <div className="flex gap-3">
              <Button variant="outline" size="icon" asChild className="rounded-full hover:scale-105 transition-transform duration-200">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" />
                  <span className="sr-only">GitHub</span>
                </a>
              </Button>
              <Button variant="outline" size="icon" asChild className="rounded-full hover:scale-105 transition-transform duration-200">
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                  <Twitter className="h-4 w-4" />
                  <span className="sr-only">Twitter</span>
                </a>
              </Button>
              <Button variant="outline" size="icon" asChild className="rounded-full hover:scale-105 transition-transform duration-200">
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer">
                  <Youtube className="h-4 w-4" />
                  <span className="sr-only">YouTube</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
        
        <Separator className="my-10" />
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 text-sm text-muted-foreground">
          <p>© 2024 YouTube Video Generator. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-foreground transition-colors duration-200">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors duration-200">Terms</a>
            <a href="/contact" className="hover:text-foreground transition-colors duration-200">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
} 