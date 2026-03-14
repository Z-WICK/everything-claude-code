const path = require('path');

const { getHomeDir, getProjectName } = require('./utils');

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function detectHookRuntime(input = {}) {
  const override = String(process.env.ECC_RUNTIME || '').trim().toLowerCase();

  if (override === 'factory' || override === 'droid') {
    return 'factory';
  }

  if (override === 'claude') {
    return 'claude';
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

function getFactoryDir() {
  return path.join(getHomeDir(), '.factory');
}

function getFactoryEccDir() {
  return path.join(getFactoryDir(), 'ecc');
}

function getFactorySessionSummariesDir() {
  return path.join(getFactoryEccDir(), 'sessions');
}

function getFactoryLearnedSkillsDir() {
  return path.join(getFactoryEccDir(), 'skills', 'learned');
}

function getHookSessionId(input = {}) {
  const candidates = [
    input && typeof input === 'object' ? input.session_id : null,
    input && typeof input === 'object' ? input.sessionId : null,
    process.env.CLAUDE_SESSION_ID
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function getHookSessionIdShort(input = {}, fallback = 'default') {
  const sessionId = getHookSessionId(input);
  if (sessionId) {
    return sessionId.slice(-8);
  }

  return getProjectName() || fallback;
}

function getHookTranscriptPath(input = {}) {
  const candidates = [
    input && typeof input === 'object' ? input.transcript_path : null,
    input && typeof input === 'object' ? input.transcriptPath : null,
    process.env.CLAUDE_TRANSCRIPT_PATH
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function getHookProjectDir(input = {}) {
  if (process.env.FACTORY_PROJECT_DIR && process.env.FACTORY_PROJECT_DIR.trim()) {
    return process.env.FACTORY_PROJECT_DIR.trim();
  }

  if (input && typeof input === 'object') {
    if (typeof input.cwd === 'string' && input.cwd.trim()) {
      return input.cwd.trim();
    }

    const workspaceDir = input.workspace && typeof input.workspace.current_dir === 'string'
      ? input.workspace.current_dir.trim()
      : '';

    if (workspaceDir) {
      return workspaceDir;
    }
  }

  return process.cwd();
}

module.exports = {
  detectHookRuntime,
  getFactorySessionSummariesDir,
  getFactoryLearnedSkillsDir,
  getHookSessionIdShort,
  getHookTranscriptPath,
  getHookProjectDir
};
