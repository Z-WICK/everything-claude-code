/**
 * Runtime-aware storage path helpers for Claude Code and Factory/Droid.
 */

export type EccRuntime = 'claude' | 'factory';

export interface DetectRuntimeOptions {
  input?: Record<string, unknown> | null;
  pluginRoot?: string | null;
}

/** Infer the current ECC runtime from env vars, hook payloads, or plugin root. */
export function detectRuntime(options?: DetectRuntimeOptions): EccRuntime;

/** Get ~/.claude */
export function getClaudeDir(): string;

/** Get ~/.factory */
export function getFactoryDir(): string;

/** Get ~/.factory/ecc */
export function getFactoryEccDir(): string;

/** Get ~/.factory/ecc/sessions */
export function getFactorySessionSummariesDir(): string;

/** Get ~/.factory/ecc/skills/learned */
export function getFactoryLearnedSkillsDir(): string;

/** Get the runtime-specific ECC data root. */
export function getRuntimeDataRoot(options?: DetectRuntimeOptions): string;

/** Get the runtime-specific sessions directory. */
export function getRuntimeSessionsDir(options?: DetectRuntimeOptions): string;

/** Get the runtime-specific learned-skills directory. */
export function getRuntimeLearnedSkillsDir(options?: DetectRuntimeOptions): string;

/** Get the runtime-specific session aliases file path. */
export function getRuntimeAliasesPath(options?: DetectRuntimeOptions): string;

/** Infer runtime directly from a resolved plugin root path. */
export function inferRuntimeFromPluginRoot(pluginRoot?: string | null): EccRuntime | null;
