import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const YAML = require('js-yaml') as { load: (text: string) => any };

const workflowPath = path.join(__dirname, '../.github/workflows/desktop-release.yml');
const workflow = YAML.load(fs.readFileSync(workflowPath, 'utf8')) as any;

function step(name: string): any {
  const found = (workflow.jobs?.windows?.steps || []).find((candidate: any) => candidate.name === name);
  assert.ok(found, `workflow must contain step "${name}"`);
  return found;
}

// Triggers and permissions
assert.deepEqual(Object.keys(workflow.on).sort(), ['push', 'workflow_dispatch']);
assert.deepEqual(workflow.on.push.tags, ['[0-9]*'], 'tag pushes build a draft release');
assert.equal(workflow.on.workflow_dispatch.inputs.tag.required, true);
assert.equal(workflow.permissions.contents, 'write');
assert.equal(workflow.concurrency['cancel-in-progress'], false, 'release uploads must not be cancelled mid-flight');

// Build job
const job = workflow.jobs.windows;
assert.ok(job, 'workflow must define a windows job');
assert.equal(job['runs-on'], 'windows-latest');
assert.ok(job['timeout-minutes'] >= 30);

assert.equal(step('Set up Node.js 22').with['node-version'], '22');
assert.match(step('Install root dependencies').run, /npm ci/);
assert.match(step('Install frontend dependencies').run, /npm ci --prefix frontend/);
assert.match(step('Build desktop renderer').run, /npm run build:frontend/);
assert.match(step('Build backend').run, /npm run build\b/);
assert.match(step('Verify Electron runtime').run, /npm run verify:electron/);

const packageStep = step('Package Windows installer');
assert.match(packageStep.run, /electron-builder --win nsis --x64 --publish never/);
assert.equal(packageStep.env.CSC_LINK, '${{ secrets.WINDOWS_CERTIFICATE }}', 'signing uses a repository secret');
assert.equal(packageStep.env.CSC_KEY_PASSWORD, '${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}');

assert.match(step('Verify release artifact names').run, /npm run verify:release-artifacts/);
const upload = step('Upload installer artifact');
assert.match(upload.with.path, /release\/\*\.exe/);
assert.equal(upload.with['if-no-files-found'], 'error');

// Draft release only — never auto-publish
const draft = step('Create draft GitHub release');
assert.match(draft.if, /refs\/tags\//);
assert.match(draft.run, /gh release create/);
assert.match(draft.run, /--draft/);
assert.doesNotMatch(draft.run, /--latest/);
assert.doesNotMatch(draft.run, /--draft=false/);
assert.equal(draft.env.GH_TOKEN, '${{ github.token }}');

const serialized = fs.readFileSync(workflowPath, 'utf8');
assert.doesNotMatch(serialized, /--publish always/, 'CI must never publish automatically');
assert.doesNotMatch(serialized, /gh release edit[^\n]*--draft=false/, 'publishing stays a manual decision');

console.log('Desktop release workflow passed: tag/manual triggers, build + signing env, artifact upload, draft-only release.');
