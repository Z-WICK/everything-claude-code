const fs = require('fs');
const path = require('path');

const AGENT_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const FACTORY_DIR = path.join(ROOT_DIR, '.factory');
const FACTORY_CONFIG_FILE = path.join(FACTORY_DIR, '_ecc', 'config.json');
const SOURCE_AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const SOURCE_COMMANDS_DIR = path.join(ROOT_DIR, 'commands');
const SOURCE_SKILLS_DIR = path.join(ROOT_DIR, 'skills');
const FACTORY_DROIDS_DIR = path.join(FACTORY_DIR, 'droids');
const FACTORY_COMMANDS_DIR = path.join(FACTORY_DIR, 'commands');
const FACTORY_SKILLS_DIR = path.join(FACTORY_DIR, 'skills');
const FACTORY_PLANS_DIR = path.join(FACTORY_DIR, 'plans');

const DEFAULT_FACTORY_CONFIG = {
  forceIncludeCommands: [],
  forceExcludeCommands: [],
  forceIncludeSkills: [],
  forceExcludeSkills: [],
  excludeCommandPatterns: [
    {
      id: 'factory-worker-binaries',
      target: 'transformed',
      pattern: '~\\/\\.factory\\/bin\\/',
      reason: 'requires harness-specific worker binaries outside the Factory sidecar scope',
    },
    {
      id: 'claude-ccg-prompts',
      target: 'transformed',
      pattern: '\\.factory\\/\\.ccg\\/',
      reason: 'depends on Claude/Gemini collaboration prompt assets that are not mirrored into Factory',
    },
    {
      id: 'session-store',
      target: 'transformed',
      pattern: '~\\/\\.factory\\/sessions\\/',
      reason: 'depends on Claude session persistence semantics',
    },
    {
      id: 'claw-store',
      target: 'transformed',
      pattern: '~\\/\\.factory\\/claw\\/',
      reason: 'depends on claw-specific session storage',
    },
    {
      id: 'homunculus-memory',
      target: 'both',
      pattern: 'homunculus',
      reason: 'depends on homunculus persistence and instinct stores',
    },
    {
      id: 'eval-store',
      target: 'transformed',
      pattern: '\\.factory\\/evals\\/',
      reason: 'depends on eval persistence conventions not yet mirrored into Factory',
    },
    {
      id: 'checkpoint-log',
      target: 'transformed',
      pattern: '\\.factory\\/checkpoints\\.log',
      reason: 'depends on checkpoint log storage not yet mirrored into Factory',
    },
    {
      id: 'package-manager-config',
      target: 'both',
      pattern: 'package-manager\\.json',
      reason: 'depends on Claude package-manager preference files',
    },
    {
      id: 'command-scaffold-output',
      target: 'transformed',
      pattern: '\\.factory\\/commands\\/',
      reason: 'writes harness-specific command scaffolds and should stay manual',
    },
    {
      id: 'script-scaffold-output',
      target: 'transformed',
      pattern: '\\.factory\\/scripts\\/',
      reason: 'writes harness-specific scripts and should stay manual',
    },
    {
      id: 'learned-skills-store',
      target: 'both',
      pattern: 'skills\\/learned\\/',
      reason: 'depends on learned-skill persistence outside the Factory sidecar scope',
    },
    {
      id: 'claude-plugin-runtime',
      target: 'both',
      pattern: 'CLAUDE_PLUGIN_ROOT',
      reason: 'depends on the Claude plugin runtime environment',
    },
    {
      id: 'untranslated-claude-project-path',
      target: 'transformed',
      pattern: '\\.claude\\/',
      reason: 'still depends on untranslated .claude project storage semantics',
    },
  ],
};

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

