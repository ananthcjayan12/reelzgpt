'use client';

import React from 'react';
import { useProjects, useProjectActions } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Edit, Film, Clock, Layers } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './ui/hover-card';

export function ProjectList() {
  const projects = useProjects();
  const { loadProject, deleteProject } = useProjectActions();

  if (projects.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12">
          <Film className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">No projects yet</p>
          <p className="text-sm text-muted-foreground text-center">
            Enter a YouTube URL to create your first project
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg sm:text-2xl font-bold tracking-tight">Your Projects</h2>
        <p className="text-sm text-muted-foreground">
          Manage and edit your video generation projects
        </p>
      </div>

      <div className="grid gap-3">
        {projects.map((project) => (
          <Card key={project.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-base truncate">
                      {project.youtubeDetails?.title || project.youtubeUrl}
                    </h3>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadProject(project.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit project</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this project?')) {
                          deleteProject(project.id);
                        }
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:border-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete project</span>
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Created {formatDistanceToNow(new Date(project.createdAt))} ago</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 shrink-0" />
                    <span>{project.scenes.length} scenes</span>
                  </div>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <div className="flex items-center gap-1.5 cursor-help">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${
                          project.status === 'completed' ? 'bg-green-500' :
                          project.status === 'processing' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`} />
                        <span className="capitalize">{project.status}</span>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" align="start">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 