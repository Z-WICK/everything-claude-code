/**
 * Integration smoke tests for the Factory/Droid plugin surface.
 *
 * Run with: node tests/integration/factory-plugin.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  buildDroidContentFromAgent,
  getAgentAndDroidPaths,
  listMarkdownBasenames,
  readMarkdownFile,
} = require('../../scripts/lib/factory-droids');

const ROOT_DIR = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT_DIR, '.factory-plugin', 'plugin.json');
const FACTORY_PLUGIN_DIR = path.join(ROOT_DIR, '.factory-plugin');
const AGENTS_DIR = path.join(ROOT_DIR, 'agents');
const DROIDS_DIR = path.join(ROOT_DIR, 'droids');
const CORE_FACTORY_COMMANDS = ['plan.md', 'tdd.md', 'code-review.md', 'verify.md', 'orchestrate.md'];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

function runValidator(rootDir) {
  const validatorPath = path.join(rootDir, 'scripts', 'ci', 'validate-factory-plugin.js');
  try {
    const stdout = execFileSync('node', [validatorPath], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      code: error.status || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
    };
  }
}

function makeFixture() {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-plugin-fixture-'));
  fs.mkdirSync(path.join(fixtureDir, '.factory-plugin'), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, 'droids'), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, 'commands'), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, 'scripts', 'ci'), { recursive: true });
  fs.mkdirSync(path.join(fixtureDir, 'scripts', 'lib'), { recursive: true });

  fs.writeFileSync(
    path.join(fixtureDir, 'scripts', 'ci', 'validate-factory-plugin.js'),
    fs.readFileSync(path.join(ROOT_DIR, 'scripts', 'ci', 'validate-factory-plugin.js'), 'utf8')
  );
  fs.writeFileSync(
    path.join(fixtureDir, 'scripts', 'lib', 'factory-droids.js'),
    fs.readFileSync(path.join(ROOT_DIR, 'scripts', 'lib', 'factory-droids.js'), 'utf8')
  );

  fs.writeFileSync(
    path.join(fixtureDir, 'package.json'),
    JSON.stringify({ version: '1.0.0', files: ['.factory-plugin/', 'droids/'] }, null, 2)
  );

  const minimalAgent = [
    '---',
    'name: planner',
    'description: Example planner agent',
    'tools: ["Read", "Write"]',
    'model: sonnet',
    '---',
    '',
    'Use `CLAUDE.md` and `.claude/rules/*.md` when needed.',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(fixtureDir, 'agents', 'planner.md'), minimalAgent);
  fs.writeFileSync(
    path.join(fixtureDir, 'droids', 'planner.md'),
    buildDroidContentFromAgent(minimalAgent, 'agents/planner.md')
  );

  for (const commandName of CORE_FACTORY_COMMANDS) {
    fs.writeFileSync(path.join(fixtureDir, 'commands', commandName), '# Shared command\n');
  }

  fs.writeFileSync(
    path.join(fixtureDir, '.factory-plugin', 'plugin.json'),
    JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      description: 'Fixture Factory plugin',
    }, null, 2)
  );

  return fixtureDir;
}

function cleanupFixture(fixtureDir) {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

function runTests() {
  console.log('\n=== Testing Factory Plugin Surface ===\n');

  let passed = 0;
  let failed = 0;

  if (test('loads native Factory metadata without bridge-only fields', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    assert.strictEqual(typeof manifest.name, 'string');
    assert.strictEqual(typeof manifest.version, 'string');
    assert.strictEqual(typeof manifest.description, 'string');
    assert.ok(!('instructions' in manifest), 'Factory manifest should not use instructions bridge field');
    assert.ok(!('droids' in manifest), 'Factory manifest should not use droids bridge field');

    const factoryEntries = fs.readdirSync(FACTORY_PLUGIN_DIR).sort();
    assert.deepStrictEqual(factoryEntries, ['plugin.json']);
  })) passed++; else failed++;

  if (test('mirrors every agent into a Factory-safe droid prompt', () => {
    const agentFiles = listMarkdownBasenames(AGENTS_DIR);
    const droidFiles = listMarkdownBasenames(DROIDS_DIR);
    assert.deepStrictEqual(droidFiles, agentFiles);

    for (const fileName of agentFiles) {
      const { agentPath, droidPath } = getAgentAndDroidPaths(ROOT_DIR, fileName);
      const expected = buildDroidContentFromAgent(readMarkdownFile(agentPath), `agents/${fileName}`);
      const actual = readMarkdownFile(droidPath);

      assert.strictEqual(actual, expected, `droids/${fileName} drifted from agents/${fileName}`);
      assert.ok(actual.includes('model: inherit'), `droids/${fileName} must inherit the parent model`);
      assert.ok(!actual.includes('tools:'), `droids/${fileName} should not pin Claude-only tool names`);
      assert.ok(!actual.includes('`CLAUDE.md`'), `droids/${fileName} should be AGENTS.md-aware`);
      assert.ok(!actual.includes('.claude/rules/*.md'), `droids/${fileName} should avoid Claude-only rule paths`);
    }
  })) passed++; else failed++;

  if (test('keeps core shared commands free of Claude-specific storage paths', () => {
    for (const commandName of CORE_FACTORY_COMMANDS) {
      const commandPath = path.join(ROOT_DIR, 'commands', commandName);
      const command = fs.readFileSync(commandPath, 'utf8');
      assert.ok(!command.includes('~/.claude/'), `${commandName} should not reference ~/.claude/`);
      assert.ok(!command.includes('.claude/'), `${commandName} should not reference .claude/`);
    }
  })) passed++; else failed++;

  if (test('fails when a mirrored droid is missing', () => {
    const fixtureDir = makeFixture();
    fs.rmSync(path.join(fixtureDir, 'droids', 'planner.md'));

    const result = runValidator(fixtureDir);
    assert.strictEqual(result.code, 1, 'Validator should fail when a mirrored droid is missing');
    assert.ok(result.stderr.includes('Missing mirrored droid for agent: planner.md'));

    cleanupFixture(fixtureDir);
  })) passed++; else failed++;

  if (test('fails when the manifest reintroduces unsupported bridge fields', () => {
    const fixtureDir = makeFixture();
    const manifestPath = path.join(fixtureDir, '.factory-plugin', 'plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.instructions = './.factory-plugin/AGENTS.md';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const result = runValidator(fixtureDir);
    assert.strictEqual(result.code, 1, 'Validator should fail when unsupported bridge fields are present');
    assert.ok(result.stderr.includes('Unsupported Factory bridge field found in manifest: instructions'));

    cleanupFixture(fixtureDir);
  })) passed++; else failed++;

  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
