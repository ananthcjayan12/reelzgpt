import React, { useState } from 'react';
import { useSettingsStore, OPENAI_MODELS } from '@/lib/store/settings';
import { usePromptStore, DEFAULT_PROMPTS } from '@/lib/store/prompts';
import { validateApiKey as validateOpenAIKey } from '@/lib/services/openai';
import { validateApiKey as validateReplicateKey } from '@/lib/services/replicate';
import { PromptTemplates } from './PromptTemplates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Key, 
  CheckCircle, 
  XCircle, 
  Loader2,
  MessageSquare,
  Settings as SettingsIcon,
  Subtitles,
  RotateCcw
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface SubtitleSettings {
  highlightColor: string;
  displayWordCount: number;
  fontSize: number;
  showProgressBar: boolean;
  timingOffset: number;
}

export function Settings() {
  const {
    openaiApiKey,
    replicateApiKey,
    selectedModel,
    subtitleSettings,
    setOpenAIKey,
    setReplicateKey,
    setSelectedModel,
    setSubtitleSettings,
  } = useSettingsStore();

  const {
    narrationDescription,
    imagePromptDescription,
    setNarrationDescription,
    setImagePromptDescription,
    resetToDefaults
  } = usePromptStore();

  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isTestingReplicate, setIsTestingReplicate] = useState(false);
  const [openAIStatus, setOpenAIStatus] = useState<'success' | 'error' | null>(null);
  const [replicateStatus, setReplicateStatus] = useState<'success' | 'error' | null>(null);
  const [activeTab, setActiveTab] = useState<'api' | 'prompts' | 'subtitles'>('api');

  const testOpenAIKey = async () => {
    setIsTestingOpenAI(true);
    try {
      const isValid = await validateOpenAIKey();
      setOpenAIStatus(isValid ? 'success' : 'error');
    } catch (error) {
      setOpenAIStatus('error');
    }
    setIsTestingOpenAI(false);
  };

  const testReplicateKey = async () => {
    setIsTestingReplicate(true);
    try {
      const isValid = await validateReplicateKey();
      setReplicateStatus(isValid ? 'success' : 'error');
    } catch (error) {
      setReplicateStatus('error');
    }
    setIsTestingReplicate(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your API keys and preferences
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="api" className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span>API Keys</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span>Prompts</span>
          </TabsTrigger>
          <TabsTrigger value="subtitles" className="flex items-center space-x-2">
            <Subtitles className="h-4 w-4" />
            <span>Subtitles</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI API Key</CardTitle>
              <CardDescription>
                Configure your OpenAI API key for text-to-speech generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenAIKey(e.target.value)}
                  placeholder="Enter your OpenAI API key"
                />
                <Button
                  variant="outline"
                  onClick={testOpenAIKey}
                  disabled={isTestingOpenAI || !openaiApiKey}
                  className="min-w-[100px]"
                >
                  {isTestingOpenAI ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : openAIStatus === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : openAIStatus === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    'Test'
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <div className="grid grid-cols-2 gap-2">
                  {OPENAI_MODELS.map((model) => (
                    <Button
                      key={model.id}
                      variant={selectedModel === model.id ? 'default' : 'outline'}
                      onClick={() => setSelectedModel(model.id)}
                      className="justify-start"
                    >
                      {model.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Replicate API Key</CardTitle>
              <CardDescription>
                Configure your Replicate API key for image generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  type="password"
                  value={replicateApiKey}
                  onChange={(e) => setReplicateKey(e.target.value)}
                  placeholder="Enter your Replicate API key"
                />
                <Button
                  variant="outline"
                  onClick={testReplicateKey}
                  disabled={isTestingReplicate || !replicateApiKey}
                  className="min-w-[100px]"
                >
                  {isTestingReplicate ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : replicateStatus === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : replicateStatus === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    'Test'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Prompt Templates</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to reset all templates to their default values?')) {
                      resetToDefaults();
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
              </CardTitle>
              <CardDescription>
                Customize the prompts used for generating content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Narration Description</label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Template used for generating scene narrations from the video transcript
                  </p>
                  <div className="relative">
                    <Textarea
                      value={narrationDescription}
                      onChange={(e) => setNarrationDescription(e.target.value)}
                      placeholder={DEFAULT_PROMPTS.narrationDescription}
                      className="min-h-[200px] font-mono text-sm leading-relaxed resize-y"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                      {narrationDescription.length} characters
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Image Prompt Description</label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Template used for generating image prompts from scene narrations
                  </p>
                  <div className="relative">
                    <Textarea
                      value={imagePromptDescription}
                      onChange={(e) => setImagePromptDescription(e.target.value)}
                      placeholder={DEFAULT_PROMPTS.imagePromptDescription}
                      className="min-h-[200px] font-mono text-sm leading-relaxed resize-y"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                      {imagePromptDescription.length} characters
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="text-sm font-medium mb-2">Template Variables</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-start space-x-2">
                    <code className="bg-muted px-1 rounded">{`{{transcript}}`}</code>
                    <span className="text-muted-foreground">The video transcript segment</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <code className="bg-muted px-1 rounded">{`{{context}}`}</code>
                    <span className="text-muted-foreground">Previous and next segments for context</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subtitles">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="sm:col-span-2">
              <CardHeader>
                <CardTitle>Subtitle Settings</CardTitle>
                <CardDescription>
                  Configure how subtitles appear in your videos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Font Size</label>
                    <div className="flex items-center space-x-4">
                      <Input
                        type="number"
                        value={subtitleSettings.fontSize}
                        onChange={(e) => setSubtitleSettings({ fontSize: parseInt(e.target.value) })}
                        min={12}
                        max={48}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">pixels</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Words to Display</label>
                    <div className="flex items-center space-x-4">
                      <Input
                        type="number"
                        value={subtitleSettings.displayWordCount}
                        onChange={(e) => setSubtitleSettings({ displayWordCount: parseInt(e.target.value) })}
                        min={1}
                        max={10}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">words at a time</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Highlight Color</label>
                  <div className="flex items-center space-x-4">
                    <Input
                      type="color"
                      value={subtitleSettings.highlightColor}
                      onChange={(e) => setSubtitleSettings({ highlightColor: e.target.value })}
                      className="w-24 h-10"
                    />
                    <Input
                      type="text"
                      value={subtitleSettings.highlightColor}
                      onChange={(e) => setSubtitleSettings({ highlightColor: e.target.value })}
                      className="w-32"
                      placeholder="#000000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Timing Offset</label>
                  <div className="flex items-center space-x-4">
                    <Input
                      type="range"
                      value={subtitleSettings.timingOffset}
                      onChange={(e) => setSubtitleSettings({ timingOffset: parseFloat(e.target.value) })}
                      min="0"
                      max="1"
                      step="0.1"
                      className="w-48"
                    />
                    <Input
                      type="number"
                      value={subtitleSettings.timingOffset}
                      onChange={(e) => setSubtitleSettings({ timingOffset: parseFloat(e.target.value) })}
                      min="0"
                      max="1"
                      step="0.1"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">seconds</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adjust how early subtitles appear before words are spoken. Higher values make subtitles appear earlier.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant={subtitleSettings.showProgressBar ? 'default' : 'outline'}
                    onClick={() => setSubtitleSettings({ showProgressBar: !subtitleSettings.showProgressBar })}
                  >
                    Show Progress Bar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>See how your subtitles will look</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                  <div className="text-white text-center space-y-2 p-4">
                    <div 
                      className="subtitle-text max-w-[80%] mx-auto bg-black/50 p-3 rounded"
                      style={{ fontSize: `${subtitleSettings.fontSize}px` }}
                    >
                      <span>This is a </span>
                      <span style={{ color: subtitleSettings.highlightColor }}>sample</span>
                      <span> text with </span>
                      <span>highlighted </span>
                      <span>words</span>
                    </div>
                    {subtitleSettings.showProgressBar && (
                      <div className="w-48 h-1 bg-white/30 rounded mx-auto">
                        <div 
                          className="h-full rounded transition-all duration-300"
                          style={{ 
                            width: '60%',
                            backgroundColor: subtitleSettings.highlightColor 
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 