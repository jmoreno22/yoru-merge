import { describe, expect, it } from 'vitest';
import { MAX_AI_INSTRUCTIONS } from '../../core/services/preferences-schema';
import {
  AI_PRESETS,
  CUSTOM_PRESET_ID,
  commandForPresetId,
  DEFAULT_AI_INSTRUCTIONS,
  PROMPT_PLACEHOLDER,
  PROVIDER_DEFAULT_ID,
  presetIdForCommand,
  providerCommandError,
  readFlagValue,
  sendsPromptAsArgument,
  withFlagValue,
} from './ai-presets';

describe('presetIdForCommand', () => {
  it('recognises every built-in preset from its own command', () => {
    for (const preset of AI_PRESETS) {
      if (preset.id === CUSTOM_PRESET_ID) continue;
      expect(presetIdForCommand(preset.command)).toBe(preset.id);
    }
  });

  it('falls back to custom for a hand-written or empty command', () => {
    expect(presetIdForCommand('')).toBe(CUSTOM_PRESET_ID);
    expect(presetIdForCommand('   ')).toBe(CUSTOM_PRESET_ID);
    expect(presetIdForCommand('my-own-cli --answer')).toBe(CUSTOM_PRESET_ID);
    // A preset command with an edited model is no longer that preset.
    expect(presetIdForCommand('claude -p --model opus')).toBe(CUSTOM_PRESET_ID);
  });
});

describe('commandForPresetId', () => {
  it('round-trips every preset that carries a command', () => {
    for (const preset of AI_PRESETS) {
      if (preset.command.length === 0) continue;
      expect(commandForPresetId(preset.id)).toBe(preset.command);
    }
  });

  it('keeps what the user typed when switching to custom', () => {
    expect(commandForPresetId(CUSTOM_PRESET_ID)).toBeNull();
  });

  it('treats an unknown id as "clear it"', () => {
    expect(commandForPresetId('nope')).toBe('');
  });
});

describe('the preset list itself', () => {
  it('has no duplicate ids or commands', () => {
    const ids = AI_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    const commands = AI_PRESETS.map((preset) => preset.command).filter(
      (command) => command.length > 0,
    );
    expect(new Set(commands).size).toBe(commands.length);
  });

  /**
   * A preset the backend would refuse is worse than no preset: the user picks
   * it from a list and gets an error they did not write.
   */
  it('ships only commands the validator accepts', () => {
    for (const preset of AI_PRESETS) {
      if (preset.command.length === 0) continue;
      expect(providerCommandError(preset.command), preset.id).toBe('');
    }
  });

  it('explains itself: every real preset carries a hint', () => {
    for (const preset of AI_PRESETS) {
      if (preset.id === CUSTOM_PRESET_ID) continue;
      expect(preset.hint.length, preset.id).toBeGreaterThan(0);
    }
  });
});

describe('providerCommandError', () => {
  it('accepts a plain command', () => {
    expect(providerCommandError('claude -p')).toBe('');
    expect(providerCommandError('  gemini --output-format json  ')).toBe('');
  });

  it('asks for something when the field is empty', () => {
    expect(providerCommandError('')).toContain('Enter a command');
    expect(providerCommandError('   ')).toContain('Enter a command');
  });

  /**
   * Mirrors `SHELL_METACHARACTERS` in `ai_message.rs`. The backend is what
   * enforces this; the dialog only has to say so before the user hits Test.
   */
  it('refuses shell syntax, the way the backend does', () => {
    for (const command of [
      'claude -p | tee log',
      'claude -p && echo done',
      'claude; rm -rf /',
      'claude -p > out.txt',
      'claude -p < in.txt',
      'claude `whoami`',
      '$HOME/bin/claude -p',
    ]) {
      expect(providerCommandError(command), command).toContain('not through a shell');
    }
  });

  it('refuses a command that starts with a flag', () => {
    expect(providerCommandError('--model haiku')).toContain('program name');
  });

  it('refuses the placeholder as the program', () => {
    expect(providerCommandError(`${PROMPT_PLACEHOLDER} -p`)).toContain(
      'belongs in an argument',
    );
  });
});

describe('sendsPromptAsArgument', () => {
  it('is true only when an argument carries the placeholder', () => {
    expect(sendsPromptAsArgument(`copilot -p ${PROMPT_PLACEHOLDER} -s`)).toBe(true);
    expect(sendsPromptAsArgument(`mycli --prompt=${PROMPT_PLACEHOLDER}`)).toBe(true);
    expect(sendsPromptAsArgument('claude -p')).toBe(false);
    expect(sendsPromptAsArgument('')).toBe(false);
  });

  /**
   * Only the CLIs that genuinely refuse a piped prompt use the argument form —
   * Copilot and Kiro, per their own docs. Everything else reads stdin, which is
   * the only way a real diff fits.
   */
  it('matches what each preset declares', () => {
    const viaArgument = AI_PRESETS.filter((preset) =>
      sendsPromptAsArgument(preset.command),
    ).map((preset) => preset.id);
    expect(viaArgument).toEqual(['copilot', 'kiro']);
  });
});