function listDirectoryNames(dirPath) {
  return fs.readdirSync(dirPath)
    .filter((entry) => fs.statSync(path.join(dirPath, entry)).isDirectory())
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

function splitOptionalFrontmatter(markdown) {
  const match = markdown.match(AGENT_FRONTMATTER_PATTERN);
  if (!match) {
    return { frontmatter: null, body: markdown };
  }

  return {
    frontmatter: match[1],
    body: markdown.slice(match[0].length),
  };
}

function ensureFrontmatterField(frontmatter, key, value) {
  if (!frontmatter) {
    return `${key}: ${value}`;
  }

  const pattern = new RegExp(`^${key}:`, 'm');
  if (pattern.test(frontmatter)) {
    return frontmatter;
  }

  return `${frontmatter}\n${key}: ${value}`;
}

function buildFactoryCommandFromSource(commandMarkdown) {
  const normalized = normalizeCommandMarkdown(commandMarkdown);
  const { frontmatter, body } = splitOptionalFrontmatter(normalized);
  const trimmedBody = body.trim();

  if (trimmedBody.includes('$ARGUMENTS')) {
    if (!frontmatter) {
      return `${trimmedBody}\n`;
    }

    return `---\n${frontmatter}\n---\n\n${trimmedBody}\n`;
  }

  const bridgedFrontmatter = frontmatter
    ? ensureFrontmatterField(frontmatter, 'argument-hint', '"[task description]"')
    : null;

  const bridgedBody = [
    '## User Request',
    '',
    '$ARGUMENTS',
    '',
    '## Canonical ECC Workflow',
    '',
    trimmedBody,
  ].join('\n');

  if (!bridgedFrontmatter) {
    return `${bridgedBody}\n`;
  }

  return `---\n${bridgedFrontmatter}\n---\n\n${bridgedBody}\n`;
}

function normalizeSkillMarkdown(markdown) {
  return markdown
    .replace(/`CLAUDE\.md`/g, '`AGENTS.md`')
    .replace(/~\/\.claude\//g, '~/.factory/')
    .replace(/\.claude\//g, '.factory/')
    .replace(/\r\n/g, '\n');
}

function loadFactoryConfig() {
  if (!fs.existsSync(FACTORY_CONFIG_FILE)) {
    return DEFAULT_FACTORY_CONFIG;
  }

  const userConfig = JSON.parse(readText(FACTORY_CONFIG_FILE));

  return {
    ...DEFAULT_FACTORY_CONFIG,
    ...userConfig,
    forceIncludeCommands: [
      ...DEFAULT_FACTORY_CONFIG.forceIncludeCommands,
      ...(userConfig.forceIncludeCommands || []),
    ],
    forceExcludeCommands: [
      ...DEFAULT_FACTORY_CONFIG.forceExcludeCommands,
      ...(userConfig.forceExcludeCommands || []),
    ],
    forceIncludeSkills: [
      ...DEFAULT_FACTORY_CONFIG.forceIncludeSkills,
      ...(userConfig.forceIncludeSkills || []),
    ],
    forceExcludeSkills: [
      ...DEFAULT_FACTORY_CONFIG.forceExcludeSkills,
      ...(userConfig.forceExcludeSkills || []),
    ],
    excludeCommandPatterns: [
      ...DEFAULT_FACTORY_CONFIG.excludeCommandPatterns,
      ...(userConfig.excludeCommandPatterns || []),
    ],
  };
}

function compilePatternEntry(entry) {
  return {
    ...entry,
    regex: new RegExp(entry.pattern, entry.flags || 'm'),
  };
}

function detectExcludedCommandReasons(fileName, sourceMarkdown, transformedMarkdown, config) {
  const forceInclude = new Set(config.forceIncludeCommands || []);
  const forceExclude = new Set(config.forceExcludeCommands || []);

  if (forceExclude.has(fileName)) {
    return ['force-excluded by Factory sidecar config'];
  }

  if (forceInclude.has(fileName)) {
    return [];
  }

  const reasons = [];
  for (const entry of (config.excludeCommandPatterns || []).map(compilePatternEntry)) {
    const haystacks = [];
    if (!entry.target || entry.target === 'both' || entry.target === 'source') {
      haystacks.push(sourceMarkdown);
    }
    if (entry.target === 'both' || entry.target === 'transformed') {
      haystacks.push(transformedMarkdown);
    }

    if (haystacks.some((value) => entry.regex.test(value))) {
      reasons.push(entry.reason || entry.id || entry.pattern);
    }
  }

  return reasons;
}

function discoverManagedCommands(config = loadFactoryConfig()) {
  const discovered = [];
  const excluded = [];

  for (const fileName of listMarkdownBasenames(SOURCE_COMMANDS_DIR)) {
    const sourceMarkdown = readText(getCommandSourcePath(fileName));
    const transformedMarkdown = buildFactoryCommandFromSource(sourceMarkdown);
    const reasons = detectExcludedCommandReasons(fileName, sourceMarkdown, transformedMarkdown, config);

    if (reasons.length) {
      excluded.push({ fileName, reasons });
      continue;
    }

    discovered.push(fileName);
  }

  return {
    includedFiles: discovered.sort(),
    excludedCommands: excluded.sort((left, right) => left.fileName.localeCompare(right.fileName)),
  };
}

function extractSkillReferences(markdown, availableSkills) {
  const discovered = new Set();
  const patterns = [
    /skills\/([a-z0-9-]+)\//gi,
    /skill:\s*`?([a-z0-9-]+)`?/gi,
  ];

  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      const candidate = match[1];
      if (availableSkills.has(candidate)) {
        discovered.add(candidate);
      }
    }
  }

  return discovered;
}

function discoverManagedSkills(commandFiles, config = loadFactoryConfig()) {
  const availableSkills = new Set(listDirectoryNames(SOURCE_SKILLS_DIR));
  const discovered = new Set(config.forceIncludeSkills || []);

  for (const fileName of listMarkdownBasenames(SOURCE_AGENTS_DIR)) {
    const markdown = readText(getAgentSourcePath(fileName));
    for (const skill of extractSkillReferences(markdown, availableSkills)) {
      discovered.add(skill);
    }
  }

  for (const fileName of commandFiles) {
    const markdown = readText(getCommandSourcePath(fileName));
    for (const skill of extractSkillReferences(markdown, availableSkills)) {
      discovered.add(skill);
    }
  }

  for (const skillDir of config.forceExcludeSkills || []) {
    discovered.delete(skillDir);
  }

  return [...discovered]
    .filter((skillDir) => availableSkills.has(skillDir))
    .sort();
}

function discoverFactoryState(config = loadFactoryConfig()) {
  const commandState = discoverManagedCommands(config);
  const skillDirs = discoverManagedSkills(commandState.includedFiles, config);

  return {
    config,
    commandFiles: commandState.includedFiles,
    excludedCommands: commandState.excludedCommands,
    skillDirs,
    agentFiles: listMarkdownBasenames(SOURCE_AGENTS_DIR),
  };
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
  FACTORY_CONFIG_FILE,
  FACTORY_DIR,
  FACTORY_DROIDS_DIR,
  FACTORY_PLANS_DIR,
  FACTORY_SKILLS_DIR,
  ROOT_DIR,
  SOURCE_AGENTS_DIR,
  buildDroidContentFromAgent,
  buildFactoryCommandFromSource,
  detectExcludedCommandReasons,
  discoverFactoryState,
  discoverManagedCommands,
  discoverManagedSkills,
  extractSkillReferences,
  getAgentSourcePath,
  getCommandSourcePath,
  getCommandTargetPath,
  getDroidTargetPath,
  getManagedSkillSourcePath,
  getManagedSkillTargetPath,
  listDirectoryNames,
  listMarkdownBasenames,
  loadFactoryConfig,
  normalizeCommandMarkdown,
  normalizeSkillMarkdown,
  readText,
  writeText,
};
