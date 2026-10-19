import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createEmptyProject } from './core/project.ts';
import './style.css';

export function App() {
  const [project, setProject] = useState(() => createEmptyProject('untitled', 'Untitled project'));
  return <main>
    <h1>Minecraft Architecture Studio</h1>
    <p>M0 foundation · Minecraft Java {project.minecraftVersion}</p>
    <label>Project name <input maxLength={512} value={project.title} onChange={event => setProject({ ...project, title: event.target.value })}/></label>
    <dl><dt>Occupied cells</dt><dd>{project.blocks.length}</dd><dt>Design revision</dt><dd>{project.designRevision}</dd></dl>
    <p>Coordinate convention: +X east, +Y up, +Z south. North is −Z.</p>
    <p role="status">Editor, persistence and AI providers are not implemented yet. This project exists only in memory.</p>
  </main>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App/></StrictMode>);
