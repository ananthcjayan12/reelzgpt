'use client';

import React from 'react';
import { useProjects, useProjectActions } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Edit, Film, Clock, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

export function ProjectList() {
  const projects = useProjects();
  const { loadProject, deleteProject } = useProjectActions();

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Film className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg text-gray-500">No projects yet</p>
          <p className="text-sm text-gray-400">Enter a YouTube URL to create your first project</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Your Projects</h2>
          <p className="text-muted-foreground">
            Manage and edit your video generation projects
          </p>
        </div>
      </div>
      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold">
                    {project.youtubeDetails?.title || project.youtubeUrl}
                  </h3>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>Created {formatDistanceToNow(new Date(project.createdAt))} ago</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Layers className="h-4 w-4" />
                    <span>{project.scenes.length} scenes</span>
                  </div>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <span className="cursor-help flex items-center space-x-1">
                        <div className={`h-2 w-2 rounded-full ${
                          project.status === 'completed' ? 'bg-green-500' :
                          project.status === 'processing' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`} />
                        <span>{project.status}</span>
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Project Status</h4>
                        <p className="text-sm">
                          {project.status === 'completed' ? 'This project has been fully processed and is ready to use.' :
                           project.status === 'processing' ? 'This project is currently being processed.' :
                           'This project is in draft state.'}
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => loadProject(project.id)}
                >
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit project</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this project?')) {
                      deleteProject(project.id);
                    }
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete project</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 