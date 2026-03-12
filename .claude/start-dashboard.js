#!/usr/bin/env node
/**
 * Dashboard launcher that prepends nvm node to PATH
 * Required because preview tools don't inherit shell PATH with nvm
 */
const { spawn } = require('child_process');
const path = require('path');

const nvmBin = '/Users/sudhir/.nvm/versions/node/v24.13.1/bin';
const env = {
  ...process.env,
  PATH: `${nvmBin}:${process.env.PATH}`,
  NODE: `${nvmBin}/node`,
};

const cwd = path.join(__dirname, '..', 'apps', 'admin-dashboard');

const child = spawn(`${nvmBin}/npm`, ['run', 'dev'], {
  cwd,
  env,
  stdio: 'inherit',
});

child.on('exit', code => process.exit(code || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
