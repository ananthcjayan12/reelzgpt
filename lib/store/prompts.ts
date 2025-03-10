import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define available video types
export type VideoType = 
  | 'cinematic' 
  | 'advertisement' 
  | 'educational' 
  | 'marketing' 
  | 'kids_story' 
  | 'story' 
  | 'podcast' 
  | 'science_documentary';

// Define source type (YouTube or Topic)
export type ScriptSource = 'youtube' | 'topic';

// Update the template type to include descriptions
export interface VideoTypeTemplate {
  systemPrompt: string;
  userPromptYoutube: string;
  userPromptTopic: string;
  narrationDescription: string;
  imagePromptDescription: string;
}

export interface PromptTemplates {
  // Script source type
  scriptSource: ScriptSource;
  
  // Video type template
  videoType: VideoType;
  
  // Scene generation prompts
  sceneGenerationSystemPrompt: string;
  sceneGenerationUserPrompt: string;
  
  // Topic-based generation prompts
  topicGenerationSystemPrompt: string;
  topicGenerationUserPrompt: string;
  
  // Field descriptions for scene generation
  narrationDescription: string;
  imagePromptDescription: string;
  
  // Audio generation settings
  audioVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  
  // Image generation prompts
  imageEnhancementTemplate: string;
  imageEnhancementEnabled: boolean;
  
  // Video type templates
  videoTypeTemplates: Record<VideoType, VideoTypeTemplate>;
}

interface PromptState extends PromptTemplates {
  // Script source actions
  setScriptSource: (source: ScriptSource) => void;
  
  // Video type actions
  setVideoType: (type: VideoType) => void;
  
  // Scene generation actions
  setSceneGenerationSystemPrompt: (prompt: string) => void;
  setSceneGenerationUserPrompt: (prompt: string) => void;
  
  // Topic generation actions
  setTopicGenerationSystemPrompt: (prompt: string) => void;
  setTopicGenerationUserPrompt: (prompt: string) => void;
  
  // Field description actions
  setNarrationDescription: (description: string) => void;
  setImagePromptDescription: (description: string) => void;
  