describe('readFlagValue', () => {
  it('reads both spellings of a flag value', () => {
    expect(readFlagValue('claude -p --model haiku', '--model')).toBe('haiku');
    expect(readFlagValue('claude -p --model=haiku', '--model')).toBe('haiku');
    expect(readFlagValue('gemini -m gemini-2.5-flash', '-m')).toBe('gemini-2.5-flash');
  });

  it('is null when the flag is missing', () => {
    expect(readFlagValue('claude -p', '--model')).toBeNull();
    expect(readFlagValue('', '--model')).toBeNull();
  });

  /** A dangling flag has no value, and must not swallow the next flag. */
  it('is null when the flag has no value', () => {
    expect(readFlagValue('claude --model --output-format json', '--model')).toBeNull();
    expect(readFlagValue('claude --model', '--model')).toBeNull();
    expect(readFlagValue('claude --model=', '--model')).toBeNull();
  });

  /** `-m` must not match `--model`, nor `--model` match `--model-alias`. */
  it('does not match a flag that merely starts the same', () => {
    expect(readFlagValue('cli --model-alias x', '--model')).toBeNull();
    expect(readFlagValue('cli --model haiku', '-m')).toBeNull();
  });
});

describe('withFlagValue', () => {
  it('replaces a value in place, leaving the rest of the command alone', () => {
    expect(
      withFlagValue('claude -p --model haiku --output-format json', '--model', 'opus'),
    ).toBe('claude -p --model opus --output-format json');
    expect(withFlagValue('claude --model=haiku -p', '--model', 'sonnet')).toBe(
      'claude --model sonnet -p',
    );
  });

  it('appends a flag that was not there', () => {
    expect(withFlagValue('gemini --output-format json', '-m', 'gemini-2.5-pro')).toBe(
      'gemini --output-format json -m gemini-2.5-pro',
    );
  });

  it('removes the flag for the provider default', () => {
    expect(
      withFlagValue(
        'claude -p --model haiku --effort low',
        '--model',
        PROVIDER_DEFAULT_ID,
      ),
    ).toBe('claude -p --effort low');
    expect(
      withFlagValue('claude --model=haiku -p', '--model', PROVIDER_DEFAULT_ID),
    ).toBe('claude -p');
    // Removing something that is not there changes nothing.
    expect(withFlagValue('claude -p', '--model', PROVIDER_DEFAULT_ID)).toBe(
      'claude -p',
    );
  });

  /** A dangling flag is a value slot to fill, not a token to duplicate. */
  it('fills a flag that had no value', () => {
    expect(
      withFlagValue('claude --model --output-format json', '--model', 'haiku'),
    ).toBe('claude --model haiku --output-format json');
  });

  it('leaves the prompt placeholder untouched', () => {
    const command = withFlagValue(
      `copilot -p ${PROMPT_PLACEHOLDER} -s`,
      '--model',
      'auto',
    );
    expect(command).toBe(`copilot -p ${PROMPT_PLACEHOLDER} -s --model auto`);
    expect(sendsPromptAsArgument(command)).toBe(true);
  });

  /** Whatever the pickers produce has to be a command the backend will run. */
  it('never produces a command the validator refuses', () => {
    for (const preset of AI_PRESETS) {
      if (!preset.modelFlag || !preset.models) continue;
      for (const model of [...preset.models.map((m) => m.id), PROVIDER_DEFAULT_ID]) {
        const command = withFlagValue(preset.command, preset.modelFlag, model);
        expect(providerCommandError(command), `${preset.id}/${model}`).toBe('');
        // And the value round-trips through the reader.
        expect(readFlagValue(command, preset.modelFlag)).toBe(
          model === PROVIDER_DEFAULT_ID ? null : model,
        );
      }
    }
  });
});

