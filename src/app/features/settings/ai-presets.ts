/**
 * Provider presets for Settings › AI.
 *
 * YoruMerge does not talk to any model: it runs the CLI the user already has
 * installed and authenticated, and reads a commit message off its stdout. So a
 * "provider" here is nothing but a command string — the same shape as
 * `externalEditor` and `terminal` in {@link ../../core/services/preferences-schema}.
 *
 * The stored preference is always that command, never a preset id: a machine
 * that once had Codex and now has Gemini keeps working, and a hand-tuned
 * command survives a round-trip through the picker as "Custom".
 *
 * Two things are deliberately *not* modelled here:
 *
 * - **A model list.** The model belongs inside the command, where the user can
 *   change one word. Catalogues turn over every few weeks, each CLI spells the
 *   flag differently (`-m`, `--model`, `--model=`), and which models exist at
 *   all depends on what that user's account is entitled to. A preset therefore
 *   pins a model only where the vendor publishes a *stable alias*; everywhere
 *   else it passes no model flag and the user's own default applies.
 * - **Per-provider parsing.** The backend reads the answer structurally
 *   (JSON, JSONL or plain text), so a CLI changing its envelope needs no
 *   change here.
 */

/** Placeholder the backend replaces with the prompt; see `ai_message.rs`. */
export const PROMPT_PLACEHOLDER = '{prompt}';

/** One entry of a model or thinking picker. */
export interface CommandOption {
  readonly id: string;
  readonly label: string;
}

export interface AiPreset {
  readonly id: string;
  /** Empty for `custom`: the user supplies the command. */
  readonly command: string;
  readonly label: string;
  /** How the prompt reaches this CLI, shown next to the command field. */
  readonly hint: string;
  /**
   * Flag carrying the model, and the values worth offering — set only where the
   * vendor publishes names that will still exist in six months. Everywhere else
   * the model stays in the command field, because a picker listing models a
   * user's account cannot reach is worse than no picker.
   */
  readonly modelFlag?: string;
  readonly models?: readonly CommandOption[];
  /**
   * Flag carrying the reasoning effort. Set only where it is known to work:
   * `copilot --effort` is refused outright by its own default model, so it is
   * deliberately absent there.
   */
  readonly effortFlag?: string;
  readonly efforts?: readonly CommandOption[];
}

export const CUSTOM_PRESET_ID = 'custom';

/**
 * Picker value meaning "don't pass the flag at all" — whatever the CLI is
 * configured to use wins. Empty so it can never collide with a real value.
 */
export const PROVIDER_DEFAULT_ID = '';

/**
 * Starting house rules, filled in the first time a provider is picked.
 *
 * Every line says something the built-in rules do not. Those already fix the
 * shape of the message — lengths, the type list, no markdown, no attribution —
 * so repeating any of it here would only spend tokens. What is left is the part
 * a small model actually gets wrong:
 *
 * - **Language.** English by default, overriding the built-in "match the
 *   history", which is the right fallback but the wrong default for a codebase
 *   whose commits are English and whose authors are not.
 * - **Choosing the type.** The built-in prompt lists the types; nothing tells
 *   the model to decide from the change rather than from the file names.
 * - **A subject with force.** "Imperative mood" in the built-in rules buys
 *   grammar, not weight: it accepts `update the parser` happily. A named list
 *   of weak verbs is what actually moves a small model off them, and it is
 *   worth the tokens because this is the one line that gets read.
 * - **A heterogeneous diff.** The common real case, and the common failure:
 *   twenty files doing three unrelated things and a subject that names one of
 *   them at random.
 * - **Not inventing a motive.** A model asked for the "why" will supply one
 *   whether the diff shows it or not. This is the line that stops it.
 *
 * Note what these rules do *not* do: decide whether there is a body at all.
 * `wants_body` already settles that from the real file and line counts, and an
 * earlier draft of this text said "add a body only when it earns one" — which
 * re-litigated that decision and lost, dropping bodies the backend had asked
 * for. These rules shape the body; they never argue about its existence.
 *
 * Meant to be edited, and Restore brings it back.
 */
