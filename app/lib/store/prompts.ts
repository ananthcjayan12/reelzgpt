import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PromptTemplates {
  // Scene generation prompts
  sceneGenerationSystemPrompt: string;
  sceneGenerationUserPrompt: string;
  
  // Field descriptions for scene generation
  narrationDescription: string;
  imagePromptDescription: string;
  
  // Audio generation settings
  audioVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  
  // Image generation prompts
  imageEnhancementTemplate: string;
  imageEnhancementEnabled: boolean;
}

interface PromptState extends PromptTemplates {
  // Scene generation actions
  setSceneGenerationSystemPrompt: (prompt: string) => void;
  setSceneGenerationUserPrompt: (prompt: string) => void;
  
  // Field description actions
  setNarrationDescription: (description: string) => void;
  setImagePromptDescription: (description: string) => void;
  
  // Audio generation actions
  setAudioVoice: (voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer') => void;
  
  // Image generation actions
  setImageEnhancementTemplate: (template: string) => void;
  setImageEnhancementEnabled: (enabled: boolean) => void;
  
  // Reset to defaults
  resetToDefaults: () => void;
}

// Default prompt templates
export const DEFAULT_PROMPTS: PromptTemplates = {
  // Scene generation prompts
  sceneGenerationSystemPrompt: `You are a creative video script writer and scene designer. Your task is to:
1. Break down the transcription into engaging scenes
2. Create compelling narration for each scene
3. Generate detailed image prompts for scene visualization
4. Assign appropriate moods to each scene
5. Create an engaging YouTube title and description`,
  
  sceneGenerationUserPrompt: `Create an engaging video script and scenes from this transcription: "{transcription}"`,
  
  // Field descriptions
  narrationDescription: "Scene narration text (max 200 words)",
  imagePromptDescription: "Detailed prompt for image generation",
  
  // Audio generation settings
  audioVoice: 'onyx',
  
  // Image generation prompts
  imageEnhancementTemplate: `A high-quality, detailed {aspect_ratio} image of {prompt}. Cinematic lighting, professional photography, 8k resolution, highly detailed.`,
  imageEnhancementEnabled: true,
};

export const usePromptStore = create<PromptState>()(
  persist(
    (set) => ({
      ...DEFAULT_PROMPTS,
      
      // Scene generation actions
      setSceneGenerationSystemPrompt: (prompt) => set({ sceneGenerationSystemPrompt: prompt }),
      setSceneGenerationUserPrompt: (prompt) => set({ sceneGenerationUserPrompt: prompt }),
      
      // Field description actions
      setNarrationDescription: (description) => set({ narrationDescription: description }),
      setImagePromptDescription: (description) => set({ imagePromptDescription: description }),
      
      // Audio generation actions
      setAudioVoice: (voice) => set({ audioVoice: voice }),
      
      // Image generation actions
      setImageEnhancementTemplate: (template) => set({ imageEnhancementTemplate: template }),
      setImageEnhancementEnabled: (enabled) => set({ imageEnhancementEnabled: enabled }),
      
      // Reset to defaults
      resetToDefaults: () => set(DEFAULT_PROMPTS),
    }),
    {
      name: 'prompt-templates',
    }
  )
);

// Helper function to enhance image prompts
export function enhancePrompt(prompt: string, isReel: boolean = false): string {
  const { imageEnhancementTemplate, imageEnhancementEnabled } = usePromptStore.getState();
  
  if (!imageEnhancementEnabled) return prompt;
  
  const aspectRatio = isReel ? "vertical (9:16)" : "horizontal (16:9)";
  return imageEnhancementTemplate
    .replace('{prompt}', prompt)
    .replace('{aspect_ratio}', aspectRatio);
} 