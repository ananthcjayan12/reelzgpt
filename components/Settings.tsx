import React, { useState } from 'react';
import { useSettingsStore, OPENAI_MODELS } from '@/lib/store/settings';
import { validateApiKey as validateOpenAIKey } from '@/lib/services/openai';
import { validateApiKey as validateReplicateKey } from '@/lib/services/replicate';
import { PromptTemplates } from './PromptTemplates';

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
      <h2 className="text-xl font-semibold">Settings</h2>
      
      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 ${
            activeTab === 'api'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('api')}
        >
          API Keys
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === 'prompts'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('prompts')}
        >
          Prompt Templates
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === 'subtitles'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('subtitles')}
        >
          Subtitle Settings
        </button>
      </div>
      
      {/* API Keys Tab */}
      {activeTab === 'api' && (
        <div className="space-y-6 p-6 bg-white rounded-lg shadow">
          {/* OpenAI Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                OpenAI API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => {
                    setOpenAIKey(e.target.value);
                    setOpenAIStatus(null);
                  }}
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="sk-..."
                />
                <button
                  onClick={testOpenAIKey}
                  disabled={isTestingOpenAI || !openaiApiKey}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingOpenAI ? 'Testing...' : 'Test Key'}
                </button>
              </div>
              {openAIStatus && (
                <p className={openAIStatus === 'success' ? 'text-green-600' : 'text-red-600'}>
                  {openAIStatus === 'success' ? 'API key is valid' : 'Invalid API key'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                OpenAI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {OPENAI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Replicate Settings */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Replicate API Token
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={replicateApiKey}
                onChange={(e) => {
                  setReplicateKey(e.target.value);
                  setReplicateStatus(null);
                }}
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="r8_..."
              />
              <button
                onClick={testReplicateKey}
                disabled={isTestingReplicate || !replicateApiKey}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingReplicate ? 'Testing...' : 'Test Key'}
              </button>
            </div>
            {replicateStatus && (
              <p className={replicateStatus === 'success' ? 'text-green-600' : 'text-red-600'}>
                {replicateStatus === 'success' ? 'API token is valid' : 'Invalid API token'}
              </p>
            )}
          </div>

          <div className="pt-4 text-sm text-gray-500">
            <p>Note: API keys are stored securely in your browser's local storage.</p>
            <p>Your keys are never sent to our servers.</p>
          </div>
        </div>
      )}
      
      {/* Prompt Templates Tab */}
      {activeTab === 'prompts' && <PromptTemplates />}

      {/* Subtitle Settings Tab */}
      {activeTab === 'subtitles' && (
        <div className="space-y-6 p-6 bg-white rounded-lg shadow">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Subtitle Appearance</h3>
            
            {/* Highlight Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Highlight Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={subtitleSettings.highlightColor}
                  onChange={(e) => setSubtitleSettings({ highlightColor: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={subtitleSettings.highlightColor}
                  onChange={(e) => setSubtitleSettings({ highlightColor: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
                />
                <div className="flex-1">
                  <span className="text-sm text-gray-500">Color for highlighted words</span>
                </div>
              </div>
            </div>
            
            {/* Display Word Count */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Words to Display
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={subtitleSettings.displayWordCount}
                  onChange={(e) => setSubtitleSettings({ displayWordCount: parseInt(e.target.value) })}
                  className="w-48"
                />
                <span className="w-8 text-center">{subtitleSettings.displayWordCount}</span>
                <div className="flex-1">
                  <span className="text-sm text-gray-500">Number of words to show at once</span>
                </div>
              </div>
            </div>
            
            {/* Font Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Font Size
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="16"
                  max="48"
                  value={subtitleSettings.fontSize}
                  onChange={(e) => setSubtitleSettings({ fontSize: parseInt(e.target.value) })}
                  className="w-48"
                />
                <span className="w-8 text-center">{subtitleSettings.fontSize}px</span>
                <div className="flex-1">
                  <span className="text-sm text-gray-500">Size of subtitle text</span>
                </div>
              </div>
            </div>
            
            {/* Progress Bar Toggle */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={subtitleSettings.showProgressBar}
                  onChange={(e) => setSubtitleSettings({ showProgressBar: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Show Progress Bar</span>
              </label>
              <div className="pl-6">
                <span className="text-sm text-gray-500">Display a progress bar below subtitles</span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Preview</h4>
            <div className="relative bg-black rounded-lg h-24 flex items-center justify-center">
              <div className="subtitle-container flex flex-col items-center">
                <div className="subtitle-words flex gap-2 p-2 bg-black bg-opacity-60 rounded-lg">
                  {['This', 'is', 'a', 'sample', 'text'].map((word, index) => (
                    <span 
                      key={index}
                      style={{
                        color: index === 2 ? subtitleSettings.highlightColor : 'white',
                        fontWeight: index === 2 ? 'bold' : 'normal',
                        fontSize: `${subtitleSettings.fontSize}px`,
                        transform: index === 2 ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </div>
                
                {subtitleSettings.showProgressBar && (
                  <div className="subtitle-progress w-32 h-1 bg-white bg-opacity-30 rounded mt-2">
                    <div 
                      className="h-full rounded"
                      style={{ 
                        width: '60%', 
                        backgroundColor: subtitleSettings.highlightColor 
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 