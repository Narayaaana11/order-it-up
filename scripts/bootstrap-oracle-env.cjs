#!/usr/bin/env node
/**
 * Generates backend/.env.oracle with cryptographically random JWT secrets
 * and an scrypt password hash compatible with backend/src/api/auth.ts.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXAMPLE_PATH = path.join(REPO_ROOT, 'backend', '.env.example');
const DEFAULT_OUT_PATH = path.join(REPO_ROOT, 'backend', '.env.oracle');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--force' || token === '-f') {
      args.force = true;
      continue;
    }
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function hashScryptPassword(password) {
  if (!password || password.length < 12) {
    throw new Error('Admin password must be at least 12 characters long.');
  }
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$N=16384,r=8,p=1$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

function setEnvLine(content, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^#?\\s*${escaped}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

function printHelp() {
  console.log(`Usage: node scripts/bootstrap-oracle-env.cjs [options]

Options:
  --domain <host>           API domain (default: api.orderitup.in)
  --origins <csv>           Allowed CORS origins (default: from .env.example)
  --admin-email <email>     Platform admin email (default: admin@orderitup.in)
  --admin-password <pass>   Platform admin password (>= 12 chars; random if omitted)
  --out <path>              Output file path (default: backend/.env.oracle)
  --force                   Overwrite existing output file
  -h, --help                Show this help message`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const outPath = path.resolve(args.out || DEFAULT_OUT_PATH);
  if (fs.existsSync(outPath) && !args.force) {
    throw new Error(`Refusing to overwrite existing file: ${outPath} (pass --force to overwrite)`);
  }

  if (!fs.existsSync(EXAMPLE_PATH)) {
    throw new Error(`Template not found: ${EXAMPLE_PATH}`);
  }

  const domain = args.domain || 'api.orderitup.in';
  const adminEmail = (args['admin-email'] || 'admin@orderitup.in').trim().toLowerCase();
  const generatedPassword = !args['admin-password'];
  const adminPassword = args['admin-password'] || crypto.randomBytes(18).toString('base64url');

  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const platformAdminJwtSecret = crypto.randomBytes(32).toString('hex');
  const passwordHash = hashScryptPassword(adminPassword);

  let content = fs.readFileSync(EXAMPLE_PATH, 'utf8');
  content = setEnvLine(content, 'DOMAIN', domain);
  if (args.origins) {
    content = setEnvLine(content, 'FRONTEND_ORIGIN', args.origins);
  }
  content = setEnvLine(content, 'JWT_SECRET', jwtSecret);
  content = setEnvLine(content, 'PLATFORM_ADMIN_JWT_SECRET', platformAdminJwtSecret);
  content = setEnvLine(content, 'PLATFORM_ADMIN_EMAIL', adminEmail);
  content = setEnvLine(content, 'PLATFORM_ADMIN_PASSWORD_HASH', passwordHash);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, { encoding: 'utf8', mode: 0o600 });

  console.log(`Generated Oracle environment file: ${path.relative(REPO_ROOT, outPath)}`);
  console.log(`  DOMAIN=${domain}`);
  console.log(`  PLATFORM_ADMIN_EMAIL=${adminEmail}`);
  if (generatedPassword) {
    console.log(`  Generated one-time admin password (save now): ${adminPassword}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