  // Audio generation actions
  setAudioVoice: (voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer') => void;
  
  // Image generation actions
  setImageEnhancementTemplate: (template: string) => void;
  setImageEnhancementEnabled: (enabled: boolean) => void;
  
  // Video type template actions
  updateVideoTypeTemplate: (
    type: VideoType, 
    updates: Partial<{
      systemPrompt: string;
      userPromptYoutube: string;
      userPromptTopic: string;
    }>
  ) => void;
  
  // Reset to defaults
  resetToDefaults: () => void;
}

// Default prompt templates
export const DEFAULT_PROMPTS: PromptTemplates = {
  // Script source type (default to YouTube)
  scriptSource: 'youtube',
  
  // Default video type
  videoType: 'cinematic',
  
  // Scene generation prompts
  sceneGenerationSystemPrompt: `You are a creative video script writer and scene designer. Your task is to:
1. Break down the transcription into engaging scenes
2. Create compelling narration for each scene
3. Generate detailed image prompts for scene visualization
4. Assign appropriate moods to each scene
5. Create an engaging YouTube title and description`,
  
  sceneGenerationUserPrompt: `Create an engaging video script and scenes from this transcription: "{transcription}"`,
  
  // Topic-based generation prompts
  topicGenerationSystemPrompt: `You are a creative video script writer and scene designer. Your task is to:
1. Create an engaging script about the provided topic
2. Break down the script into compelling scenes
3. Create narration for each scene
4. Generate detailed image prompts for scene visualization
5. Assign appropriate moods to each scene
6. Create an engaging YouTube title and description`,
  
  topicGenerationUserPrompt: `Create an engaging video script and scenes about this topic: "{topic}"`,
  
  // Field descriptions
  narrationDescription: `Create ONLY the exact words to be spoken, optimized for Text-to-Speech (TTS):
1. NO stage directions, descriptions, or formatting
2. Use proper punctuation for natural TTS pacing (commas, periods, etc.)
3. Write numbers as words for better TTS pronunciation
4. Maintain consistent voice, tone, and pacing throughout ALL scenes
5. Avoid abbreviations, symbols, or special characters
6. Use clear sentence structures that flow naturally when spoken`,
  
  imagePromptDescription: `Create highly detailed, consistent image prompts:
1. For EVERY character in EVERY scene, always specify:
   - Exact age, gender, ethnicity
   - Detailed facial features (eye color, hair style/color, etc.)
   - Complete outfit description (colors, style, materials)
   - Specific pose, expression, and emotional state
2. For environments/settings in EVERY scene:
   - Exact lighting conditions and time of day
   - Detailed background elements and their placement
   - Specific camera angle, distance, and framing
3. Maintain absolute consistency in:
   - Character appearances across scenes
   - Color schemes and visual style
   - Lighting and atmosphere
4. Include specific artistic direction:
   - Image quality (8K, highly detailed, professional photography)
   - Rendering style (photorealistic, animated, etc.)
   - Post-processing effects (depth of field, color grading, etc.)`,
  
  // Audio generation settings
  audioVoice: 'onyx',
  
  // Image generation prompts
  imageEnhancementTemplate: `A high-quality, detailed {aspect_ratio} image of {prompt}. Cinematic lighting, professional photography, 8k resolution, highly detailed.`,
  imageEnhancementEnabled: true,
  
  // Video type templates
  videoTypeTemplates: {
    cinematic: {
      systemPrompt: `You are a creative cinematic video script writer and scene designer. Your task is to:
1. Create a visually stunning, emotionally engaging script
2. Break down the content into dramatic scenes with strong visual elements
3. Create compelling narration with emotional depth
4. Generate detailed cinematic image prompts with attention to lighting, framing, and mood
5. Create an engaging title and description that highlights the cinematic quality`,
      userPromptYoutube: `Create a cinematic video script with dramatic scenes from this transcription: "{transcription}"`,
      userPromptTopic: `Create a cinematic video script with dramatic scenes about this topic: "{topic}"`,
      narrationDescription: `Create ONLY the exact spoken narration for cinematic delivery:
1. Use rich, emotionally resonant language suitable for professional voice-over
2. Write with natural dramatic pauses (using proper punctuation)
3. Maintain consistent emotional depth and tone across ALL scenes
4. Structure sentences for impactful delivery (rhythm and pacing)
5. Use vivid, specific words that evoke strong imagery
6. NO stage directions or technical notes - ONLY speakable text
7. Consider the natural flow and build-up between scenes`,
      imagePromptDescription: `Create cinematic scene with Hollywood-quality visual details:
1. For EVERY character in EVERY scene:
   - Complete physical description (age, ethnicity, build, distinguishing features)
   - Detailed facial characteristics (bone structure, complexion, eye/hair color)
   - Exact clothing (style, materials, colors, fit, condition)
   - Specific expression and micro-expressions
   - Body language and pose
2. Cinematic environment details:
   - Precise lighting setup (key light, fill light, rim light positions)
   - Exact camera specifications (lens mm, angle, height)
   - Detailed atmospheric elements (dust, fog, etc.)
   - Time of day and weather conditions
3. Technical specifications:
   - Color grading style (reference specific film looks)
   - Depth of field and focus points
   - Composition rules (rule of thirds, golden ratio)
4. Maintain perfect consistency:
   - Character appearances across ALL scenes
   - Lighting style and color palette
   - Visual tone and atmosphere`
    },
    advertisement: {
      systemPrompt: `You are an advertising copywriter and video producer. Your task is to:
1. Create a persuasive, attention-grabbing advertisement script
2. Break down the content into impactful scenes that highlight benefits
3. Create concise, compelling narration that drives action
4. Generate image prompts that showcase the product/service in an appealing way
5. Create a catchy title and description with clear call-to-action`,
      userPromptYoutube: `Create an engaging advertisement script from this transcription: "{transcription}"`,
      userPromptTopic: `Create an engaging advertisement script about this topic/product: "{topic}"`,
      narrationDescription: `Create ONLY the exact spoken ad copy, with no additional text or directions. Use clear, action-driving language with consistent brand voice and tone across all scenes. Focus on benefits and calls-to-action in a natural speaking rhythm.`,
      imagePromptDescription: `Create an advertisement scene with consistent brand visuals. IMPORTANT: For any products or characters, include their COMPLETE description in EVERY scene (product details, spokesperson appearance, etc.) as each scene is generated independently. Maintain consistent brand colors, lighting, and styling across scenes. Ensure product positioning and key features are clearly visible.`
    },
    educational: {
      systemPrompt: `You are an educational content creator and instructional designer. Your task is to:
1. Create a clear, informative educational script
2. Break down complex concepts into easy-to-understand scenes
3. Create narration that explains concepts clearly and engagingly
4. Generate image prompts that visualize concepts and aid understanding
5. Create an informative title and description that highlights learning outcomes`,
      userPromptYoutube: `Create an educational video script that clearly explains concepts from this transcription: "{transcription}"`,
      userPromptTopic: `Create an educational video script that clearly explains this topic: "{topic}"`,
      narrationDescription: `Create ONLY the exact educational narration to be spoken, with no additional text or directions. Use clear, consistent language level and terminology throughout all scenes. Maintain a steady, engaging teaching pace.`,
      imagePromptDescription: `Create an educational visual with consistent style. IMPORTANT: For any concepts, diagrams, or characters, include their COMPLETE description in EVERY scene (educational elements, instructor appearance, etc.) as each scene is generated independently. Maintain consistent visual hierarchy, labeling style, and color coding across scenes. Ensure educational elements are clearly visible and properly scaled.`
    },
    marketing: {
      systemPrompt: `You are a marketing strategist and content creator. Your task is to:
1. Create a strategic marketing script that highlights value propositions
2. Break down the content into scenes that build brand narrative
3. Create narration that resonates with the target audience
4. Generate image prompts that align with brand identity and marketing goals
5. Create a compelling title and description that drives engagement`,
      userPromptYoutube: `Create a strategic marketing video script from this transcription: "{transcription}"`,
      userPromptTopic: `Create a strategic marketing video script about this topic/brand: "{topic}"`,
      narrationDescription: `Create ONLY the exact marketing narration to be spoken, with no additional text or directions. Use consistent brand voice and messaging throughout all scenes. Maintain steady pacing that builds the brand narrative.`,
      imagePromptDescription: `Create a marketing scene with consistent brand identity. IMPORTANT: For any products, services, or characters, include their COMPLETE description in EVERY scene (brand elements, spokesperson details, etc.) as each scene is generated independently. Maintain consistent brand colors, visual style, and composition across scenes. Ensure brand elements and value propositions are prominently featured.`
    },
    kids_story: {
      systemPrompt: `You are a children's content creator and storyteller. Your task is to:
1. Create a fun, age-appropriate story script for children
2. Break down the story into colorful, engaging scenes
3. Create simple, clear narration with child-friendly language
4. Generate bright, cheerful image prompts with friendly characters
5. Create a playful title and description that appeals to children and parents`,
      userPromptYoutube: `Create a fun children's story video script from this transcription: "{transcription}"`,
      userPromptTopic: `Create a fun children's story video script about this topic: "{topic}"`,
      narrationDescription: `Create ONLY the exact spoken narration for children's content:
1. Use age-appropriate vocabulary and simple sentence structures
2. Maintain consistent character voices and personalities
3. Include natural pauses for engagement (marked by punctuation)
4. Use repetitive elements and rhythmic patterns when appropriate
5. Keep a warm, friendly tone throughout
6. Write numbers and sounds as words ("three little pigs", not "3 little pigs")
7. NO narrative directions - ONLY words to be spoken
8. Consider pacing for young listeners' attention spans`,
      imagePromptDescription: `Create child-friendly scenes with precise consistency:
1. For EVERY character in EVERY scene:
   - Exact character design (species/type if animated)
   - Complete physical description (size, shape, colors)
   - Detailed facial features (eye style, expressions)
   - Specific clothing and accessories (MUST match across scenes)
   - Friendly, appealing expressions
2. Environment details:
   - Bright, cheerful color palette (specify exact colors)
   - Safe, welcoming setting elements
   - Clear foreground and background separation
   - Age-appropriate details and props
3. Art style specifications:
   - Animation style (3D, 2D, specific studio reference)
   - Line weight and style
   - Texture and shading approach
4. Perfect consistency requirements:
   - Character designs MUST be identical across scenes
   - Color schemes must use exact same values
   - Maintain same art style throughout
   - Keep consistent scale relationships`
    },
    story: {
      systemPrompt: `You are a narrative storyteller and creative writer. Your task is to:
1. Create an engaging narrative script with character development and plot
2. Break down the story into scenes with narrative progression
3. Create immersive narration that builds the story world
4. Generate evocative image prompts that capture key story moments
5. Create an intriguing title and description that hooks the audience`,
      userPromptYoutube: `Create a narrative story video script from this transcription: "{transcription}"`,
      userPromptTopic: `Create a narrative story video script about this topic: "{topic}"`,
      narrationDescription: `Create ONLY the exact story narration to be spoken, with no additional text or directions. Use consistent character voices and narrative tone throughout all scenes. Maintain steady pacing that builds the story.`,
      imagePromptDescription: `Create a story scene with consistent narrative visuals. IMPORTANT: For any characters, include their COMPLETE description in EVERY scene (physical appearance, clothing, expressions, etc.) as each scene is generated independently. Characters MUST maintain consistent appearance across scenes. Include setting details and maintain consistent visual style, lighting, and atmosphere throughout the story.`
    },
    podcast: {
      systemPrompt: `You are a podcast producer and content creator. Your task is to:
1. Create a conversational podcast script with clear talking points
2. Break down the content into discussion segments
3. Create natural-sounding narration that feels like a conversation
4. Generate simple image prompts that complement audio content
5. Create an informative title and description that highlights episode content`,
      userPromptYoutube: `Create a podcast-style video script from this transcription: "{transcription}"`,
      userPromptTopic: `Create a podcast-style video script discussing this topic: "{topic}"`,
      narrationDescription: `Create ONLY the exact podcast narration to be spoken, with no additional text or directions. Use consistent conversational tone and pacing throughout all segments. Maintain natural speaking rhythm.`,
      imagePromptDescription: `Create a podcast-themed visual with consistent style. IMPORTANT: For any hosts or guests, include their COMPLETE description in EVERY scene (appearance, setting, equipment, etc.) as each scene is generated independently. Maintain consistent studio/setting appearance, lighting, and composition across scenes. Include relevant visual elements that support the audio content.`
    },
    science_documentary: {
      systemPrompt: `You are a science documentary writer and researcher. Your task is to:
1. Create an accurate, fascinating science documentary script
2. Break down complex scientific concepts into accessible scenes
3. Create narration that balances scientific accuracy with engaging storytelling
4. Generate image prompts that visualize scientific concepts accurately
5. Create an intriguing title and description that highlights scientific discovery`,
      userPromptYoutube: `Create a science documentary video script from this transcription: "{transcription}"`,
      userPromptTopic: `Create a science documentary video script about this topic: "{topic}"`,
      narrationDescription: `Create ONLY the exact spoken narration for scientific content:
1. Use precise scientific terminology with clear pronunciation
2. Balance technical accuracy with accessibility
3. Maintain consistent level of technical language
4. Include natural pauses for complex concept absorption
5. Structure explanations in logical progression
6. Write numbers and units for clear TTS delivery
7. NO additional notes or directions - ONLY narration
8. Consider pacing for information retention`,
      imagePromptDescription: `Create scientifically accurate visualizations with precise details:
1. For scientific subjects in EVERY scene:
   - Exact scale and measurements
   - Precise anatomical/structural details
   - Accurate color representations
   - Specific textures and materials
   - Correct proportions and relationships
2. For presenters/experts in EVERY scene:
   - Complete professional appearance
   - Exact clothing and accessories
   - Consistent facial features and expressions
3. Technical visualization elements:
   - Accurate labeling style and placement
   - Clear hierarchical information display
   - Precise diagram layouts
   - Scientific color coding systems
4. Consistency requirements:
   - Maintain exact scientific accuracy
   - Use consistent visualization styles
   - Keep uniform labeling conventions
   - Preserve scale relationships
5. Camera and composition:
   - Specific viewing angles for clarity
   - Macro or micro view specifications
   - Lighting for scientific observation`
    }
  }
};

export const usePromptStore = create<PromptState>()(
  persist(
    (set) => ({
      ...DEFAULT_PROMPTS,
      
      // Script source actions
      setScriptSource: (source) => set({ scriptSource: source }),
      
      // Video type actions
      setVideoType: (type) => set({ videoType: type }),
      
      // Scene generation actions
      setSceneGenerationSystemPrompt: (prompt) => set({ sceneGenerationSystemPrompt: prompt }),
      setSceneGenerationUserPrompt: (prompt) => set({ sceneGenerationUserPrompt: prompt }),
      
      // Topic generation actions
      setTopicGenerationSystemPrompt: (prompt) => set({ topicGenerationSystemPrompt: prompt }),
      setTopicGenerationUserPrompt: (prompt) => set({ topicGenerationUserPrompt: prompt }),
      
      // Field description actions
      setNarrationDescription: (description) => set({ narrationDescription: description }),
      setImagePromptDescription: (description) => set({ imagePromptDescription: description }),
      
      // Audio generation actions
      setAudioVoice: (voice) => set({ audioVoice: voice }),
      
      // Image generation actions
      setImageEnhancementTemplate: (template) => set({ imageEnhancementTemplate: template }),
      setImageEnhancementEnabled: (enabled) => set({ imageEnhancementEnabled: enabled }),
      
      // Video type template actions
      updateVideoTypeTemplate: (type, updates) => 
        set((state) => ({
          videoTypeTemplates: {
            ...state.videoTypeTemplates,
            [type]: {
              ...state.videoTypeTemplates[type],
              ...updates
            }
          }
        })),
      
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

// Helper function to get the appropriate prompt based on current settings
export function getCurrentPrompts(): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { 
    scriptSource, 
    videoType, 
    videoTypeTemplates,
    sceneGenerationSystemPrompt,
    sceneGenerationUserPrompt,
    topicGenerationSystemPrompt,
    topicGenerationUserPrompt
  } = usePromptStore.getState();
  
  // If using video type templates
  const template = videoTypeTemplates[videoType];
  
  if (scriptSource === 'youtube') {
    return {
      systemPrompt: template.systemPrompt,
      userPrompt: template.userPromptYoutube
    };
  } else {
    return {
      systemPrompt: template.systemPrompt,
      userPrompt: template.userPromptTopic
    };
  }
} 