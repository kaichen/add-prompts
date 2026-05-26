import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseSkillFile, slugifyName, toPromptMarkdown } from './frontmatter.js';
import type { BundledFile, SkillCandidate } from './types.js';

const ignoredEntries = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const skippedDirs = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const maxBundledFileBytes = 256 * 1024;
const maxBundledTotalBytes = 1024 * 1024;

export function discoverSkills(root: string, fullDepth = false, bundleExtras = false): SkillCandidate[] {
  const rootSkill = join(root, 'SKILL.md');
  if (existsSync(rootSkill) && !fullDepth) {
    return [loadCandidate(root, bundleExtras)];
  }

  const dirs: string[] = [];
  walk(root, dirs);
  if (existsSync(rootSkill)) {
    dirs.unshift(root);
  }

  const uniqueDirs = Array.from(new Set(dirs));
  return uniqueDirs.map((dir) => loadCandidate(dir, bundleExtras)).sort((a, b) => a.dir.localeCompare(b.dir));
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

function loadCandidate(dir: string, bundleExtras: boolean): SkillCandidate {
  const file = join(dir, 'SKILL.md');
  const extraEntries = safeReadDir(dir).filter((entry) => entry !== 'SKILL.md' && !ignoredEntries.has(entry));
  if (extraEntries.length > 0 && !bundleExtras) {
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
    const bundledFiles = bundleExtras ? collectBundledFiles(dir) : [];
    return {
      dir,
      file,
      metadata: parsed.metadata,
      slug,
      prompt: toPromptMarkdown(parsed.metadata, parsed.body, bundledFiles),
      safe: true,
      bundledFiles,
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

function collectBundledFiles(root: string): BundledFile[] {
  const files: BundledFile[] = [];
  let totalBytes = 0;

  for (const path of walkFiles(root)) {
    const filePath = relative(root, path);
    if (filePath === 'SKILL.md') {
      continue;
    }

    const stats = statSync(path);
    if (stats.size > maxBundledFileBytes) {
      throw new Error(`extra file is too large to bundle: ${filePath}`);
    }
    totalBytes += stats.size;
    if (totalBytes > maxBundledTotalBytes) {
      throw new Error('extra files are too large to bundle');
    }

    const content = readFileSync(path, 'utf8');
    if (content.includes('\u0000')) {
      throw new Error(`extra file is binary and cannot be bundled: ${filePath}`);
    }
    files.push({ path: filePath, kind: classifyFile(filePath), content });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function walkFiles(dir: string): string[] {
  const paths: string[] = [];
  for (const entry of safeReadDir(dir)) {
    if (ignoredEntries.has(entry) || skippedDirs.has(entry)) {
      continue;
    }

    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      paths.push(...walkFiles(path));
    } else if (stats.isFile()) {
      paths.push(path);
    }
  }
  return paths;
}

function classifyFile(path: string): BundledFile['kind'] {
  if (/\.(md|mdx|markdown)$/i.test(path)) {
    return 'markdown';
  }
  if (/\.(bash|cjs|fish|js|jsx|lua|mjs|php|pl|ps1|py|rb|rs|sh|ts|tsx|zsh)$/i.test(path)) {
    return 'script';
  }
  return 'text';
}

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
