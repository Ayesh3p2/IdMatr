#!/usr/bin/env node
/**
 * Control Plane backend (NestJS) launcher — prepends nvm node to PATH
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const nvmBin = '/Users/sudhir/.nvm/versions/node/v24.13.1/bin';

// Load .env from repo root
const envFile = path.join(__dirname, '..', '.env');
const env = { ...process.env, PATH: `${nvmBin}:${process.env.PATH}`, NODE: `${nvmBin}/node` };

if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!env[key]) env[key] = val;
  }
}

const cwd = path.join(__dirname, '..', 'apps', 'control-plane');

// Run: npx ts-node src/main.ts OR nest start --watch
// Use ts-node via root node_modules for local dev
const child = spawn(`${nvmBin}/node`, [
  path.join(__dirname, '..', 'node_modules', '.bin', 'ts-node'),
  '--esm',
  'src/main.ts',
], { cwd, env, stdio: 'inherit' });

child.on('error', (err) => {
  // Fallback: try compiled dist if ts-node fails
  console.error('ts-node failed, trying dist/main.js:', err.message);
  const fallback = spawn(`${nvmBin}/node`, ['dist/main.js'], { cwd, env, stdio: 'inherit' });
  fallback.on('exit', code => process.exit(code || 0));
});

child.on('exit', code => process.exit(code || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
