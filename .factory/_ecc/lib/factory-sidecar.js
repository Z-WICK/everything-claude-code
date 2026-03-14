const fs = require('fs');
const path = require('path');

const AGENT_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const FACTORY_DIR = path.join(ROOT_DIR, '.factory');
const SOURCE_AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const SOURCE_COMMANDS_DIR = path.join(ROOT_DIR, 'commands');
const SOURCE_SKILLS_DIR = path.join(ROOT_DIR, 'skills');
const FACTORY_DROIDS_DIR = path.join(FACTORY_DIR, 'droids');
const FACTORY_COMMANDS_DIR = path.join(FACTORY_DIR, 'commands');
const FACTORY_SKILLS_DIR = path.join(FACTORY_DIR, 'skills');
const FACTORY_PLANS_DIR = path.join(FACTORY_DIR, 'plans');

const MANAGED_COMMAND_FILES = [
  'plan.md',
  'tdd.md',
  'code-review.md',
  'verify.md',
  'orchestrate.md',
];

const MANAGED_SKILL_DIRS = [
  'e2e-testing',
  'golang-patterns',
  'kotlin-patterns',
  'python-patterns',
  'security-review',
  'tdd-workflow',
];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function listMarkdownBasenames(dirPath) {
  return fs.readdirSync(dirPath)
    .filter((entry) => entry.endsWith('.md'))
    .sort();
}

function splitFrontmatter(markdown, label) {
  const match = markdown.match(AGENT_FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error(`${label} is missing YAML frontmatter`);
  }

  return {
    frontmatter: match[1],
    body: markdown.slice(match[0].length),
  };
}

function parseFrontmatterValue(frontmatter, key, label) {
  const pattern = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(pattern);
  if (!match) {
    throw new Error(`${label} is missing required frontmatter field: ${key}`);
  }

  const rawValue = match[1].trim();
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"'))
    || (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function normalizeAgentBodyForDroid(body) {
  return body
    .replace(/`CLAUDE\.md`/g, '`AGENTS.md`')
    .replace(/\.claude\/rules\/\*\.md/g, 'rules/*.md')
    .replace(/\r\n/g, '\n')
    .trim()
    .concat('\n');
}

function buildDroidContentFromAgent(agentMarkdown, label = 'agent') {
  const { frontmatter, body } = splitFrontmatter(agentMarkdown, label);
  const name = parseFrontmatterValue(frontmatter, 'name', label);
  const description = parseFrontmatterValue(frontmatter, 'description', label);

  const droidFrontmatter = [
    '---',
    `name: ${JSON.stringify(name)}`,
    `description: ${JSON.stringify(description)}`,
    'model: inherit',
    '---',
    '',
  ].join('\n');

  return droidFrontmatter + normalizeAgentBodyForDroid(body);
}

function normalizeCommandMarkdown(markdown) {
  return markdown
    .replace(/\.claude\/plan\//g, '.factory/plans/')
    .replace(/\.claude\/plans\//g, '.factory/plans/')
    .replace(/`CLAUDE\.md`/g, '`AGENTS.md`')
    .replace(/~\/\.claude\//g, '~/.factory/')
    .replace(/\r\n/g, '\n');
}

function normalizeSkillMarkdown(markdown) {
  return markdown
    .replace(/`CLAUDE\.md`/g, '`AGENTS.md`')
    .replace(/~\/\.claude\//g, '~/.factory/')
    .replace(/\.claude\//g, '.factory/')
    .replace(/\r\n/g, '\n');
}

function getManagedSkillSourcePath(skillDir) {
  return path.join(SOURCE_SKILLS_DIR, skillDir, 'SKILL.md');
}

function getManagedSkillTargetPath(skillDir) {
  return path.join(FACTORY_SKILLS_DIR, skillDir, 'SKILL.md');
}

function getCommandSourcePath(fileName) {
  return path.join(SOURCE_COMMANDS_DIR, fileName);
}

function getCommandTargetPath(fileName) {
  return path.join(FACTORY_COMMANDS_DIR, fileName);
}

function getAgentSourcePath(fileName) {
  return path.join(SOURCE_AGENTS_DIR, fileName);
}

function getDroidTargetPath(fileName) {
  return path.join(FACTORY_DROIDS_DIR, fileName);
}

module.exports = {
  FACTORY_COMMANDS_DIR,
  FACTORY_DIR,
  FACTORY_DROIDS_DIR,
  FACTORY_PLANS_DIR,
  FACTORY_SKILLS_DIR,
  MANAGED_COMMAND_FILES,
  MANAGED_SKILL_DIRS,
  ROOT_DIR,
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
};
