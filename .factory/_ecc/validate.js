#!/usr/bin/env node
/**
 * Validate that the Factory sidecar is in sync with ECC shared assets.
 */

const fs = require('fs');
const path = require('path');

const {
  FACTORY_COMMANDS_DIR,
  FACTORY_DROIDS_DIR,
  FACTORY_PLANS_DIR,
  FACTORY_SKILLS_DIR,
  buildDroidContentFromAgent,
  buildFactoryCommandFromSource,
  discoverFactoryState,
  getAgentSourcePath,
  getCommandSourcePath,
  getCommandTargetPath,
  getDroidTargetPath,
  getManagedSkillSourcePath,
  getManagedSkillTargetPath,
  listMarkdownBasenames,
  normalizeSkillMarkdown,
  readText,
} = require('./lib/factory-sidecar');

let hasErrors = false;

function fail(message) {
  hasErrors = true;
  console.error(`ERROR: ${message}`);
}

function validateDroids(agentFiles) {
  if (!fs.existsSync(FACTORY_DROIDS_DIR)) {
    fail('Missing .factory/droids directory');
    return;
  }

  for (const fileName of agentFiles) {
    const targetPath = getDroidTargetPath(fileName);
    if (!fs.existsSync(targetPath)) {
      fail(`Missing Factory droid for agent: ${fileName}`);
      continue;
    }

    const expected = buildDroidContentFromAgent(readText(getAgentSourcePath(fileName)), `agents/${fileName}`);
    const actual = readText(targetPath);

    if (actual !== expected) {
      fail(`.factory/droids/${fileName} is out of sync with agents/${fileName}`);
    }

    if (!actual.includes('model: inherit')) {
      fail(`.factory/droids/${fileName} must inherit the parent model`);
    }

    if (actual.includes('tools:')) {
      fail(`.factory/droids/${fileName} should not pin Claude-only tool names`);
    }
  }
  const actualFiles = listMarkdownBasenames(FACTORY_DROIDS_DIR);
  if (JSON.stringify(actualFiles) !== JSON.stringify([...agentFiles].sort())) {
    fail('.factory/droids does not match the mirrored agent set');
  }
}

function validateCommands(commandFiles) {
  if (!fs.existsSync(FACTORY_COMMANDS_DIR)) {
    fail('Missing .factory/commands directory');
    return;
  }

  const actualFiles = listMarkdownBasenames(FACTORY_COMMANDS_DIR);
  if (JSON.stringify(actualFiles) !== JSON.stringify([...commandFiles].sort())) {
    fail('.factory/commands does not match the managed command set');
  }

  for (const fileName of commandFiles) {
    const targetPath = getCommandTargetPath(fileName);
    if (!fs.existsSync(targetPath)) {
      fail(`Missing Factory command: ${fileName}`);
      continue;
    }

    const expected = buildFactoryCommandFromSource(readText(getCommandSourcePath(fileName)));
    const actual = readText(targetPath);

    if (actual !== expected) {
      fail(`.factory/commands/${fileName} is out of sync with commands/${fileName}`);
    }

    if (actual.includes('~/.claude/') || actual.includes('.claude/')) {
      fail(`.factory/commands/${fileName} still contains Claude-only storage paths`);
    }

    if (!actual.includes('$ARGUMENTS')) {
      fail(`.factory/commands/${fileName} must expose $ARGUMENTS to preserve slash-command input`);
    }
  }
}

function validateSkills(skillDirs) {
  if (!fs.existsSync(FACTORY_SKILLS_DIR)) {
    fail('Missing .factory/skills directory');
    return;
  }

  const actualDirs = fs.readdirSync(FACTORY_SKILLS_DIR).sort();
  if (JSON.stringify(actualDirs) !== JSON.stringify([...skillDirs].sort())) {
    fail('.factory/skills does not match the managed skill set');
  }

  for (const skillDir of skillDirs) {
    const targetPath = getManagedSkillTargetPath(skillDir);
    if (!fs.existsSync(targetPath)) {
      fail(`Missing Factory skill mirror: ${skillDir}/SKILL.md`);
      continue;
    }

    const expected = normalizeSkillMarkdown(readText(getManagedSkillSourcePath(skillDir)));
    const actual = readText(targetPath);

    if (actual !== expected) {
      fail(`.factory/skills/${skillDir}/SKILL.md is out of sync with skills/${skillDir}/SKILL.md`);
    }
  }
}

function validatePlansDir() {
  if (!fs.existsSync(FACTORY_PLANS_DIR)) {
    fail('Missing .factory/plans directory');
    return;
  }

  const gitkeepPath = path.join(FACTORY_PLANS_DIR, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fail('Missing .factory/plans/.gitkeep');
  }
}

function main() {
  const state = discoverFactoryState();
  validateDroids(state.agentFiles);
  validateCommands(state.commandFiles);
  validateSkills(state.skillDirs);
  validatePlansDir();

  if (hasErrors) {
    process.exit(1);
  }

  console.log('Validated Factory sidecar droids, commands, skills, and plans directory');
}

main();
