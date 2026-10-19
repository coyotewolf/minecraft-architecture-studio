import { COORDINATE_CONVENTION, MINECRAFT_VERSION, SCHEMA_VERSION } from './contracts.ts';
import type { Evidence, Project } from './contracts.ts';

export function createEmptyProject(id: string, title: string): Project {
  if (!id.trim() || id.length > 512) throw new Error('Project ID must contain 1–512 characters');
  if (title.length > 512) throw new Error('Project title exceeds 512 characters');
  return Object.freeze({
    id, title, schemaVersion: SCHEMA_VERSION, minecraftVersion: MINECRAFT_VERSION,
    coordinateConvention: COORDINATE_CONVENTION, designRevision: 'initial',
    blocks: Object.freeze([]), logicalStructures: Object.freeze([]),
  });
}
/** Narrow validation for the M0 evidence contract; full import validation is M1/M7. */
export function validateEvidence(value: Evidence): void {
  if (!['observed', 'inferred', 'ai_estimated', 'user_created'].includes(value.origin)) {
    throw new Error('Unknown evidence origin');
  }
  if (value.confidence !== undefined &&
      (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)) {
    throw new RangeError('Confidence must be between 0 and 1');
  }
}
