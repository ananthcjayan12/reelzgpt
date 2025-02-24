import React, { useState } from 'react';
import { useSettingsStore, OPENAI_MODELS } from '@/lib/store/settings';
import { validateApiKey as validateOpenAIKey } from '@/lib/services/openai';
import { validateApiKey as validateReplicateKey } from '@/lib/services/replicate';

export function Settings() {
  const {
    openaiApiKey,
    replicateApiKey,
    selectedModel,
    setOpenAIKey,
    setReplicateKey,
    setSelectedModel,
  } = useSettingsStore();

  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isTestingReplicate, setIsTestingReplicate] = useState(false);
  const [openAIStatus, setOpenAIStatus] = useState<'success' | 'error' | null>(null);
  const [replicateStatus, setReplicateStatus] = useState<'success' | 'error' | null>(null);

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
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold">Settings</h2>
      
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
  );
} 