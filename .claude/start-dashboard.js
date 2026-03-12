#!/usr/bin/env node
/**
 * Dashboard launcher: sets PATH so Turbopack can find node for PostCSS workers,
 * then spawns `next dev` for the admin-dashboard.
 */
const { spawn } = require('child_process');
const path = require('path');

const NODE_BIN = process.execPath; // absolute path to this node binary
const NODE_DIR = path.dirname(NODE_BIN);

// Make node findable by name AND set NODE var for tools that use it
process.env.PATH = `${NODE_DIR}${path.delimiter}/usr/local/bin${path.delimiter}${process.env.PATH || ''}`;
process.env.NODE = NODE_BIN;           // some tools use $NODE
process.env.npm_node_execpath = NODE_BIN;

console.log('[launcher] node:', NODE_BIN);
console.log('[launcher] PATH:', process.env.PATH);

const worktreeRoot = path.resolve(__dirname, '..');
const nextBin = path.join(worktreeRoot, 'node_modules', '.bin', 'next');

console.log('[launcher] cwd:', worktreeRoot);
console.log('[launcher] next:', nextBin);

const child = spawn(
  NODE_BIN,
  [nextBin, 'dev', '--port', '3000', 'apps/admin-dashboard'],
  {
    cwd: worktreeRoot,
    stdio: 'inherit',
    env: { ...process.env },
  }
);

child.on('error', (err) => {
  console.error('[launcher] Failed to start next:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