describe('the model and thinking pickers', () => {
  /**
   * A picker needs its flag, and whatever the preset starts on has to be an
   * option the picker can show: either one of its values, or `null`, which is
   * {@link PROVIDER_DEFAULT_ID} — the CLI's own choice, and where a preset
   * starts when pinning a version would age badly.
   */
  it('always start on a value their own picker offers', () => {
    for (const preset of AI_PRESETS) {
      if (preset.models) {
        expect(preset.modelFlag, preset.id).toBeDefined();
        const current = readFlagValue(preset.command, preset.modelFlag ?? '');
        expect([...preset.models.map((m) => m.id), null], preset.id).toContain(current);
      }
      if (preset.efforts) {
        expect(preset.effortFlag, preset.id).toBeDefined();
        const current = readFlagValue(preset.command, preset.effortFlag ?? '');
        expect([...preset.efforts.map((e) => e.id), null], preset.id).toContain(
          current,
        );
      }
    }
  });

  /** Claude ships pinned to the cheap combination the measurements favour. */
  it('start Claude Code on haiku with low thinking', () => {
    const claude = AI_PRESETS.find((preset) => preset.id === 'claude');
    expect(readFlagValue(claude?.command ?? '', '--model')).toBe('haiku');
    expect(readFlagValue(claude?.command ?? '', '--effort')).toBe('low');
  });

  /**
   * `copilot --effort` is rejected by its own default model, and opencode only
   * offers the providers each user has logged into. Neither gets a picker.
   */
  it('are absent where the flag is unreliable', () => {
    const byId = (id: string) => AI_PRESETS.find((preset) => preset.id === id);
    expect(byId('copilot')?.efforts).toBeUndefined();
    expect(byId('opencode')?.models).toBeUndefined();
    expect(byId('ollama')?.models).toBeUndefined();
    expect(byId('llm')?.models).toBeUndefined();
  });
});

describe('default house rules', () => {
  /** `build_prompt` emits one indented line per rule, so a blank one is noise. */
  it('are non-empty lines that fit the stored cap', () => {
    const lines = DEFAULT_AI_INSTRUCTIONS.split('\n');
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.length).toBeLessThanOrEqual(10);
    for (const line of lines) {
      expect(line.trim()).toBe(line);
      expect(line.length).toBeGreaterThan(0);
    }
    expect(DEFAULT_AI_INSTRUCTIONS.length).toBeLessThanOrEqual(MAX_AI_INSTRUCTIONS);
  });

  it('fix the language, since the built-in rules only follow the history', () => {
    expect(DEFAULT_AI_INSTRUCTIONS).toMatch(/\bEnglish\b/);
  });

  /**
   * These rules ride along on every single prompt, so anything the built-in
   * block already says is pure cost. `build_prompt` in `ai_message.rs` owns the
   * lengths, the type list and the prohibitions; this layer owns judgement.
   */
  it('do not repeat what the built-in rules already say', () => {
    for (const duplicated of [
      /50 characters/i,
      /Conventional Commits/i,
      /\bmarkdown\b/i,
      /code fence/i,
      /co-author/i,
      /\bpreamble\b/i,
      /imperative/i,
    ]) {
      expect(DEFAULT_AI_INSTRUCTIONS, String(duplicated)).not.toMatch(duplicated);
    }
  });

  /** The line that stops a small model supplying a "why" the diff never shows. */
  it('forbid inventing a motive', () => {
    expect(DEFAULT_AI_INSTRUCTIONS).toMatch(/never a motive the diff does not show/i);
  });

  /**
   * "Imperative mood" in the built-in rules buys grammar, not weight — it is
   * happy with `update the parser`. Naming the weak verbs is what moves a small
   * model off them, so the list is worth protecting from a well-meaning trim.
   */
  it('name the weak verbs rather than just asking for a strong subject', () => {
    for (const weak of ['update', 'improve', 'change', 'handle', 'support']) {
      expect(DEFAULT_AI_INSTRUCTIONS, weak).toContain(weak);
    }
  });
});

describe('coverage of the common subscriptions', () => {
  /**
   * Not a style check: the point of the list is that someone who already pays
   * for one of the mainstream assistants finds it here instead of having to
   * work out the flags themselves.
   */
  it('ships a preset for each major vendor, a local option and a universal one', () => {
    const ids = AI_PRESETS.map((preset) => preset.id);
    for (const expected of [
      'claude', // Anthropic
      'codex', // OpenAI / ChatGPT
      'gemini', // Google
      'copilot', // GitHub
      'cursor', // Cursor
      'qwen', // Alibaba
      'kiro', // Amazon
      'opencode', // bring-your-own provider
      'ollama', // local, nothing leaves the machine
      'llm', // anything else, via plugins
    ]) {
      expect(ids, expected).toContain(expected);
    }
  });

  /** Aider and Goose are excluded deliberately — see the module comment. */
  it('ships nothing that edits or commits on its own', () => {
    const ids = AI_PRESETS.map((preset) => preset.id);
    expect(ids).not.toContain('aider');
    expect(ids).not.toContain('goose');
  });
});
