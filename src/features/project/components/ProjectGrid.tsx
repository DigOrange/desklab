import { Project } from '../../../types';
import { ProjectCard } from './ProjectCard';
import './ProjectGrid.css';

interface ProjectGridProps {
  projects: Project[];
  onOpen: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
}

export function ProjectGrid({
  projects,
  onOpen,
  onRename,
  onDelete,
  onToggleStar,
}: ProjectGridProps) {
  return (
    <div className="project-grid">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  );
}
