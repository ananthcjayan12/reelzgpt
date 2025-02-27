'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Scene, Project, YouTubeDetails, ProgressStatus, ProcessingError } from '@/types';

interface ProjectState {
  // Project data
  projects: Project[];
  currentProject: Project | null;
  scenes: Scene[];
  youtubeDetails: YouTubeDetails | null;
  
  // Processing state
  isProcessing: boolean;
  progress: ProgressStatus | null;
  error: ProcessingError | null;
  
  // Actions
  createProject: (youtubeUrl: string, videoFormat: 'landscape' | 'reel') => Project;
  loadProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  setCurrentProject: (project: Project | null) => void;
  setScenes: (scenes: Scene[]) => void;
  setYouTubeDetails: (details: YouTubeDetails) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  setProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: ProgressStatus | null) => void;
  setError: (error: ProcessingError | null) => void;
  reset: () => void;
}

const initialState = {
  projects: [],
  currentProject: null,
  scenes: [],
  youtubeDetails: null,
  isProcessing: false,
  progress: null,
  error: null,
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Project management actions
      createProject: (youtubeUrl: string, videoFormat: 'landscape' | 'reel') => {
        const project: Project = {
          id: crypto.randomUUID(),
          youtubeUrl,
          transcription: '',
          scenes: [],
          status: 'draft',
          videoFormat,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          projects: [...state.projects, project],
          currentProject: project,
        }));

        return project;
      },

      loadProject: (projectId: string) => {
        const { projects } = get();
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          set({
            currentProject: project,
            scenes: project.scenes,
            youtubeDetails: project.youtubeDetails || null,
          });
        }
      },

      deleteProject: (projectId: string) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
          scenes: state.currentProject?.id === projectId ? [] : state.scenes,
          youtubeDetails: state.currentProject?.id === projectId ? null : state.youtubeDetails,
        }));
      },

      updateProject: (projectId: string, updates: Partial<Project>) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? { ...project, ...updates, updatedAt: new Date() }
              : project
          ),
          currentProject:
            state.currentProject?.id === projectId
              ? { ...state.currentProject, ...updates, updatedAt: new Date() }
              : state.currentProject,
        }));
      },

      // Current project actions
      setCurrentProject: (project) => set({ currentProject: project }),
      
      setScenes: (scenes) => {
        set({ scenes });
        // Update current project with new scenes
        const { currentProject, updateProject } = get();
        if (currentProject) {
          updateProject(currentProject.id, { scenes });
        }
      },

      setYouTubeDetails: (youtubeDetails) => {
        set({ youtubeDetails });
        // Update current project with new details
        const { currentProject, updateProject } = get();
        if (currentProject) {
          updateProject(currentProject.id, { youtubeDetails });
        }
      },

      updateScene: (sceneId: string, updates: Partial<Scene>) => {
        set((state) => {
          const updatedScenes = state.scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, ...updates } : scene
          );
          
          // Update current project with new scenes
          const { currentProject, updateProject } = get();
          if (currentProject) {
            updateProject(currentProject.id, { scenes: updatedScenes });
          }

          return { scenes: updatedScenes };
        });
      },

      // Processing state actions
      setProcessing: (isProcessing) => set({ isProcessing }),
      setProgress: (progress) => set({ progress }),
      setError: (error) => set({ error }),

      // Reset state
      reset: () => set(initialState),
    }),
    {
      name: 'youtube-video-generator-storage',
      partialize: (state) => ({
        projects: state.projects,
      }),
    }
  )
);

// Selector hooks for specific state slices
export const useProjects = () => useProjectStore((state) => state.projects);
export const useCurrentProject = () => useProjectStore((state) => state.currentProject);
export const useScenes = () => useProjectStore((state) => state.scenes);
export const useYouTubeDetails = () => useProjectStore((state) => state.youtubeDetails);
export const useProcessingState = () => ({
  isProcessing: useProjectStore((state) => state.isProcessing),
  progress: useProjectStore((state) => state.progress),
  error: useProjectStore((state) => state.error),
});

// Action hooks
export const useProjectActions = () => ({
  createProject: useProjectStore((state) => state.createProject),
  loadProject: useProjectStore((state) => state.loadProject),
  deleteProject: useProjectStore((state) => state.deleteProject),
  updateProject: useProjectStore((state) => state.updateProject),
  setCurrentProject: useProjectStore((state) => state.setCurrentProject),
  setScenes: useProjectStore((state) => state.setScenes),
  setYouTubeDetails: useProjectStore((state) => state.setYouTubeDetails),
  updateScene: useProjectStore((state) => state.updateScene),
  setProcessing: useProjectStore((state) => state.setProcessing),
  setProgress: useProjectStore((state) => state.setProgress),
  setError: useProjectStore((state) => state.setError),
  reset: useProjectStore((state) => state.reset),
}); 