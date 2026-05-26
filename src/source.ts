import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export interface ResolvedSource {
  path: string;
  label: string;
  cleanup: () => void;
}

interface GitHubTreeSource {
  repoUrl: string;
  owner: string;
  repo: string;
  branch: string;
  subpath: string;
}

export function resolveSource(source: string): ResolvedSource {
  if (!source) {
    throw new Error('source is required');
  }

  const localPath = resolve(source);
  if (existsSync(localPath)) {
    if (!statSync(localPath).isDirectory()) {
      throw new Error(`source is not a directory: ${source}`);
    }
    return { path: localPath, label: localPath, cleanup: () => undefined };
  }

  const tree = parseGitHubTreeUrl(source);
  if (tree) {
    return cloneGitHubTree(tree);
  }

  const repoUrl = normalizeGitSource(source);
  if (repoUrl) {
    return cloneGitSource(repoUrl, source);
  }

  throw new Error(`unsupported source: ${source}`);
}

function normalizeGitSource(source: string): string | null {
  const shorthand = source.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) {
    return `https://github.com/${shorthand[1]}/${shorthand[2]}.git`;
  }

  try {
    const url = new URL(source);
    if (url.hostname === 'github.com') {
      const [owner, repo] = url.pathname.replace(/^\/|\/$/g, '').split('/');
      if (owner && repo) {
        return `https://github.com/${owner}/${repo.replace(/\.git$/, '')}.git`;
      }
    }
    if (url.protocol === 'https:' || url.protocol === 'ssh:' || url.protocol === 'git:') {
      return source;
    }
  } catch {
    if (source.startsWith('git@') || source.endsWith('.git')) {
      return source;
    }
  }

  return null;
}

function parseGitHubTreeUrl(source: string): GitHubTreeSource | null {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  if (url.hostname !== 'github.com') {
    return null;
  }

  const parts = url.pathname.replace(/^\/|\/$/g, '').split('/');
  const treeIndex = parts.indexOf('tree');
  if (parts.length < 5 || treeIndex !== 2) {
    return null;
  }

  const [owner, repo] = parts;
  if (!owner || !repo) {
    return null;
  }

  const repoUrl = `https://github.com/${owner}/${repo.replace(/\.git$/, '')}.git`;
  const afterTree = parts.slice(treeIndex + 1);
  const branch = resolveBranch(repoUrl, afterTree);
  const subpath = afterTree.slice(branch.split('/').length).join('/');

  return { repoUrl, owner, repo, branch, subpath };
}

function resolveBranch(repoUrl: string, pathParts: string[]): string {
  for (let i = pathParts.length; i >= 1; i -= 1) {
    const candidate = pathParts.slice(0, i).join('/');
    try {
      const output = execFileSync('git', ['ls-remote', '--heads', repoUrl, candidate], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (output.trim()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return pathParts[0] ?? 'main';
}

function cloneGitHubTree(tree: GitHubTreeSource): ResolvedSource {
  const temp = mkdtempSync(join(tmpdir(), 'add-prompts-'));
  const repoDir = join(temp, `${tree.owner}-${tree.repo}`);
  execFileSync('git', ['clone', '--depth', '1', '--branch', tree.branch, tree.repoUrl, repoDir], { stdio: 'ignore' });
  return {
    path: tree.subpath ? join(repoDir, tree.subpath) : repoDir,
    label: `${tree.owner}/${tree.repo}/${tree.subpath || ''}`,
    cleanup: () => rmSync(temp, { recursive: true, force: true }),
  };
}

function cloneGitSource(repoUrl: string, label: string): ResolvedSource {
  const temp = mkdtempSync(join(tmpdir(), 'add-prompts-'));
  const repoDir = join(temp, basename(label).replace(/\.git$/, '') || 'repo');
  execFileSync('git', ['clone', '--depth', '1', repoUrl, repoDir], { stdio: 'ignore' });
  return {
    path: repoDir,
    label,
    cleanup: () => rmSync(temp, { recursive: true, force: true }),
  };
}
