import { homedir } from 'node:os';
import { join } from 'node:path';
import { agents, type Agent } from './types.js';

export function getHome(): string {
  return process.env.ADD_PROMPTS_HOME || homedir();
}

export function getAgentPromptDir(agent: Agent): string {
  return join(getHome(), agents[agent].promptDir);
}

export function getAgentPromptPath(agent: Agent, slug: string): string {
  return join(getAgentPromptDir(agent), `${slug}.md`);
}
