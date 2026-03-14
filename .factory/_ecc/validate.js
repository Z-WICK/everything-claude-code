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
  MANAGED_COMMAND_FILES,
  MANAGED_SKILL_DIRS,
  SOURCE_AGENTS_DIR,
  buildDroidContentFromAgent,
  buildFactoryCommandFromSource,
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

function validateDroids() {
  if (!fs.existsSync(FACTORY_DROIDS_DIR)) {
    fail('Missing .factory/droids directory');
    return;
  }

  for (const fileName of listMarkdownBasenames(SOURCE_AGENTS_DIR)) {
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
}

function validateCommands() {
  if (!fs.existsSync(FACTORY_COMMANDS_DIR)) {
    fail('Missing .factory/commands directory');
    return;
  }

  const actualFiles = listMarkdownBasenames(FACTORY_COMMANDS_DIR);
  if (JSON.stringify(actualFiles) !== JSON.stringify([...MANAGED_COMMAND_FILES].sort())) {
    fail('.factory/commands does not match the managed command set');
  }

  for (const fileName of MANAGED_COMMAND_FILES) {
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

function validateSkills() {
  if (!fs.existsSync(FACTORY_SKILLS_DIR)) {
    fail('Missing .factory/skills directory');
    return;
  }

  const actualDirs = fs.readdirSync(FACTORY_SKILLS_DIR).sort();
  if (JSON.stringify(actualDirs) !== JSON.stringify([...MANAGED_SKILL_DIRS].sort())) {
    fail('.factory/skills does not match the managed skill set');
  }

  for (const skillDir of MANAGED_SKILL_DIRS) {
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
  validateDroids();
  validateCommands();
  validateSkills();
  validatePlansDir();

  if (hasErrors) {
    process.exit(1);
  }

  console.log('Validated Factory sidecar droids, commands, skills, and plans directory');
}

main();
