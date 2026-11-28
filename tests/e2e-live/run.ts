import fs from 'node:fs';
import path from 'node:path';
import { registry, type TestFilter, type Tier } from './lib/test-kit';

import './suites/harness-smoke.test';

interface CliOptions {
  tier: Tier | 'all';
  suite?: string;
  smoke: boolean;
  jsonPath?: string;
  help: boolean;
}

function parseTier(raw: string): Tier | 'all' {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'all') return 'all';
  if (normalized === '1') return 1;
  if (normalized === '2') return 2;
  if (normalized === '3') return 3;
  if (normalized === '4') return 4;
  throw new Error(`Invalid --tier value "${raw}". Expected 1 | 2 | 3 | 4 | all.`);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    tier: 'all',
    smoke: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--smoke') {
      opts.smoke = true;
    } else if (arg === '--tier') {
      const val = argv[++i];
      if (!val) throw new Error('Missing value for --tier');
      opts.tier = parseTier(val);
    } else if (arg.startsWith('--tier=')) {
      opts.tier = parseTier(arg.slice('--tier='.length));
    } else if (arg === '--suite') {
      const val = argv[++i];
      if (!val) throw new Error('Missing value for --suite');
      opts.suite = val;
    } else if (arg.startsWith('--suite=')) {
      opts.suite = arg.slice('--suite='.length);
    } else if (arg === '--json') {
      const val = argv[++i];
      if (!val) throw new Error('Missing value for --json');
      opts.jsonPath = val;
    } else if (arg.startsWith('--json=')) {
      opts.jsonPath = arg.slice('--json='.length);
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  return opts;
}

function printHelp(): void {
  console.log(
    [
      'Order It Up Live E2E Runner',
      '',
      'Usage:',
      '  npx ts-node --transpile-only -P tests/tsconfig.json tests/e2e-live/run.ts [options]',
      '',
      'Options:',
      '  --tier <1|2|3|4|all>   Filter tests by tier (default: all)',
      '  --suite <filter>       Case-insensitive substring filter on test id/feature/title',
      '  --smoke                Run only smoke tests (smoke: true)',
      '  --json <path>          Write structured JSON report to <path>',
      '  -h, --help             Show this help message',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const filter: TestFilter = {
    tier: opts.tier,
    ...(opts.suite ? { suite: opts.suite } : {}),
    ...(opts.smoke ? { smoke: true } : {}),
  };

  const matched = registry.list(filter);
  if (matched.length === 0) {
    console.error(
      `No tests matched filter (tier=${String(opts.tier)}, suite=${opts.suite ?? ''}, smoke=${opts.smoke}). Registered total: ${registry.count()}.`,
    );
    if (opts.jsonPath) {
      const emptyReport = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: registry.count(),
        durationMs: 0,
        results: [],
        byTier: {},
        byFeature: {},
      };
      fs.mkdirSync(path.dirname(path.resolve(opts.jsonPath)), { recursive: true });
      fs.writeFileSync(opts.jsonPath, JSON.stringify(emptyReport, null, 2), 'utf8');
    }
    process.exit(1);
  }

  console.log(
    `[E2E-Live] Running ${matched.length} test(s) (tier=${String(opts.tier)}, smoke=${opts.smoke}${opts.suite ? `, suite=${opts.suite}` : ''})...\n`,
  );

  const report = await registry.runAll(filter, (res) => {
    const tag = res.status === 'passed' ? 'PASS' : 'FAIL';
    console.log(
      `[${tag}] [Tier ${res.tier}] [${res.feature}] ${res.id} (${res.durationMs}ms) - ${res.title}`,
    );
    if (res.status === 'failed' && res.error) {
      console.error(`       Error: ${res.error}`);
      if (res.stack) {
        const stackTail = res.stack.split('\n').slice(1, 5).join('\n');
        if (stackTail) {
          console.error(stackTail);
        }
      }
    }
  });

  console.log('\n[E2E-Live] Summary by Tier:');
  for (const [tierKey, stats] of Object.entries(report.byTier).sort(
    ([a], [b]) => Number(a) - Number(b),
  )) {
    console.log(
      `  Tier ${tierKey}: ${stats.passed}/${stats.total} passed (${stats.failed} failed)`,
    );
  }

  console.log('\n[E2E-Live] Summary by Feature:');
  for (const [featureName, stats] of Object.entries(report.byFeature).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(
      `  ${featureName}: ${stats.passed}/${stats.total} passed (${stats.failed} failed)`,
    );
  }

  console.log(
    `\n[E2E-Live] Total: ${report.passed}/${report.total} passed, ${report.failed} failed, ${report.skipped} skipped (${report.durationMs}ms)`,
  );

  if (opts.jsonPath) {
    const resolvedOut = path.resolve(opts.jsonPath);
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.writeFileSync(resolvedOut, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[E2E-Live] JSON report written to ${resolvedOut}`);
  }

  process.exit(report.failed === 0 && report.total > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[E2E-Live] Runner error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
