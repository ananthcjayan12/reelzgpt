'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { ProjectList } from '@/components/ProjectList';

export default function ProjectsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            View and manage all your video generation projects
          </p>
        </div>
        <ProjectList />
      </div>
    </MainLayout>
  );
} 