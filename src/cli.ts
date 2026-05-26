#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { discoverSkills, filterCandidates } from './discovery.js';
import { slugifyName } from './frontmatter.js';
import { formatAgent, installCandidate, listInstalled, removePrompts } from './installer.js';
import { resolveAgents, supportedAgents } from './options.js';
import { getHome } from './paths.js';
import { resolveSource } from './source.js';
import { type AddOptions, type RemoveOptions } from './types.js';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case undefined:
      case '-h':
      case '--help':
        showHelp();
        return;
      case '-v':
      case '--version':
        console.log(packageJson.version);
        return;
      case 'a':
      case 'add':
      case 'install':
        runAdd(args);
        return;
      case 'ls':
      case 'list':
        runList(args);
        return;
      case 'r':
      case 'rm':
      case 'remove':
        runRemove(args);
        return;
      case 'init':
        runInit(args);
        return;
      default:
        throw new Error(`unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

function runAdd(args: string[]): void {
  const { source, options } = parseAddArgs(args);
  if (!source) {
    throw new Error('source is required');
  }

  const resolved = resolveSource(source);
  try {
    const candidates = discoverSkills(resolved.path, options.fullDepth, options.bundleExtras);
    if (candidates.length === 0) {
      throw new Error(`no SKILL.md files found in ${resolved.label}`);
    }

    if (options.list) {
      printAvailable(candidates);
      return;
    }

    const selected = filterCandidates(candidates, options.skills);
    if (selected.length === 0) {
      if (options.skills.length === 0 && candidates.length > 1) {
        throw new Error('multiple skills found; pass --skill <name> or --all');
      }
      throw new Error(`no matching skills found for: ${options.skills.join(', ')}`);
    }

    let skipped = 0;
    for (const candidate of selected) {
      const label = candidate.metadata?.name ?? basename(candidate.dir);
      if (!candidate.safe) {
        skipped += 1;
        console.log(`Skipped ${label}: ${candidate.reason ?? 'not prompt-safe'}`);
        continue;
      }

      const results = installCandidate(candidate, options.agents, {
        dryRun: options.dryRun,
        overwrite: options.overwrite,
      });

      for (const result of results) {
        if (result.action === 'skipped') {
          skipped += 1;
          console.log(`Skipped ${label} for ${formatAgent(result.agent)}: ${result.reason}`);
          continue;
        }
        console.log(`${result.action} ${label} for ${formatAgent(result.agent)}: ${shorten(result.path)}`);
      }
    }

    if (skipped > 0) {
      process.exitCode = 1;
    }
  } finally {
    resolved.cleanup();
  }
}

function runList(args: string[]): void {
  const options = parseRemoveArgs(args);
  const installed = listInstalled(options.agents);
  if (installed.length === 0) {
    console.log('No prompts found.');
    return;
  }
  for (const item of installed) {
    const description = item.description ? ` - ${item.description}` : '';
    console.log(`${item.name} [${formatAgent(item.agent)}] ${shorten(item.path)}${description}`);
  }
}

function runRemove(args: string[]): void {
  const options = parseRemoveArgs(args);
  const names = options.all ? ['*'] : positionalArgs(args);
  const skillFlagNames = readRepeatedValues(args, ['--skill', '-s']);
  const requested = names.includes('*') || skillFlagNames.includes('*') ? ['*'] : [...names, ...skillFlagNames];

  if (requested.length === 0) {
    throw new Error('prompt name is required, or pass --all');
  }

  const slugs =
    requested.length === 1 && requested[0] === '*'
      ? listInstalled(options.agents).map((item) => item.name)
      : requested.map((name) => slugifyName(name));

  const results = removePrompts(Array.from(new Set(slugs)), options.agents, options.dryRun);
  for (const result of results) {
    console.log(`${result.action} ${formatAgent(result.agent)}: ${shorten(result.path)}`);
  }
}

function runInit(args: string[]): void {
  const name = args.find((arg) => !arg.startsWith('-')) ?? basename(process.cwd());
  const dir = args[0] && !args[0].startsWith('-') ? join(process.cwd(), name) : process.cwd();
  const file = join(dir, 'SKILL.md');
  if (existsSync(file)) {
    throw new Error(`SKILL.md already exists at ${shorten(file)}`);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    file,
    `---\nname: ${slugifyName(name)}\ndescription: Describe when this prompt should be used.\n---\n\n# ${name}\n\nWrite the reusable workflow here.\n`,
    'utf8',
  );
  console.log(`created ${shorten(file)}`);
}

