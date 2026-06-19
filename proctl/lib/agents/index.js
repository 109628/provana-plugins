'use strict';

const claudeCode = require('./claude-code');
const copilot = require('./copilot');

const ADAPTERS = { 'claude-code': claudeCode, copilot };

// Normalize 'claude' shorthand → 'claude-code'
function normalize(name) {
  if (name === 'claude') return 'claude-code';
  return name;
}

function getAdapter(name) {
  const key = normalize(name);
  const adapter = ADAPTERS[key];
  if (!adapter) throw new Error(`Unknown agent: "${name}". Valid: claude-code, copilot`);
  return adapter;
}

function allAdapters() {
  return Object.values(ADAPTERS);
}

module.exports = { getAdapter, allAdapters, normalize };
