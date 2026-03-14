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
  writeText,
} = require('./lib/factory-sidecar');

function syncDroids(agentFiles) {
  fs.mkdirSync(FACTORY_DROIDS_DIR, { recursive: true });
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

function syncCommands(commandFiles) {
  fs.mkdirSync(FACTORY_COMMANDS_DIR, { recursive: true });
  const generated = new Set(commandFiles);

  for (const fileName of commandFiles) {
    const source = readText(getCommandSourcePath(fileName));
    writeText(getCommandTargetPath(fileName), buildFactoryCommandFromSource(source));
  }

  for (const fileName of listMarkdownBasenames(FACTORY_COMMANDS_DIR)) {
    if (!generated.has(fileName)) {
      fs.rmSync(path.join(FACTORY_COMMANDS_DIR, fileName), { force: true });
    }
  }

  return commandFiles.length;
}

function syncSkills(skillDirs) {
  fs.mkdirSync(FACTORY_SKILLS_DIR, { recursive: true });
  const generated = new Set(skillDirs);

  for (const skillDir of skillDirs) {
    const source = readText(getManagedSkillSourcePath(skillDir));
    writeText(getManagedSkillTargetPath(skillDir), normalizeSkillMarkdown(source));
  }

  for (const entry of fs.readdirSync(FACTORY_SKILLS_DIR)) {
    if (!generated.has(entry)) {
      fs.rmSync(path.join(FACTORY_SKILLS_DIR, entry), { recursive: true, force: true });
    }
  }

  return skillDirs.length;
}

function ensurePlansDir() {
  fs.mkdirSync(FACTORY_PLANS_DIR, { recursive: true });
  const gitkeepPath = path.join(FACTORY_PLANS_DIR, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    writeText(gitkeepPath, '');
  }
}

function main() {
  const state = discoverFactoryState();
  const droidCount = syncDroids(state.agentFiles);
  const commandCount = syncCommands(state.commandFiles);
  const skillCount = syncSkills(state.skillDirs);
  ensurePlansDir();

  console.log(`Synced Factory sidecar: ${droidCount} droids, ${commandCount} commands, ${skillCount} skills`);

  if (state.excludedCommands.length) {
    console.log(`Skipped ${state.excludedCommands.length} Factory-incompatible commands:`);
    for (const entry of state.excludedCommands) {
      console.log(`- ${entry.fileName}: ${entry.reasons[0]}`);
    }
  }
}

main();
