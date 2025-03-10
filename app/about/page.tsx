'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Youtube, 
  Settings as SettingsIcon, 
  FileText, 
  Video, 
  Image, 
  Mic, 
  Sparkles, 
  Layers,
  FileVideo,
  Lightbulb
} from 'lucide-react';

export default function AboutPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">About ReelzGPT</h1>
          <p className="text-muted-foreground">
            Learn how to use ReelzGPT to generate AI videos from YouTube content or custom topics
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="getting-started" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              <span>Getting Started</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>Features</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Templates</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>What is ReelzGPT?</CardTitle>
                <CardDescription>
                  An AI-powered video generation tool
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose max-w-none">
                  <p>
                    ReelzGPT is a powerful AI tool that transforms YouTube content or custom topics into engaging videos. 
                    It uses advanced AI to analyze content, generate scenes, create narration, and produce images that 
                    come together as a cohesive video.
                  </p>
                  
                  <h3>Key Capabilities</h3>
                  <ul>
                    <li><strong>YouTube Transformation:</strong> Convert any YouTube video into a new, unique video with AI-generated visuals</li>
                    <li><strong>Topic-Based Generation:</strong> Create videos from scratch by simply entering a topic</li>
                    <li><strong>Video Templates:</strong> Choose from various video styles like cinematic, educational, marketing, and more</li>
                    <li><strong>Complete Automation:</strong> Automatically generate scenes, narration, images, and the final video</li>
                  </ul>

                  <h3>How It Works</h3>
                  <ol>
                    <li>Input a YouTube URL or enter a custom topic</li>
                    <li>Select a video style template</li>
                    <li>Generate scenes with AI</li>
                    <li>Create audio narration and images for each scene</li>
                    <li>Compile everything into a final video</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="getting-started">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Step-by-step guide to creating your first AI video
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose max-w-none">
                  <h3>1. Set Up Your API Keys</h3>
                  <p>
                    Before you begin, you'll need to set up your API keys in the Settings panel:
                  </p>
                  <ul>
                    <li><strong>OpenAI API Key:</strong> Required for generating scenes, narration, and image prompts</li>
                    <li><strong>Replicate API Key:</strong> Used for image generation</li>
                  </ul>
                  <p>Click the settings icon in the top-right corner to access the API settings.</p>

                  <h3>2. Create a New Project</h3>
                  <p>You can create a project in two ways:</p>
                  <ul>
                    <li>
                      <strong>From YouTube:</strong> Enter a YouTube URL in the input field and click "Create Project"
                    </li>
                    <li>
                      <strong>From a Topic:</strong> Click the "Topic" tab, enter your topic, and click "Generate from Topic"
                    </li>
                  </ul>

                  <h3>3. Generate Scenes</h3>
                  <p>
                    After creating a project, click "Generate Scenes" to have AI analyze the content and create scene descriptions.
                    Each scene will include:
                  </p>
                  <ul>
                    <li>Narration text</li>
                    <li>Image prompt</li>
                  </ul>

                  <h3>4. Generate Audio and Images</h3>
                  <p>
                    Once scenes are created, you can:
                  </p>
                  <ul>
                    <li>Click "Generate All Audio" to create narration for all scenes</li>
                    <li>Click "Generate All Images" to create visuals for all scenes</li>
                    <li>Or generate audio and images for individual scenes</li>
                  </ul>

                  <h3>5. Create Your Video</h3>
                  <p>
                    After generating all assets, click "Generate Video" to compile everything into a final video.
                    The video will be processed and available for download when complete.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features">
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
                <CardDescription>
                  Detailed overview of ReelzGPT's capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose max-w-none">
                  <h3>Content Sources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Youtube className="h-5 w-5 text-red-500" />
                        <h4 className="text-base font-medium m-0">YouTube Transcription</h4>
                      </div>
                      <p className="text-sm m-0">
                        Extract content from any YouTube video by providing its URL. The system will analyze the video's transcription and generate a new video based on its content.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        <h4 className="text-base font-medium m-0">Custom Topics</h4>
                      </div>
                      <p className="text-sm m-0">
                        Generate videos from scratch by simply entering a topic. The AI will research and create comprehensive content about your chosen subject.
                      </p>
                    </div>
                  </div>

                  <h3>Generation Process</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <h4 className="text-base font-medium m-0">Scene Generation</h4>
                      </div>
                      <p className="text-sm m-0">
                        AI analyzes content and breaks it down into logical scenes, each with narration text and image prompts optimized for your selected template.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic className="h-5 w-5 text-purple-500" />
                        <h4 className="text-base font-medium m-0">Audio Generation</h4>
                      </div>
                      <p className="text-sm m-0">
                        Convert narration text into natural-sounding speech using OpenAI's text-to-speech technology with multiple voice options.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Image className="h-5 w-5 text-green-500" />
                        <h4 className="text-base font-medium m-0">Image Generation</h4>
                      </div>
                      <p className="text-sm m-0">
                        Create custom images for each scene based on optimized prompts that maintain visual consistency throughout your video.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Video className="h-5 w-5 text-orange-500" />
                        <h4 className="text-base font-medium m-0">Video Compilation</h4>
                      </div>
                      <p className="text-sm m-0">
                        Combine generated audio and images into a cohesive video with proper timing and transitions. Available in landscape or vertical formats.
                      </p>
                    </div>
                  </div>

                  <h3>Project Management</h3>
                  <p>
                    ReelzGPT includes a complete project management system that allows you to:
                  </p>
                  <ul>
                    <li>Save and organize multiple projects</li>
                    <li>Edit existing projects</li>
                    <li>Regenerate specific scenes or assets</li>
                    <li>Download completed videos</li>
                    <li>Track generation progress</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Video Templates</CardTitle>
                <CardDescription>
                  Customize your video style with specialized templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="prose max-w-none">
                  <p>
                    ReelzGPT offers multiple video style templates to customize the look and feel of your generated videos.
                    Each template affects how scenes are generated, the tone of narration, and the style of images.
                  </p>

                  <h3>Available Templates</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-medium">Cinematic</h4>
                      <p className="text-sm">
                        Visually stunning, emotionally engaging content with dramatic scenes, professional cinematography, and compelling storytelling.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-medium">Advertisement</h4>
                      <p className="text-sm">
                        Persuasive, attention-grabbing content with clear call-to-action, benefit-focused messaging, and professional product presentation.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-medium">Educational</h4>
                      <p className="text-sm">
                        Clear, informative content that explains concepts effectively with visual aids, step-by-step explanations, and accessible language.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-medium">Marketing</h4>
                      <p className="text-sm">
                        Strategic content that highlights value propositions and builds brand narrative with consistent messaging and visual identity.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-medium">Kids Story</h4>
                      <p className="text-sm">
                        Fun, age-appropriate content with colorful scenes, simple language, and engaging characters designed specifically for children.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-medium">Story/Narrative</h4>
                      <p className="text-sm">
                        Engaging narrative with character development and plot progression, creating an immersive storytelling experience.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-medium">Podcast</h4>
                      <p className="text-sm">
                        Conversational content with clear talking points and natural narration, designed to feel like an engaging podcast episode.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="text-base font-medium">Science Documentary</h4>
                      <p className="text-sm">
                        Accurate, fascinating content that balances scientific accuracy with storytelling, featuring detailed visualizations and expert explanations.
                      </p>
                    </div>
                  </div>

                  <h3>How to Select a Template</h3>
                  <ol>
                    <li>Open the Settings panel by clicking the gear icon in the top-right corner</li>
                    <li>Navigate to the "Templates" tab</li>
                    <li>Select your desired template from the available options</li>
                    <li>The template will be applied to all new scene generations</li>
                  </ol>

                  <h3>Template Customization</h3>
                  <p>
                    Each template can be customized to better suit your needs:
                  </p>
                  <ul>
                    <li>Modify system prompts to change how scenes are generated</li>
                    <li>Edit user prompts for both YouTube and topic-based generation</li>
                    <li>Customize narration and image prompt descriptions</li>
                    <li>Reset to default settings if needed</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
} 