export const DEFAULT_AI_INSTRUCTIONS = `Write in English, whatever language the repository history uses.
Read the whole diff before choosing a type: name what the change does, not what the files are called.
The subject is the one line that gets read: lead with a precise verb, name what it acts on, and make it stand alone in a log.
Weak verbs waste it — update, improve, change, handle, support, tweak, adjust. Name the specific thing instead.
When unrelated changes are staged together, lead with the one that carries the most weight and give the rest one body line each.
Every body line must add something the subject could not fit: what the change enables or fixes, and why.
Never a file-by-file inventory, and never a motive the diff does not show.
Mention the ticket id from the branch name when it has one.`;

/**
 * Every preset below is built from the vendor's own non-interactive
 * documentation, and every flag in one is there for a reason:
 *
 * - a print / exec mode, so the CLI answers once and exits;
 * - structured output where it exists, because a parsed field beats scraping
 *   a terminal transcript;
 * - no session persistence where the CLI offers it, so generating a commit
 *   message does not litter the user's own chat history;
 * - no agent tools, because the diff is already in the prompt and a commit
 *   message needs nothing read, written or executed.
 *
 * A CLI that only accepts its prompt as an argument carries
 * {@link PROMPT_PLACEHOLDER}; everything else gets the prompt on stdin, which
 * is the only way a large diff fits.
 *
 * Two popular CLIs are left out on purpose. **Aider** and **Goose** act on the
 * repository by default — aider will even commit on its own — and neither
 * documents a flag that reliably takes the tools away. A preset that might edit
 * or commit while "writing a commit message" is not one to ship as a default;
 * anyone who wants them can still put them in Custom.
 */
export const AI_PRESETS: readonly AiPreset[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    command:
      'claude -p --model haiku --effort low --output-format json --restricted --no-session-persistence',
    hint: 'Prompt on stdin. Low thinking cuts the tokens spent roughly fourfold on the same diff, which matters more than the model choice does.',
    modelFlag: '--model',
    // Aliases, not versions: `haiku` keeps meaning the current small model.
    models: [
      { id: 'haiku', label: 'Haiku — small, plenty for a commit message' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'opus', label: 'Opus' },
    ],
    effortFlag: '--effort',
    efforts: [
      { id: 'low', label: 'Low — measured 4x cheaper on the same diff' },
      { id: 'medium', label: 'Medium' },
      { id: 'high', label: 'High' },
    ],
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    command: 'codex exec --json --ephemeral -',
    hint: 'Prompt on stdin (the trailing `-`). Model comes from your Codex config.',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    command: 'gemini --output-format json',
    hint: 'Prompt on stdin; headless mode is automatic when output is not a terminal.',
    modelFlag: '-m',
    models: [
      { id: 'gemini-2.5-flash-lite', label: 'Flash Lite — cheapest' },
      { id: 'gemini-2.5-flash', label: 'Flash' },
      { id: 'gemini-2.5-pro', label: 'Pro' },
    ],
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot CLI',
    command: `copilot -p ${PROMPT_PLACEHOLDER} -s --no-color --deny-tool=shell`,
    hint: 'Takes the prompt as an argument, so the diff sent is capped at 16 KB. `-s` drops its stats banner; no --allow-all-tools is needed for a text-only prompt.',
  },
  {
    id: 'cursor',
    label: 'Cursor CLI',
    command: 'cursor-agent -p --output-format text',
    hint: 'Prompt on stdin.',
  },
  {
    id: 'qwen',
    label: 'Qwen Code',
    command: 'qwen --output-format json',
    hint: 'Prompt on stdin, like Gemini CLI — Qwen Code is a fork of it. Add `-p {prompt}` if your build wants the prompt as an argument.',
  },
  {
    id: 'kiro',
    label: 'Kiro CLI (Amazon)',
    command: `kiro-cli chat --no-interactive ${PROMPT_PLACEHOLDER}`,
    hint: 'Requires the prompt as an argument, so the diff sent is capped at 16 KB. Successor to the Amazon Q CLI (`q chat --no-interactive`).',
  },
  {
    id: 'opencode',
    label: 'opencode',
    command: 'opencode run',
    hint: 'Prompt on stdin. No model is pinned on purpose: opencode only offers the providers you have logged into, so a hard-coded one would break for everyone else.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    command: 'ollama run qwen2.5-coder',
    hint: 'Runs on your machine — nothing leaves it. Swap in any model you have pulled.',
  },
  {
    id: 'llm',
    label: 'llm (any provider)',
    command: 'llm',
    hint: "Simon Willison's `llm`: one-shot, no agent tools at all, and a plugin for nearly every provider — including a local LM Studio or llama.cpp. Add `-m <model>` to pin one.",
  },
  { id: CUSTOM_PRESET_ID, label: 'Custom…', command: '', hint: '' },
];

