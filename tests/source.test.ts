import { describe, expect, it } from 'vitest';
import { parseGitHubPathUrl } from '../src/source.js';

const mainBranch = () => 'main';

describe('parseGitHubPathUrl', () => {
  it('parses GitHub tree URLs as skill directories', () => {
    expect(parseGitHubPathUrl('https://github.com/mattpocock/skills/tree/main/skills/engineering/zoom-out', mainBranch)).toMatchObject({
      kind: 'tree',
      owner: 'mattpocock',
      repo: 'skills',
      branch: 'main',
      subpath: 'skills/engineering/zoom-out',
    });
  });

  it('parses GitHub blob SKILL.md URLs as their parent skill directories', () => {
    expect(parseGitHubPathUrl('https://github.com/mattpocock/skills/blob/main/skills/engineering/zoom-out/SKILL.md', mainBranch)).toMatchObject({
      kind: 'blob',
      owner: 'mattpocock',
      repo: 'skills',
      branch: 'main',
      subpath: 'skills/engineering/zoom-out',
    });
  });

  it('rejects GitHub blob URLs that do not point to SKILL.md', () => {
    expect(() => parseGitHubPathUrl('https://github.com/mattpocock/skills/blob/main/README.md', mainBranch)).toThrow(
      'GitHub blob sources must point to a SKILL.md file',
    );
  });
});
