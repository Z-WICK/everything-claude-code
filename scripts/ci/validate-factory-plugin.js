#!/usr/bin/env node
/**
 * Validate Factory/Droid plugin metadata and mirrored droid prompts.
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
const MANIFEST_FILE = path.join(ROOT_DIR, '.factory-plugin', 'plugin.json');
const FACTORY_PLUGIN_DIR = path.join(ROOT_DIR, '.factory-plugin');
const AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const DROIDS_DIR = path.join(ROOT_DIR, 'droids');
const REQUIRED_PACKAGE_FILES = ['.factory-plugin/', 'droids/'];
const DISALLOWED_BRIDGE_FIELDS = ['instructions', 'droids'];
const CORE_FACTORY_COMMANDS = ['plan.md', 'tdd.md', 'code-review.md', 'verify.md', 'orchestrate.md'];

function fail(message) {
  console.error(`ERROR: ${message}`);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON in ${label}: ${error.message}`);
    process.exit(1);
  }
}

function validatePackageFiles() {
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  const packageJson = readJson(packageJsonPath, 'package.json');
  const files = Array.isArray(packageJson.files) ? packageJson.files : [];
  let hasErrors = false;

  for (const entry of REQUIRED_PACKAGE_FILES) {
    if (!files.includes(entry)) {
      fail(`package.json files is missing required entry: ${entry}`);
      hasErrors = true;
    }
  }

  return { hasErrors, packageJson };
}

function validateManifest(packageJson) {
  if (!fs.existsSync(MANIFEST_FILE)) {
    fail('Missing .factory-plugin/plugin.json');
    process.exit(1);
  }

  const manifest = readJson(MANIFEST_FILE, '.factory-plugin/plugin.json');
  let hasErrors = false;

  for (const field of ['name', 'version', 'description']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
      fail(`Missing required metadata field: ${field}`);
      hasErrors = true;
    }
  }

  if (manifest.version && packageJson.version && manifest.version !== packageJson.version) {
    fail(`Factory plugin version must match package.json version (${packageJson.version})`);
    hasErrors = true;
  }

  for (const field of DISALLOWED_BRIDGE_FIELDS) {
    if (field in manifest) {
      fail(`Unsupported Factory bridge field found in manifest: ${field}`);
      hasErrors = true;
    }
  }

  if (!fs.existsSync(FACTORY_PLUGIN_DIR)) {
    fail('Missing .factory-plugin directory');
    hasErrors = true;
  } else {
    const entries = fs.readdirSync(FACTORY_PLUGIN_DIR).sort();
    if (entries.length !== 1 || entries[0] !== 'plugin.json') {
      fail('.factory-plugin/ should only contain plugin.json');
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateMirroredDroids() {
  if (!fs.existsSync(AGENTS_DIR)) {
    fail('Missing agents/ directory');
    process.exit(1);
  }

  if (!fs.existsSync(DROIDS_DIR)) {
    fail('Missing droids/ directory');
    process.exit(1);
  }

  const agentFiles = listMarkdownBasenames(AGENTS_DIR);
  const droidFiles = listMarkdownBasenames(DROIDS_DIR);
  let hasErrors = false;

  if (agentFiles.length !== droidFiles.length) {
    fail(`droids/ must mirror agents/ one-to-one (${agentFiles.length} agents vs ${droidFiles.length} droids)`);
    hasErrors = true;
  }

  for (const fileName of agentFiles) {
    const { agentPath, droidPath } = getAgentAndDroidPaths(ROOT_DIR, fileName);
    if (!fs.existsSync(droidPath)) {
      fail(`Missing mirrored droid for agent: ${fileName}`);
      hasErrors = true;
      continue;
    }

    const expected = buildDroidContentFromAgent(readMarkdownFile(agentPath), `agents/${fileName}`);
    const actual = readMarkdownFile(droidPath);
    if (actual !== expected) {
      fail(`droids/${fileName} is out of sync with agents/${fileName}. Run npm run sync:factory-droids`);
      hasErrors = true;
    }
  }

  for (const fileName of droidFiles) {
    if (!agentFiles.includes(fileName)) {
      fail(`Unexpected droid without matching agent: droids/${fileName}`);
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateCoreCommands() {
  let hasErrors = false;

  for (const fileName of CORE_FACTORY_COMMANDS) {
    const commandPath = path.join(ROOT_DIR, 'commands', fileName);
    if (!fs.existsSync(commandPath)) {
      fail(`Missing core Factory command: commands/${fileName}`);
      hasErrors = true;
      continue;
    }

    const command = readMarkdownFile(commandPath);
    if (command.includes('~/.claude/') || command.includes('.claude/')) {
      fail(`Core Factory command still references Claude-specific storage: commands/${fileName}`);
      hasErrors = true;
    }
  }

  return hasErrors;
}

function validateFactoryPlugin() {
  const { hasErrors: packageErrors, packageJson } = validatePackageFiles();
  const manifestErrors = validateManifest(packageJson);
  const droidErrors = validateMirroredDroids();
  const commandErrors = validateCoreCommands();

  if (packageErrors || manifestErrors || droidErrors || commandErrors) {
    process.exit(1);
  }

  console.log('Validated Factory plugin metadata, mirrored droids, and core shared commands');
}

validateFactoryPlugin();
