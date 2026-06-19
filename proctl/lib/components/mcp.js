'use strict';

const path = require('path');
const os = require('os');

function pluginDir(pluginName) {
  const home = process.env.PROCTL_HOME ||
    path.join(os.homedir(), '.claude', 'proctl');
  return path.join(home, 'plugins', pluginName);
}

function replacePluginDir(str, pluginName) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{pluginDir\}\}/g, pluginDir(pluginName));
}

async function installMcp(mcpDef, agentAdapter, pluginName, opts = {}) {
  let config;
  if (mcpDef.type === 'url') {
    config = {
      type: 'url',
      url: replacePluginDir(mcpDef.url, pluginName),
      __proctl: pluginName
    };
  } else {
    config = {
      type: 'stdio',
      command: replacePluginDir(mcpDef.command, pluginName),
      __proctl: pluginName
    };
    if (mcpDef.args) config.args = mcpDef.args.map(a => replacePluginDir(a, pluginName));
    if (mcpDef.env) config.env = mcpDef.env;
  }
  agentAdapter.installMcp(mcpDef.name, config, opts);
}

module.exports = { installMcp, pluginDir };
