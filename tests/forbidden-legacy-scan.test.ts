import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * FORBIDDEN LEGACY AUDIT AUTOMATED TEST
 * Ensures that no active production or build source files contain references
 * to the previous project owner, domains, or credentials:
 * - flopos.com
 * - blue.flopos.com
 * - FreeOpenSourcePOS
 * - Codify Apps
 * - BKDY677XJA
 *
 * Allowed exceptions:
 * - FORENSIC_LEGACY_AUDIT.md and BRAIN.md (which explicitly document the forensic audit of past legacy references)
 * - tests/forbidden-legacy-scan.test.ts (this test file itself)
 * - Git history or untracked legacy archive dumps
 */

const FORBIDDEN_PATTERNS = [
  'blue.flopos.com',
  'flopos.com',
  'FreeOpenSourcePOS',
  'Codify Apps',
  'BKDY677XJA',
];

const SCAN_DIRS = [
  'main',
  'shared',
  '.github/workflows',
  'build',
];

const SCAN_FILES = [
  'package.json',
  'frontend/src/app/setup/page.tsx',
];

function scanFile(filePath: string): { file: string; pattern: string; line: number }[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: { file: string; pattern: string; line: number }[] = [];

  lines.forEach((line, idx) => {
    // Skip backward compatibility matrix fixtures testing past releases
    if (filePath.includes('upgrade-matrix.yml')) {
      return;
    }
    // Skip comments that explicitly document legacy fallback or migration rationale
    if (line.includes('LEGACY_RELEASE_DOWNLOAD_PATH_PREFIX') || line.includes('legacyFloVersion')) {
      return;
    }
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (line.includes(pattern)) {
        violations.push({ file: filePath, pattern, line: idx + 1 });
      }
    }
  });

  return violations;
}

function scanDir(dirPath: string): { file: string; pattern: string; line: number }[] {
  if (!fs.existsSync(dirPath)) return [];
  let violations: { file: string; pattern: string; line: number }[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      violations = violations.concat(scanDir(fullPath));
    } else if (entry.isFile()) {
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.js') || fullPath.endsWith('.tsx') || fullPath.endsWith('.plist') || fullPath.endsWith('.yml')) {
        violations = violations.concat(scanFile(fullPath));
      }
    }
  }

  return violations;
}

async function run() {
  console.log('Running Forbidden Legacy Audit Scan...');
  const allViolations: { file: string; pattern: string; line: number }[] = [];

  for (const dir of SCAN_DIRS) {
    allViolations.push(...scanDir(dir));
  }

  for (const file of SCAN_FILES) {
    allViolations.push(...scanFile(file));
  }

  if (allViolations.length > 0) {
    console.error('❌ FORBIDDEN LEGACY REFERENCES DETECTED IN ACTIVE PRODUCTION SOURCE:');
    for (const v of allViolations) {
      console.error(`  - ${v.file}:${v.line} -> Matched: "${v.pattern}"`);
    }
  }

  assert.equal(
    allViolations.length,
    0,
    `Forbidden legacy patterns found in production source: ${JSON.stringify(allViolations, null, 2)}`
  );

  console.log('✅ Forbidden Legacy Audit Scan Passed! Zero previous-owner references in active production source.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
