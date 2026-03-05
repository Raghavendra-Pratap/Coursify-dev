#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, '..', 'config', 'app.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const port = String(config.port ?? 3000);

spawn('npx', ['next', 'dev', '--turbo', '-p', port], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..'),
}).on('exit', (code) => process.exit(code ?? 0));
