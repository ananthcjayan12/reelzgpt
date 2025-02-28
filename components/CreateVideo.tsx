import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Youtube } from 'lucide-react';

interface CreateVideoProps {
  onSubmit: (url: string, format: 'landscape' | 'reel') => void;
}

export function CreateVideo({ onSubmit }: CreateVideoProps) {
  const [url, setUrl] = React.useState('');
  const [format, setFormat] = React.useState<'landscape' | 'reel'>('landscape');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim(), format);
      setUrl('');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="text-lg sm:text-2xl">Create New Video</CardTitle>
        <CardDescription className="text-sm">
          Enter a YouTube URL to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-3 sm:space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Youtube className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="url"
                placeholder="Enter YouTube URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden">
                <Button
                  type="button"
                  variant={format === 'landscape' ? 'default' : 'outline'}
                  onClick={() => setFormat('landscape')}
                  className="rounded-none border-r-0"
                >
                  Landscape
                </Button>
                <Button
                  type="button"
                  variant={format === 'reel' ? 'default' : 'outline'}
                  onClick={() => setFormat('reel')}
                  className="rounded-none"
                >
                  Reel
                </Button>
              </div>
              <Button 
                type="submit" 
                disabled={!url.trim()} 
                className="w-full sm:w-auto"
              >
                <Youtube className="mr-2 h-4 w-4" />
                Process
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 