/** Which preset a stored command corresponds to. */
export function presetIdForCommand(command: string): string {
  const value = command.trim();
  if (value.length === 0) return CUSTOM_PRESET_ID;
  const match = AI_PRESETS.find(
    (preset) => preset.command.length > 0 && preset.command === value,
  );
  return match?.id ?? CUSTOM_PRESET_ID;
}

/**
 * Command to store when a preset is picked. `null` means "keep what the user
 * already typed" — the only case is switching to Custom.
 */
export function commandForPresetId(id: string): string | null {
  if (id === CUSTOM_PRESET_ID) return null;
  return AI_PRESETS.find((preset) => preset.id === id)?.command ?? '';
}

/**
 * Characters that only mean something to a shell, mirrored from
 * `ai_message.rs`. Nothing is run through one, so their presence means the
 * command would not do what the user expects.
 */
const SHELL_METACHARACTERS = ['|', '&', ';', '<', '>', '`', '$'];

/**
 * Why a command cannot be used; empty when it is fine.
 *
 * A second copy of the backend's rules, on purpose: the backend is the one that
 * enforces them, and this exists only so the dialog can say so before the user
 * clicks Test. The two must agree, which is what the spec checks.
 */
export function providerCommandError(command: string): string {
  const value = command.trim();
  if (value.length === 0) return 'Enter a command, or pick a preset.';
  const shellCharacter = SHELL_METACHARACTERS.find((char) => value.includes(char));
  if (shellCharacter !== undefined) {
    return `“${shellCharacter}” is not allowed — the command runs directly, not through a shell.`;
  }
  if (value.startsWith('-')) return 'Start with a program name.';
  if (value.split(/\s+/)[0]?.includes(PROMPT_PLACEHOLDER)) {
    return `${PROMPT_PLACEHOLDER} belongs in an argument, not in the program name.`;
  }
  return '';
}

/** Whether a command hands the prompt over as an argument rather than on stdin. */
export function sendsPromptAsArgument(command: string): boolean {
  const [, ...args] = command.trim().split(/\s+/);
  return args.some((arg) => arg.includes(PROMPT_PLACEHOLDER));
}

// ── Editing one flag of a command ────────────────────────────────────────────
//
// The model and thinking pickers are editors of the command string, never a
// second place where the truth lives. Read the value out of the command, write
// it back into the command: hand-editing the field and using the pickers stay
// the same act, and nothing can drift out of sync.

/**
 * Value carried by `flag`, or `null` when the flag is absent.
 *
 * Understands both `--model haiku` and `--model=haiku`, which is the only
 * variation these CLIs show.
 */
export function readFlagValue(command: string, flag: string): string | null {
  const tokens = command.trim().split(/\s+/);
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === flag) {
      const next = tokens[index + 1];
      // `--model --json` means the flag was left without a value.
      return next !== undefined && !next.startsWith('-') ? next : null;
    }
    if (token?.startsWith(`${flag}=`)) {
      const value = token.slice(flag.length + 1);
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

/**
 * The command with `flag` set to `value`, or with the flag removed when `value`
 * is {@link PROVIDER_DEFAULT_ID}.
 *
 * A flag that is already there is replaced where it stands; a new one is
 * appended, which every CLI here accepts — clap and commander both allow flags
 * after a positional argument.
 */
export function withFlagValue(command: string, flag: string, value: string): string {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  let replaced = false;

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) continue;

    const isSeparate = token === flag;
    const isJoined = token.startsWith(`${flag}=`);
    if (!isSeparate && !isJoined) {
      kept.push(token);
      continue;
    }

    if (isSeparate) {
      const next = tokens[index + 1];
      if (next !== undefined && !next.startsWith('-')) index++;
    }
    if (value !== PROVIDER_DEFAULT_ID && !replaced) {
      kept.push(flag, value);
      replaced = true;
    }
  }

  if (value !== PROVIDER_DEFAULT_ID && !replaced) kept.push(flag, value);
  return kept.join(' ');
}
