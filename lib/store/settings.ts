import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  openaiApiKey: string;
  replicateApiKey: string;
  selectedModel: string;
  subtitleSettings: {
    highlightColor: string;
    displayWordCount: number;
    fontSize: number;
    showProgressBar: boolean;
  };
}

interface SettingsState extends Settings {
  setOpenAIKey: (key: string) => void;
  setReplicateKey: (key: string) => void;
  setSelectedModel: (model: string) => void;
  setSubtitleSettings: (settings: Partial<Settings['subtitleSettings']>) => void;
}

export const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4O' },
  { id: 'gpt-4o-mini', name: 'GPT-4O Mini' },
  { id: 'o3-mini', name: 'O3 Mini' },
] as const;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      openaiApiKey: '',
      replicateApiKey: '',
      selectedModel: 'gpt-4o-mini',
      subtitleSettings: {
        highlightColor: '#ff4d4d',
        displayWordCount: 5,
        fontSize: 24,
        showProgressBar: true,
      },
      setOpenAIKey: (key) => set({ openaiApiKey: key }),
      setReplicateKey: (key) => set({ replicateApiKey: key }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setSubtitleSettings: (settings) => 
        set((state) => ({ 
          subtitleSettings: { 
            ...state.subtitleSettings, 
            ...settings 
          } 
        })),
    }),
    {
      name: 'app-settings',
    }
  )
); 