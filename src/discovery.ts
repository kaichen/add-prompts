import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseSkillFile, slugifyName, toPromptMarkdown } from './frontmatter.js';
import type { SkillCandidate } from './types.js';

const ignoredEntries = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const skippedDirs = new Set(['.git', 'node_modules', 'dist', 'coverage']);

export function discoverSkills(root: string, fullDepth = false): SkillCandidate[] {
  const rootSkill = join(root, 'SKILL.md');
  if (existsSync(rootSkill) && !fullDepth) {
    return [loadCandidate(root)];
  }

  const dirs: string[] = [];
  walk(root, dirs);
  if (existsSync(rootSkill)) {
    dirs.unshift(root);
  }

  const uniqueDirs = Array.from(new Set(dirs));
  return uniqueDirs.map(loadCandidate).sort((a, b) => a.dir.localeCompare(b.dir));
}

export function filterCandidates(candidates: SkillCandidate[], names: string[]): SkillCandidate[] {
  if (names.length === 0) {
    return candidates.length === 1 ? candidates : [];
  }
  if (names.includes('*')) {
    return candidates;
  }

  const wanted = names.map((name) => name.toLowerCase());
  return candidates.filter((candidate) => {
    const name = candidate.metadata?.name.toLowerCase();
    const slug = candidate.slug?.toLowerCase();
    return wanted.includes(name ?? '') || wanted.includes(slug ?? '');
  });
}

function walk(dir: string, dirs: string[]): void {
  for (const entry of safeReadDir(dir)) {
    if (skippedDirs.has(entry)) {
      continue;
    }

    const path = join(dir, entry);
    if (!statSync(path).isDirectory()) {
      continue;
    }

    if (existsSync(join(path, 'SKILL.md'))) {
      dirs.push(path);
    }
    walk(path, dirs);
  }
}

function loadCandidate(dir: string): SkillCandidate {
  const file = join(dir, 'SKILL.md');
  const extraEntries = safeReadDir(dir).filter((entry) => entry !== 'SKILL.md' && !ignoredEntries.has(entry));
  if (extraEntries.length > 0) {
    return {
      dir,
      file,
      safe: false,
      reason: `contains ${extraEntries.join(', ')}`,
    };
  }

  try {
    const parsed = parseSkillFile(file);
    const slug = slugifyName(parsed.metadata.name);
    return {
      dir,
      file,
      metadata: parsed.metadata,
      slug,
      prompt: toPromptMarkdown(parsed.metadata, parsed.body),
      safe: true,
    };
  } catch (error) {
    return {
      dir,
      file,
      safe: false,
      reason: error instanceof Error ? error.message : 'invalid SKILL.md',
    };
  }
}

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
