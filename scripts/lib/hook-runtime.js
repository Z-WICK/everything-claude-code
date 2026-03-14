const {
  detectRuntime,
  getFactorySessionSummariesDir,
  getFactoryLearnedSkillsDir
} = require('./runtime-paths');
const { getProjectName } = require('./utils');

function detectHookRuntime(input = {}) {
  return detectRuntime({ input });
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
