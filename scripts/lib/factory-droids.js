const fs = require('fs');
const path = require('path');

const AGENT_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

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

function listMarkdownBasenames(dirPath) {
  return fs.readdirSync(dirPath)
    .filter((entry) => entry.endsWith('.md'))
    .sort();
}

function readMarkdownFile(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function getAgentAndDroidPaths(rootDir, fileName) {
  return {
    agentPath: path.join(rootDir, 'agents', fileName),
    droidPath: path.join(rootDir, 'droids', fileName),
  };
}

module.exports = {
  buildDroidContentFromAgent,
  getAgentAndDroidPaths,
  listMarkdownBasenames,
  readMarkdownFile,
};
