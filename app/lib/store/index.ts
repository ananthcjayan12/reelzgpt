'use client';

import { create } from 'zustand';
import { Scene, Project, YouTubeDetails, ProgressStatus, ProcessingError } from '@/types';

interface ProjectState {
  // Project data
  project: Project | null;
  scenes: Scene[];
  youtubeDetails: YouTubeDetails | null;
  
  // Processing state
  isProcessing: boolean;
  progress: ProgressStatus | null;
  error: ProcessingError | null;
  
  // Actions
  setProject: (project: Project) => void;
  setScenes: (scenes: Scene[]) => void;
  setYouTubeDetails: (details: YouTubeDetails) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  setProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: ProgressStatus | null) => void;
  setError: (error: ProcessingError | null) => void;
  reset: () => void;
}

const initialState = {
  project: null,
  scenes: [],
  youtubeDetails: null,
  isProcessing: false,
  progress: null,
  error: null,
};

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,

  // Project actions
  setProject: (project) => set({ project }),
  setScenes: (scenes) => set({ scenes }),
  setYouTubeDetails: (youtubeDetails) => set({ youtubeDetails }),
  updateScene: (sceneId, updates) =>
    set((state) => ({
      scenes: state.scenes.map((scene) =>
        scene.id === sceneId ? { ...scene, ...updates } : scene
      ),
    })),

  // Processing state actions
  setProcessing: (isProcessing) => set({ isProcessing }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),

  // Reset state
  reset: () => set(initialState),
}));

// Selector hooks for specific state slices
export const useProject = () => useProjectStore((state) => state.project);
export const useScenes = () => useProjectStore((state) => state.scenes);
export const useYouTubeDetails = () => useProjectStore((state) => state.youtubeDetails);
export const useProcessingState = () => ({
  isProcessing: useProjectStore((state) => state.isProcessing),
  progress: useProjectStore((state) => state.progress),
  error: useProjectStore((state) => state.error),
});

// Action hooks
export const useProjectActions = () => ({
  setProject: useProjectStore((state) => state.setProject),
  setScenes: useProjectStore((state) => state.setScenes),
  setYouTubeDetails: useProjectStore((state) => state.setYouTubeDetails),
  updateScene: useProjectStore((state) => state.updateScene),
  setProcessing: useProjectStore((state) => state.setProcessing),
  setProgress: useProjectStore((state) => state.setProgress),
  setError: useProjectStore((state) => state.setError),
  reset: useProjectStore((state) => state.reset),
}); 