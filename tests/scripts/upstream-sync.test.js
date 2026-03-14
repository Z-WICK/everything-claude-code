/**
 * Tests for scripts/automation/prepare-upstream-sync.js
 *
 * Run with: node tests/scripts/upstream-sync.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DEFAULTS,
  appendGitHubOutputs,
  buildPullRequestMetadata,
  resolveSyncConfig,
} = require('../../scripts/automation/prepare-upstream-sync');

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

function runTests() {
  console.log('\n=== Testing prepare-upstream-sync.js ===\n');

  let passed = 0;
  let failed = 0;

  if (test('resolveSyncConfig uses safe defaults', () => {
    const config = resolveSyncConfig({});

    assert.strictEqual(config.baseBranch, DEFAULTS.baseBranch);
    assert.strictEqual(config.syncBranch, DEFAULTS.syncBranch);
    assert.strictEqual(config.upstreamRemote, DEFAULTS.upstreamRemote);
    assert.strictEqual(config.upstreamRepo, DEFAULTS.upstreamRepo);
    assert.strictEqual(config.upstreamBranch, DEFAULTS.upstreamBranch);
    assert.strictEqual(config.gitUserName, DEFAULTS.gitUserName);
    assert.strictEqual(config.gitUserEmail, DEFAULTS.gitUserEmail);
  })) passed++; else failed++;

  if (test('resolveSyncConfig accepts explicit environment overrides', () => {
    const config = resolveSyncConfig({
      UPSTREAM_SYNC_BASE_BRANCH: 'release',
      UPSTREAM_SYNC_BRANCH: 'automation/custom-sync',
      UPSTREAM_REMOTE: 'source',
      UPSTREAM_REPO: 'octo-org/example-repo',
      UPSTREAM_BRANCH: 'stable',
      GIT_AUTHOR_NAME: 'bot-user',
      GIT_AUTHOR_EMAIL: 'bot@example.com',
      SIDECAR_REFRESH_COMMIT_MESSAGE: 'chore: rebuild factory mirrors',
    });

    assert.strictEqual(config.baseBranch, 'release');
    assert.strictEqual(config.syncBranch, 'automation/custom-sync');
    assert.strictEqual(config.upstreamRemote, 'source');
    assert.strictEqual(config.upstreamRepo, 'octo-org/example-repo');
    assert.strictEqual(config.upstreamBranch, 'stable');
    assert.strictEqual(config.gitUserName, 'bot-user');
    assert.strictEqual(config.gitUserEmail, 'bot@example.com');
    assert.strictEqual(config.sidecarRefreshCommitMessage, 'chore: rebuild factory mirrors');
  })) passed++; else failed++;

  if (test('resolveSyncConfig rejects malformed upstream repo slugs', () => {
    assert.throws(
      () => resolveSyncConfig({ UPSTREAM_REPO: 'not-a-valid-repo-slug' }),
      /Invalid upstream repo/,
    );
  })) passed++; else failed++;

  if (test('resolveSyncConfig rejects unsafe branch names', () => {
    assert.throws(
      () => resolveSyncConfig({ UPSTREAM_SYNC_BRANCH: 'automation/upstream sync' }),
      /Invalid sync branch/,
    );
    assert.throws(
      () => resolveSyncConfig({ UPSTREAM_BRANCH: 'main;rm -rf /' }),
      /Invalid upstream branch/,
    );
  })) passed++; else failed++;

  if (test('buildPullRequestMetadata describes the upstream sync and sidecar refresh', () => {
    const metadata = buildPullRequestMetadata({
      upstreamRepo: 'affaan-m/everything-claude-code',
      upstreamBranch: 'main',
      baseBranch: 'main',
      syncBranch: 'automation/upstream-sync',
      baseSha: '1234567890abcdef',
      upstreamSha: 'abcdef1234567890',
      headSha: 'fedcba0987654321',
    });

    assert.strictEqual(metadata.title, 'chore: sync upstream main into main');
    assert.ok(metadata.body.includes('automation/upstream-sync'));
    assert.ok(metadata.body.includes('affaan-m/everything-claude-code@main'));
    assert.ok(metadata.body.includes('.factory/_ecc/sync.js'));
    assert.ok(metadata.body.includes('1234567'));
    assert.ok(metadata.body.includes('abcdef1'));
    assert.ok(metadata.body.includes('fedcba0'));
  })) passed++; else failed++;

  if (test('appendGitHubOutputs writes multiline outputs in GitHub Actions format', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upstream-sync-output-'));
    const outputFile = path.join(tempDir, 'github-output.txt');

    try {
      appendGitHubOutputs(outputFile, {
        has_changes: 'true',
        pr_body: 'line 1\nline 2',
      });

      const content = fs.readFileSync(outputFile, 'utf8');
      assert.ok(content.includes('has_changes<<ECC_HAS_CHANGES_'));
      assert.ok(content.includes('pr_body<<ECC_PR_BODY_'));
      assert.ok(content.includes('line 1\nline 2'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  })) passed++; else failed++;

  console.log('\nResults:');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
