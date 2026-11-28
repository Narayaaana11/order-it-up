#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const cloudApiSrc = path.join(rootDir, 'apps', 'cloud-api', 'src');
const backendApiSrc = path.join(rootDir, 'backend', 'src', 'api');
const sharedCloudTypes = path.join(rootDir, 'shared', 'cloud-types.ts');
const backendCloudTypes = path.join(rootDir, 'backend', 'src', 'types', 'cloud-types.ts');

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizeContent(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/(?:\.\.\/)+shared\/cloud-types/g, 'CLOUD_TYPES_IMPORT')
    .replace(/(?:\.\.\/)+types\/cloud-types/g, 'CLOUD_TYPES_IMPORT');
}

const cloudFiles = walk(cloudApiSrc).map((p) => path.relative(cloudApiSrc, p)).sort();
const backendFiles = walk(backendApiSrc).map((p) => path.relative(backendApiSrc, p)).sort();

const cloudSet = new Set(cloudFiles);
const backendSet = new Set(backendFiles);

const errors = [];

for (const file of cloudFiles) {
  if (!backendSet.has(file)) {
    errors.push(`Missing in backend/src/api: ${file}`);
  }
}

for (const file of backendFiles) {
  if (!cloudSet.has(file)) {
    errors.push(`Extra file in backend/src/api not in apps/cloud-api/src: ${file}`);
  }
}

for (const file of cloudFiles) {
  if (!backendSet.has(file)) continue;
  const cloudContent = normalizeContent(fs.readFileSync(path.join(cloudApiSrc, file), 'utf8'));
  const backendContent = normalizeContent(fs.readFileSync(path.join(backendApiSrc, file), 'utf8'));
  if (cloudContent !== backendContent) {
    errors.push(`Content drift detected in: ${file}`);
  }
}

if (fs.existsSync(sharedCloudTypes) && fs.existsSync(backendCloudTypes)) {
  const sharedContent = fs.readFileSync(sharedCloudTypes, 'utf8').replace(/\r\n/g, '\n');
  const backendTypesContent = fs.readFileSync(backendCloudTypes, 'utf8').replace(/\r\n/g, '\n');
  if (sharedContent !== backendTypesContent) {
    errors.push('Content drift detected in: cloud-types.ts (shared/cloud-types.ts vs backend/src/types/cloud-types.ts)');
  }
} else {
  errors.push('Missing shared/cloud-types.ts or backend/src/types/cloud-types.ts');
}

if (errors.length > 0) {
  console.error('❌ Backend / Cloud API parity check failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`✅ Backend / Cloud API parity verified across ${cloudFiles.length} API files + cloud-types.ts`);
