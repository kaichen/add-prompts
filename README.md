# add-prompts

Convert prompt-safe single-file agent skills into native prompt entries for Codex, Claude Code, and Pi.

`add-prompts` is intentionally strict: it only converts a skill directory when that directory contains `SKILL.md` and no other meaningful files. If a skill depends on `references/`, `scripts/`, `assets/`, or any other sibling file, the CLI refuses to convert it because the result would lose behavior.

## Install from a source

```bash
npx add-prompts add vercel-labs/agent-skills --skill think -a codex -a claude-code -a pi
```

Supported source formats:

```bash
npx add-prompts add owner/repo
npx add-prompts add https://github.com/owner/repo
npx add-prompts add https://github.com/owner/repo/tree/main/path/to/skill
npx add-prompts add https://github.com/owner/repo/blob/main/path/to/skill/SKILL.md
npx add-prompts add git@github.com:owner/repo.git
npx add-prompts add ./local-skills
```

## Options

| Option | Meaning |
| --- | --- |
| `-a, --agent <agents...>` | Target `codex`, `claude-code`, `pi`, or `'*'`. |
| `-s, --skill <skills...>` | Convert specific skills by name, or `'*'`. |
| `-l, --list` | List source skills without installing. |
| `-g, --global` | Install to user prompt directories. This is the default in 0.1.0. |
| `-y, --yes` | Skip confirmations. Included for compatibility with `skills`-style commands. |
| `--all` | Select every prompt-safe skill. If `--agent` is absent, target every supported agent. |
| `--dry-run` | Show writes without changing files. |
| `--overwrite` | Replace existing prompt files. |
| `--full-depth` | Search nested skills even when the source root has `SKILL.md`. |
| `--bundle-extras` | Bundle non-`SKILL.md` files into the generated prompt as XML-wrapped markdown/scripts/text. |

## Output paths

| Agent | Global prompt path |
| --- | --- |
| Codex | `~/.codex/prompts/<name>.md` |
| Claude Code | `~/.claude/commands/<name>.md` |
| Pi | `~/.pi/agent/prompts/<name>.md` |

## Commands

```bash
add-prompts add <source> [options]
add-prompts list [options]
add-prompts remove <names...> [options]
add-prompts init [name]
```

## Examples

List convertible skills:

```bash
npx add-prompts add ./skills --list
```

Install all prompt-safe skills to all supported agents:

```bash
npx add-prompts add ./skills --all
```

Preview writes before changing files:

```bash
npx add-prompts add ./skills --skill think -a codex --dry-run
```

Bundle a multi-file skill into one prompt:

```bash
npx add-prompts add ./skills --skill think -a codex --bundle-extras
```

Remove an installed prompt:

```bash
npx add-prompts remove think -a codex
```

## Prompt-safe rule

Accepted:

```text
think/
  SKILL.md
```

Rejected:

```text
think/
  SKILL.md
  references/
```

The rejected form should remain a skill. `add-prompts` converts explicit workflows into prompt templates; it does not emulate skill loading.

Pass `--bundle-extras` only when you intentionally want those extra files embedded into the generated prompt. Extra markdown files are wrapped in `<markdown>` tags, scripts in `<script>` tags, and other text files in `<file>` tags inside a `<skill_bundle>` block.
