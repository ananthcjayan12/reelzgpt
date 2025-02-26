import React, { useState } from 'react';
import { usePromptStore, DEFAULT_PROMPTS } from '@/lib/store/prompts';

export function PromptTemplates() {
  const {
    sceneGenerationSystemPrompt,
    sceneGenerationUserPrompt,
    narrationDescription,
    imagePromptDescription,
    audioVoice,
    imageEnhancementTemplate,
    imageEnhancementEnabled,
    setSceneGenerationSystemPrompt,
    setSceneGenerationUserPrompt,
    setNarrationDescription,
    setImagePromptDescription,
    setAudioVoice,
    setImageEnhancementTemplate,
    setImageEnhancementEnabled,
    resetToDefaults,
  } = usePromptStore();

  const [activeTab, setActiveTab] = useState<'scene' | 'audio' | 'image'>('scene');

  const handleResetToDefaults = () => {
    if (confirm('Are you sure you want to reset all prompt templates to their default values?')) {
      resetToDefaults();
    }
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Prompt Templates</h2>
        <button
          onClick={handleResetToDefaults}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 ${
            activeTab === 'scene'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('scene')}
        >
          Scene Generation
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === 'audio'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('audio')}
        >
          Audio Settings
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === 'image'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('image')}
        >
          Image Enhancement
        </button>
      </div>

      {/* Scene Generation Tab */}
      {activeTab === 'scene' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              System Prompt
              <span className="text-xs text-gray-500 ml-2">
                (Instructions for the AI)
              </span>
            </label>
            <textarea
              value={sceneGenerationSystemPrompt}
              onChange={(e) => setSceneGenerationSystemPrompt(e.target.value)}
              className="w-full h-40 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="System prompt for scene generation"
            />
            <p className="text-xs text-gray-500">
              This prompt sets the context for how the AI should generate scenes.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              User Prompt Template
              <span className="text-xs text-gray-500 ml-2">
                (Use {'{transcription}'} as placeholder)
              </span>
            </label>
            <textarea
              value={sceneGenerationUserPrompt}
              onChange={(e) => setSceneGenerationUserPrompt(e.target.value)}
              className="w-full h-20 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="User prompt template for scene generation"
            />
            <p className="text-xs text-gray-500">
              This template will be used with the YouTube transcription. Use {'{transcription}'} where the transcription should be inserted.
            </p>
          </div>
          
          <div className="pt-4 border-t mt-4">
            <h3 className="text-md font-medium mb-3">Field Descriptions</h3>
            <p className="text-xs text-gray-500 mb-3">
              These descriptions guide the AI on how to generate narration and image prompts.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Narration Description
                </label>
                <input
                  type="text"
                  value={narrationDescription}
                  onChange={(e) => setNarrationDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description for narration field"
                />
                <p className="text-xs text-gray-500">
                  Guides the AI on how to create the narration text.
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Image Prompt Description
                </label>
                <input
                  type="text"
                  value={imagePromptDescription}
                  onChange={(e) => setImagePromptDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Description for image prompt field"
                />
                <p className="text-xs text-gray-500">
                  Guides the AI on how to create image prompts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Settings Tab */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Voice
            </label>
            <select
              value={audioVoice}
              onChange={(e) => setAudioVoice(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="alloy">Alloy (Neutral)</option>
              <option value="echo">Echo (Male)</option>
              <option value="fable">Fable (Male)</option>
              <option value="onyx">Onyx (Male)</option>
              <option value="nova">Nova (Female)</option>
              <option value="shimmer">Shimmer (Female)</option>
            </select>
            <p className="text-xs text-gray-500">
              Select the voice to use for audio generation.
            </p>
          </div>

          <div className="mt-4">
            <h3 className="text-md font-medium mb-2">Voice Samples</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <p className="font-medium mb-1">Alloy (Neutral)</p>
                <audio controls src="/voices/alloy.mp3" className="w-full h-10" />
              </div>
              <div className="p-3 border rounded-lg">
                <p className="font-medium mb-1">Echo (Male)</p>
                <audio controls src="/voices/echo.mp3" className="w-full h-10" />
              </div>
              <div className="p-3 border rounded-lg">
                <p className="font-medium mb-1">Fable (Male)</p>
                <audio controls src="/voices/fable.mp3" className="w-full h-10" />
              </div>
              <div className="p-3 border rounded-lg">
                <p className="font-medium mb-1">Onyx (Male)</p>
                <audio controls src="/voices/onyx.mp3" className="w-full h-10" />
              </div>
              <div className="p-3 border rounded-lg">
                <p className="font-medium mb-1">Nova (Female)</p>
                <audio controls src="/voices/nova.mp3" className="w-full h-10" />
              </div>
              <div className="p-3 border rounded-lg">
                <p className="font-medium mb-1">Shimmer (Female)</p>
                <audio controls src="/voices/shimmer.mp3" className="w-full h-10" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Enhancement Tab */}
      {activeTab === 'image' && (
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enableImageEnhancement"
              checked={imageEnhancementEnabled}
              onChange={(e) => setImageEnhancementEnabled(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="enableImageEnhancement" className="ml-2 block text-sm font-medium">
              Enable Image Enhancement
            </label>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Enhancement Template
              <span className="text-xs text-gray-500 ml-2">
                (Use {'{prompt}'} and {'{aspect_ratio}'} as placeholders)
              </span>
            </label>
            <textarea
              value={imageEnhancementTemplate}
              onChange={(e) => setImageEnhancementTemplate(e.target.value)}
              disabled={!imageEnhancementEnabled}
              className="w-full h-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="Template for enhancing image prompts"
            />
            <p className="text-xs text-gray-500">
              This template will be used to enhance image prompts. Use {'{prompt}'} where the original prompt should be inserted and {'{aspect_ratio}'} for the video format.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Preview</h3>
            <div className="space-y-2">
              <p className="text-xs text-gray-600">Original prompt:</p>
              <p className="text-sm p-2 bg-white border rounded">A cat sitting on a windowsill</p>
              
              <p className="text-xs text-gray-600">Enhanced prompt (16:9):</p>
              <p className="text-sm p-2 bg-white border rounded">
                {imageEnhancementEnabled 
                  ? imageEnhancementTemplate
                      .replace('{prompt}', 'A cat sitting on a windowsill')
                      .replace('{aspect_ratio}', 'horizontal (16:9)')
                  : 'A cat sitting on a windowsill'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 