import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import type { BundledFile, SkillMetadata } from './types.js';

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

export function toPromptMarkdown(metadata: SkillMetadata, body: string, bundledFiles: BundledFile[] = []): string {
  const bundle = bundledFiles.length > 0 ? `\n\n${renderBundledFiles(bundledFiles)}` : '';
  return `---\ndescription: ${JSON.stringify(metadata.description)}\n---\n\n${body.trim()}${bundle}\n`;
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

function renderBundledFiles(files: BundledFile[]): string {
  const rendered = files
    .map((file) => {
      const tag = file.kind === 'markdown' ? 'markdown' : file.kind === 'script' ? 'script' : 'file';
      return `<${tag} path="${escapeAttribute(file.path)}"><![CDATA[\n${escapeCdata(file.content)}\n]]></${tag}>`;
    })
    .join('\n\n');

  return `<skill_bundle>\n${rendered}\n</skill_bundle>`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeCdata(value: string): string {
  return value.replace(/\]\]>/g, ']]]]><![CDATA[>');
}
