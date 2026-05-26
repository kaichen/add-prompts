import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import type { SkillMetadata } from './types.js';

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseSkillFile(file: string): { metadata: SkillMetadata; body: string } {
  const raw = readFileSync(file, 'utf8');
  const match = raw.match(frontmatterPattern);
  if (!match) {
    throw new Error('missing YAML frontmatter');
  }

  const data = YAML.parse(match[1] ?? '') as Partial<SkillMetadata> | null;
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  const description = typeof data?.description === 'string' ? data.description.trim() : '';

  if (!name) {
    throw new Error('frontmatter.name is required');
  }
  if (!description) {
    throw new Error('frontmatter.description is required');
  }

  return {
    metadata: { name, description },
    body: raw.slice(match[0].length).trimStart(),
  };
}

export function toPromptMarkdown(metadata: SkillMetadata, body: string): string {
  return `---\ndescription: ${JSON.stringify(metadata.description)}\n---\n\n${body.trim()}\n`;
}

export function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  if (!slug) {
    throw new Error(`cannot derive a safe filename from skill name: ${name}`);
  }
  return slug;
}
