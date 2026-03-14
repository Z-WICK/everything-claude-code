#!/usr/bin/env node
/**
 * Sync the Factory sidecar from the shared ECC source-of-truth directories.
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
  getAgentSourcePath,
  getCommandSourcePath,
  getCommandTargetPath,
  getDroidTargetPath,
  getManagedSkillSourcePath,
  getManagedSkillTargetPath,
  listMarkdownBasenames,
  normalizeCommandMarkdown,
  normalizeSkillMarkdown,
  readText,
  writeText,
} = require('./lib/factory-sidecar');

function syncDroids() {
  fs.mkdirSync(FACTORY_DROIDS_DIR, { recursive: true });
  const agentFiles = listMarkdownBasenames(SOURCE_AGENTS_DIR);
  const generated = new Set(agentFiles);

  for (const fileName of agentFiles) {
    const source = readText(getAgentSourcePath(fileName));
    const targetPath = getDroidTargetPath(fileName);
    writeText(targetPath, buildDroidContentFromAgent(source, `agents/${fileName}`));
  }

  for (const fileName of listMarkdownBasenames(FACTORY_DROIDS_DIR)) {
    if (!generated.has(fileName)) {
      fs.rmSync(path.join(FACTORY_DROIDS_DIR, fileName), { force: true });
    }
  }

  return agentFiles.length;
}

function syncCommands() {
  fs.mkdirSync(FACTORY_COMMANDS_DIR, { recursive: true });

  for (const fileName of MANAGED_COMMAND_FILES) {
    const source = readText(getCommandSourcePath(fileName));
    writeText(getCommandTargetPath(fileName), normalizeCommandMarkdown(source));
  }

  return MANAGED_COMMAND_FILES.length;
}

function syncSkills() {
  fs.mkdirSync(FACTORY_SKILLS_DIR, { recursive: true });

  for (const skillDir of MANAGED_SKILL_DIRS) {
    const source = readText(getManagedSkillSourcePath(skillDir));
    writeText(getManagedSkillTargetPath(skillDir), normalizeSkillMarkdown(source));
  }

  return MANAGED_SKILL_DIRS.length;
}

function ensurePlansDir() {
  fs.mkdirSync(FACTORY_PLANS_DIR, { recursive: true });
  const gitkeepPath = path.join(FACTORY_PLANS_DIR, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    writeText(gitkeepPath, '');
  }
}

function main() {
  const droidCount = syncDroids();
  const commandCount = syncCommands();
  const skillCount = syncSkills();
  ensurePlansDir();

  console.log(`Synced Factory sidecar: ${droidCount} droids, ${commandCount} commands, ${skillCount} skills`);
}

main();
