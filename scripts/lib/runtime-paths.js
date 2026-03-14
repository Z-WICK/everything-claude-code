const path = require('path');

const { getHomeDir } = require('./utils');

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function normalizePluginRoot(pluginRoot) {
  return typeof pluginRoot === 'string' && pluginRoot.trim()
    ? pluginRoot.trim().replace(/\\/g, '/')
    : '';
}

function inferRuntimeFromPluginRoot(pluginRoot) {
  const normalized = normalizePluginRoot(pluginRoot);

  if (!normalized) return null;
  if (normalized.includes('/.factory/plugins/')) return 'factory';
  if (normalized.includes('/.claude/plugins/')) return 'claude';

  return null;
}

function detectRuntime(options = {}) {
  const { input = null, pluginRoot = null } = options;
  const override = String(process.env.ECC_RUNTIME || '').trim().toLowerCase();

  if (override === 'factory' || override === 'droid') {
    return 'factory';
  }

  if (override === 'claude') {
    return 'claude';
  }

  const runtimeFromPluginRoot = inferRuntimeFromPluginRoot(pluginRoot)
    || inferRuntimeFromPluginRoot(process.env.DROID_PLUGIN_ROOT)
    || inferRuntimeFromPluginRoot(process.env.FACTORY_PLUGIN_ROOT)
    || inferRuntimeFromPluginRoot(process.env.CLAUDE_PLUGIN_ROOT);

  if (runtimeFromPluginRoot) {
    return runtimeFromPluginRoot;
  }

  if (process.env.FACTORY_PROJECT_DIR || process.env.DROID_PLUGIN_ROOT || process.env.FACTORY_PLUGIN_ROOT) {
    return 'factory';
  }

  if (process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_TRANSCRIPT_PATH) {
    return 'claude';
  }

  if (hasOwn(input, 'hookEventName') || hasOwn(input, 'session_id') || hasOwn(input, 'sessionId')) {
    return 'factory';
  }

  return 'claude';
}

function getClaudeDir() {
  return path.join(getHomeDir(), '.claude');
}

function getFactoryDir() {
  return path.join(getHomeDir(), '.factory');
}

function getFactoryEccDir() {
  return path.join(getFactoryDir(), 'ecc');
}

function getRuntimeDataRoot(options = {}) {
  return detectRuntime(options) === 'factory'
    ? getFactoryEccDir()
    : getClaudeDir();
}

function getRuntimeSessionsDir(options = {}) {
  return path.join(getRuntimeDataRoot(options), 'sessions');
}

function getRuntimeLearnedSkillsDir(options = {}) {
  return detectRuntime(options) === 'factory'
    ? path.join(getFactoryEccDir(), 'skills', 'learned')
    : path.join(getClaudeDir(), 'skills', 'learned');
}

function getRuntimeAliasesPath(options = {}) {
  return path.join(getRuntimeDataRoot(options), 'session-aliases.json');
}

function getFactorySessionSummariesDir() {
  return path.join(getFactoryEccDir(), 'sessions');
}

function getFactoryLearnedSkillsDir() {
  return path.join(getFactoryEccDir(), 'skills', 'learned');
}

module.exports = {
  detectRuntime,
  getClaudeDir,
  getFactoryDir,
  getFactoryEccDir,
  getFactorySessionSummariesDir,
  getFactoryLearnedSkillsDir,
  getRuntimeDataRoot,
  getRuntimeSessionsDir,
  getRuntimeLearnedSkillsDir,
  getRuntimeAliasesPath,
  inferRuntimeFromPluginRoot
};
