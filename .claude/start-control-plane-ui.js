#!/usr/bin/env node
/**
 * Control Plane UI launcher that prepends nvm node to PATH
 */
const { spawn } = require('child_process');
const path = require('path');

const nvmBin = '/Users/sudhir/.nvm/versions/node/v24.13.1/bin';
const env = {
  ...process.env,
  PATH: `${nvmBin}:${process.env.PATH}`,
  NODE: `${nvmBin}/node`,
  NEXT_PUBLIC_CP_API_URL: process.env.NEXT_PUBLIC_CP_API_URL || 'http://localhost:3010',
};

const cwd = path.join(__dirname, '..', 'apps', 'control-plane-ui');

const child = spawn(`${nvmBin}/npm`, ['run', 'dev'], {
  cwd,
  env,
  stdio: 'inherit',
});

child.on('exit', code => process.exit(code || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
