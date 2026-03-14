#!/usr/bin/env node
/**
 * Sync Factory/Droid custom droids from the canonical Claude agent prompts.
 */

const fs = require('fs');
const path = require('path');

const {
  buildDroidContentFromAgent,
  getAgentAndDroidPaths,
  listMarkdownBasenames,
  readMarkdownFile,
} = require('../lib/factory-droids');

const ROOT_DIR = path.join(__dirname, '../..');
const AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const DROIDS_DIR = path.join(ROOT_DIR, 'droids');

function syncFactoryDroids() {
  fs.mkdirSync(DROIDS_DIR, { recursive: true });

  const agentFiles = listMarkdownBasenames(AGENTS_DIR);
  const droidFiles = new Set(listMarkdownBasenames(DROIDS_DIR));

  for (const fileName of agentFiles) {
    const { agentPath, droidPath } = getAgentAndDroidPaths(ROOT_DIR, fileName);
    const droidContent = buildDroidContentFromAgent(readMarkdownFile(agentPath), `agents/${fileName}`);
    fs.writeFileSync(droidPath, droidContent);
    droidFiles.delete(fileName);
  }

  for (const staleFile of droidFiles) {
    fs.rmSync(path.join(DROIDS_DIR, staleFile), { force: true });
  }

  console.log(`Synced ${agentFiles.length} Factory droids from agents/`);
}

syncFactoryDroids();
