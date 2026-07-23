import{randomUUID}from'node:crypto';

const TIMESTAMPED_GENERATION=/^(\d{13})-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const newSnapshotGeneration=()=>`${Date.now()}-${randomUUID()}`;
export function snapshotGenerationCreatedAt(generation:string){const match=TIMESTAMPED_GENERATION.exec(generation);return match?Number(match[1]):null}
