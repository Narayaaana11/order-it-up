/**
 * Adversarial Stress Harness: Circular Dependencies, Lucide Icons, and Secret Exposure
 * Challenger 1 (teamwork_challenger_r2_1)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;

const ROOT = path.resolve(__dirname, '..');

console.log('=== ADVANCED ADVERSARIAL STRESS HARNESS ===\n');

// -------------------------------------------------------------------
// 1. Graph Analysis: Circular Dependency Detector across frontend/src
// -------------------------------------------------------------------
console.log('--- Adversarial Check 1: Circular Dependency Detection ---');

function buildDependencyGraph(srcDir, extensions = ['.ts', '.tsx']) {
  const graph = new Map(); // file -> Set of imported files
  const fileSet = new Set();

  function scan(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && ent.name !== '.next') {
          scan(full);
        }
      } else if (extensions.some(ext => ent.name.endsWith(ext))) {
        fileSet.add(full);
      }
    }
  }
  scan(srcDir);

  for (const file of fileSet) {
    const deps = new Set();
    const content = fs.readFileSync(file, 'utf8');
    const importRegex = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      let targetPath = null;
      if (importPath.startsWith('.')) {
        targetPath = path.resolve(path.dirname(file), importPath);
      } else if (importPath.startsWith('@/')) {
        targetPath = path.join(srcDir, importPath.slice(2));
      }

      if (targetPath) {
        // Resolve extension
        const candidates = [
          targetPath,
          targetPath + '.ts',
          targetPath + '.tsx',
          targetPath + '.d.ts',
          path.join(targetPath, 'index.ts'),
          path.join(targetPath, 'index.tsx')
        ];
        for (const cand of candidates) {
          if (fileSet.has(cand)) {
            deps.add(cand);
            break;
          }
        }
      }
    }
    graph.set(file, deps);
  }

  // Detect cycles using DFS
  const cycles = [];
  const visited = new Map(); // 0 = unvisited, 1 = visiting, 2 = visited

  function dfs(node, pathStack) {
    visited.set(node, 1);
    pathStack.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (visited.get(neighbor) === 1) {
        // Cycle detected
        const cycleStartIndex = pathStack.indexOf(neighbor);
        const cycle = pathStack.slice(cycleStartIndex).concat(neighbor);
        cycles.push(cycle.map(p => path.relative(ROOT, p)));
      } else if (!visited.has(neighbor)) {
        dfs(neighbor, pathStack);
      }
    }

    pathStack.pop();
    visited.set(node, 2);
  }

  for (const node of fileSet) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

const landingCycles = buildDependencyGraph(path.join(ROOT, 'landing', 'src'));
console.log(`Landing circular dependencies detected: ${landingCycles.length}`);
if (landingCycles.length > 0) {
  console.warn('Landing cycles:', landingCycles);
}

const frontendCycles = buildDependencyGraph(path.join(ROOT, 'frontend', 'src'));
console.log(`Frontend circular dependencies detected: ${frontendCycles.length}`);
if (frontendCycles.length > 0) {
  console.log('Sample cycles (first 3):', frontendCycles.slice(0, 3));
}

// -------------------------------------------------------------------
// 2. Lucide-React Icon Export Verification
// -------------------------------------------------------------------
console.log('\n--- Adversarial Check 2: Lucide-React Icon Resolution ---');

// Load lucide-react exports from frontend node_modules and landing node_modules
const frontendLucide = require(path.join(ROOT, 'frontend', 'node_modules', 'lucide-react'));
const landingLucide = require(path.join(ROOT, 'landing', 'node_modules', 'lucide-react'));

function verifyLucideImports(srcDir, lucideExports, label) {
  const missingIcons = [];
  let totalIconUsages = 0;

  function scan(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scan(full);
      } else if (ent.name.endsWith('.tsx') || ent.name.endsWith('.ts')) {
        const content = fs.readFileSync(full, 'utf8');
        // Match import { ... } from 'lucide-react'
        const lucideImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g;
        let match;
        while ((match = lucideImportRegex.exec(content)) !== null) {
          const rawNames = match[1].split(',');
          for (let name of rawNames) {
            name = name.trim();
            if (!name) continue;
            // Handle `as` alias e.g. `Check as CheckIcon`
            if (name.includes(' as ')) {
              name = name.split(/\s+as\s+/)[0].trim();
            }
            if (name.startsWith('type ')) continue; // Type-only import
            totalIconUsages++;
            if (!lucideExports[name]) {
              missingIcons.push({
                icon: name,
                file: path.relative(ROOT, full)
              });
            }
          }
        }
      }
    }
  }

  scan(srcDir);
  console.log(`[${label}] Checked ${totalIconUsages} lucide-react icon imports. Missing: ${missingIcons.length}`);
  if (missingIcons.length > 0) {
    console.error(`[${label}] Missing Lucide icons:`, missingIcons);
  }
  return missingIcons;
}

const landingMissingIcons = verifyLucideImports(path.join(ROOT, 'landing', 'src'), landingLucide, 'Landing');
const frontendDashboardMissingIcons = verifyLucideImports(path.join(ROOT, 'frontend', 'src', 'app', '(dashboard)'), frontendLucide, 'Frontend Dashboard');
const frontendCloudMissingIcons = verifyLucideImports(path.join(ROOT, 'frontend', 'src', 'app', 'cloud-portal'), frontendLucide, 'Frontend Cloud Portal');

assert.equal(landingMissingIcons.length, 0, 'Landing has missing lucide-react icon exports');
assert.equal(frontendDashboardMissingIcons.length, 0, 'Frontend Dashboard has missing lucide-react icon exports');
assert.equal(frontendCloudMissingIcons.length, 0, 'Frontend Cloud Portal has missing lucide-react icon exports');

// -------------------------------------------------------------------
// 3. Dev Dependencies in Client Production Bundles
// -------------------------------------------------------------------
console.log('\n--- Adversarial Check 3: Development Dependencies in Bundles ---');

const devDependenciesToScan = [
  'eslint',
  'typescript',
  'playwright',
  '@playwright/test',
  'ts-node',
  'electron-builder'
];

function scanBundlesForForbiddenPackages(outDir, label) {
  const chunksDir = path.join(outDir, '_next', 'static', 'chunks');
  let forbiddenHits = [];
  for (const f of fs.readdirSync(chunksDir)) {
    if (!f.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(chunksDir, f), 'utf8');
    for (const pkg of devDependenciesToScan) {
      // Check if package signature appears as module or comment
      if (content.includes(`node_modules/${pkg}/`) || content.includes(`node_modules\\${pkg}\\`)) {
        forbiddenHits.push({ chunk: f, pkg });
      }
    }
  }
  console.log(`[${label}] Forbidden dev dependencies found in chunks: ${forbiddenHits.length}`);
  return forbiddenHits;
}

const landingForbidden = scanBundlesForForbiddenPackages(path.join(ROOT, 'landing', 'out'), 'Landing');
const frontendForbidden = scanBundlesForForbiddenPackages(path.join(ROOT, 'frontend', 'out'), 'Frontend');

assert.equal(landingForbidden.length, 0, 'Dev dependencies found in Landing bundle!');
assert.equal(frontendForbidden.length, 0, 'Dev dependencies found in Frontend bundle!');

console.log('\n=== ALL ADVERSARIAL STRESS CHECKS PASSED ===');
