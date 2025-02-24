'use client';

import React from 'react';
import { useProjects, useProjectActions } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Edit } from 'lucide-react';

export function ProjectList() {
  const projects = useProjects();
  const { loadProject, deleteProject } = useProjectActions();

  if (projects.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No projects yet. Enter a YouTube URL to create your first project.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Your Projects</h2>
      <div className="grid gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="font-medium">
                  {project.youtubeDetails?.title || project.youtubeUrl}
                </h3>
                <p className="text-sm text-gray-500">
                  Created {formatDistanceToNow(new Date(project.createdAt))} ago
                </p>
                <p className="text-sm text-gray-500">
                  {project.scenes.length} scenes • Status: {project.status}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadProject(project.id)}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                  title="Edit project"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this project?')) {
                      deleteProject(project.id);
                    }
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  title="Delete project"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 