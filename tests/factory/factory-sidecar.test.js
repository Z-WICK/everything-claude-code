/**
 * Tests for the Factory sidecar discovery and mirroring helpers.
 *
 * Run with: node tests/factory/factory-sidecar.test.js
 */

const assert = require('assert');
const fs = require('fs');

const sidecar = require('../../.factory/_ecc/lib/factory-sidecar');

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

function assertSortedUnique(values, label) {
  const sorted = [...values].sort();
  assert.deepStrictEqual(values, sorted, `${label} should be sorted`);
  assert.strictEqual(new Set(values).size, values.length, `${label} should not contain duplicates`);
}

function runTests() {
  console.log('\n=== Testing Factory sidecar auto-discovery ===\n');

  let passed = 0;
  let failed = 0;

  if (test('buildFactoryCommandFromSource preserves existing $ARGUMENTS', () => {
    const source = [
      '---',
      'description: Review Go code',
      '---',
      '',
      '# Go Review',
      '',
      'Task:',
      '$ARGUMENTS',
      '',
      'Use the go-reviewer agent.',
      '',
    ].join('\n');

    const output = sidecar.buildFactoryCommandFromSource(source);

    assert.ok(output.includes('$ARGUMENTS'));
    assert.ok(!output.includes('## Canonical ECC Workflow'));
    assert.ok(!output.includes('argument-hint: "[task description]"'));
  })) passed++; else failed++;

  if (test('buildFactoryCommandFromSource injects a bridge when $ARGUMENTS is missing', () => {
    const source = [
      '---',
      'description: Plan a task',
      '---',
      '',
      '# Plan',
      '',
      'Describe the planning workflow.',
      '',
    ].join('\n');

    const output = sidecar.buildFactoryCommandFromSource(source);

    assert.ok(output.includes('argument-hint: "[task description]"'));
    assert.ok(output.includes('## User Request'));
    assert.ok(output.includes('$ARGUMENTS'));
    assert.ok(output.includes('## Canonical ECC Workflow'));
    assert.ok(output.endsWith('\n'));
  })) passed++; else failed++;

  if (test('discoverManagedCommands auto-includes compatible commands and excludes incompatible ones', () => {
    const config = sidecar.loadFactoryConfig();
    const state = sidecar.discoverManagedCommands(config);

    assertSortedUnique(state.includedFiles, 'included command files');
    assert.ok(state.includedFiles.includes('plan.md'), 'plan.md should be mirrored into Factory');
    assert.ok(!state.includedFiles.includes('sessions.md'), 'sessions.md should remain excluded');

    const excludedByName = new Map(state.excludedCommands.map((entry) => [entry.fileName, entry.reasons]));
    assert.ok(excludedByName.has('sessions.md'), 'sessions.md should be excluded for Factory');
    assert.ok(excludedByName.get('sessions.md')[0].includes('session persistence'));

    for (const fileName of state.includedFiles) {
      const source = sidecar.readText(sidecar.getCommandSourcePath(fileName));
      const transformed = sidecar.buildFactoryCommandFromSource(source);
      const reasons = sidecar.detectExcludedCommandReasons(fileName, source, transformed, config);

      assert.deepStrictEqual(reasons, [], `${fileName} should remain includable`);
      assert.ok(transformed.includes('$ARGUMENTS'), `${fileName} should expose $ARGUMENTS`);
      assert.ok(!transformed.includes('~/.claude/'), `${fileName} should not keep ~/.claude paths`);
      assert.ok(!transformed.includes('.claude/'), `${fileName} should not keep .claude paths`);
    }
  })) passed++; else failed++;

  if (test('discoverManagedSkills follows references from mirrored agents and commands', () => {
    const config = sidecar.loadFactoryConfig();
    const commandState = sidecar.discoverManagedCommands(config);
    const skillDirs = sidecar.discoverManagedSkills(commandState.includedFiles, config);

    assertSortedUnique(skillDirs, 'mirrored skill directories');
    assert.ok(skillDirs.includes('tdd-workflow'), 'tdd-workflow should be mirrored');
    assert.ok(skillDirs.includes('security-review'), 'security-review should be mirrored');

    for (const skillDir of skillDirs) {
      assert.ok(
        fs.existsSync(sidecar.getManagedSkillSourcePath(skillDir)),
        `${skillDir} should exist in the upstream skills directory`,
      );
    }
  })) passed++; else failed++;

  if (test('current .factory mirror matches the discovered Factory state', () => {
    const state = sidecar.discoverFactoryState();

    assert.deepStrictEqual(
      sidecar.listMarkdownBasenames(sidecar.FACTORY_DROIDS_DIR),
      state.agentFiles,
      'Factory droids should mirror all agents',
    );
    assert.deepStrictEqual(
      sidecar.listMarkdownBasenames(sidecar.FACTORY_COMMANDS_DIR),
      state.commandFiles,
      'Factory commands should mirror the discovered command set',
    );
    assert.deepStrictEqual(
      fs.readdirSync(sidecar.FACTORY_SKILLS_DIR).sort(),
      state.skillDirs,
      'Factory skills should mirror the discovered skill set',
    );

    for (const fileName of state.commandFiles) {
      const expected = sidecar.buildFactoryCommandFromSource(sidecar.readText(sidecar.getCommandSourcePath(fileName)));
      const actual = sidecar.readText(sidecar.getCommandTargetPath(fileName));
      assert.strictEqual(actual, expected, `${fileName} should stay synced`);
    }
  })) passed++; else failed++;

  console.log('\nResults:');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