function parseAddArgs(args: string[]): { source: string | undefined; options: AddOptions } {
  const all = args.includes('--all');
  const agentValues = readRepeatedValues(args, ['--agent', '-a']);
  const skillValues = readRepeatedValues(args, ['--skill', '-s']);
  return {
    source: positionalArgs(args)[0],
    options: {
      agents: resolveAgents(agentValues, all),
      skills: all ? ['*'] : skillValues,
      list: args.includes('--list') || args.includes('-l'),
      yes: all || args.includes('--yes') || args.includes('-y'),
      all,
      dryRun: args.includes('--dry-run'),
      overwrite: args.includes('--overwrite'),
      fullDepth: args.includes('--full-depth'),
      bundleExtras: args.includes('--bundle-extras'),
      global: true,
    },
  };
}

function positionalArgs(args: string[]): string[] {
  const positions: string[] = [];
  const valueFlags = new Set(['--agent', '-a', '--skill', '-s']);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (valueFlags.has(arg)) {
      for (i += 1; i < args.length && !args[i]!.startsWith('-'); i += 1) {
        continue;
      }
      i -= 1;
      continue;
    }
    if (!arg.startsWith('-')) {
      positions.push(arg);
    }
  }

  return positions;
}

function parseRemoveArgs(args: string[]): RemoveOptions {
  const all = args.includes('--all');
  const agentValues = readRepeatedValues(args, ['--agent', '-a']);
  return {
    agents: resolveAgents(agentValues, all),
    yes: all || args.includes('--yes') || args.includes('-y'),
    all,
    dryRun: args.includes('--dry-run'),
    global: true,
  };
}

function readRepeatedValues(args: string[], flags: string[]): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (!flags.includes(args[i]!)) {
      continue;
    }
    let consumed = 0;
    for (let j = i + 1; j < args.length && !args[j]!.startsWith('-'); j += 1) {
      values.push(...args[j]!.split(',').map((part) => part.trim()).filter(Boolean));
      consumed += 1;
    }
    if (consumed === 0) {
      throw new Error(`${args[i]} requires a value`);
    }
  }
  return values;
}

function printAvailable(candidates: ReturnType<typeof discoverSkills>): void {
  for (const candidate of candidates) {
    const label = candidate.metadata?.name ?? basename(candidate.dir);
    if (candidate.safe) {
      console.log(`${label} (${candidate.slug}) - prompt-safe`);
    } else {
      console.log(`${label} - skipped: ${candidate.reason ?? 'not prompt-safe'}`);
    }
  }
}

function shorten(path: string): string {
  const home = getHome();
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

function showHelp(): void {
  console.log(`add-prompts ${packageJson.version}

Usage:
  add-prompts add <source> [options]
  add-prompts list [options]
  add-prompts remove <names...> [options]
  add-prompts init [name]

Source formats:
  owner/repo
  https://github.com/owner/repo
  https://github.com/owner/repo/tree/main/path/to/skill
  https://github.com/owner/repo/blob/main/path/to/skill/SKILL.md
  git@github.com:owner/repo.git
  ./local-skills

Options:
  -a, --agent <agents...>   Target agents: codex, claude-code, pi, or '*'
  -s, --skill <skills...>   Skill names to convert, or '*'
  -l, --list                List source skills without installing
  -g, --global              Install to user prompt directories (default)
  -y, --yes                 Skip confirmations
  --all                     Select every prompt-safe skill; targets every agent only when --agent is absent
  --dry-run                 Show writes without changing files
  --overwrite               Replace existing prompt files
  --full-depth              Search nested skills even when root has SKILL.md
  --bundle-extras           Bundle non-SKILL.md files into the generated prompt as XML
  -h, --help                Show help
  -v, --version             Show version`);
}

void main();
