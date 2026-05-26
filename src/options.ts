import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getHome } from './paths.js';
import { agents, type Agent } from './types.js';

export const supportedAgents = Object.keys(agents) as Agent[];

export function resolveAgents(agentValues: string[], all: boolean): Agent[] {
  if (agentValues.includes('*')) {
    return supportedAgents;
  }
  if (agentValues.length > 0) {
    return parseAgents(agentValues);
  }
  return all ? supportedAgents : detectAgents();
}

export function parseAgents(values: string[]): Agent[] {
  const invalid = values.filter((value) => !supportedAgents.includes(value as Agent));
  if (invalid.length > 0) {
    throw new Error(`invalid agent: ${invalid.join(', ')}. Valid agents: ${supportedAgents.join(', ')}`);
  }
  return values as Agent[];
}

function detectAgents(): Agent[] {
  const home = getHome();
  const detected = supportedAgents.filter((agent) => existsSync(join(home, agents[agent].promptDir.split('/')[0]!)));
  return detected.length > 0 ? detected : supportedAgents;
}
