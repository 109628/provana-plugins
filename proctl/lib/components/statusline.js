'use strict';

const path = require('path');
const { pluginDir } = require('./mcp');

async function installStatusline(statuslineDef, agentAdapter, pluginName, localPluginDir, opts = {}) {
  const pDir = localPluginDir || pluginDir(pluginName);
  const scriptPath = path.join(pDir, 'bin', statuslineDef.script);

  const config = {
    type: 'command',
    command: `node "${scriptPath}"`,
    refreshInterval: statuslineDef.refreshInterval || 5,
    __proctl: pluginName
  };

  agentAdapter.installStatusline(config, opts);
}

module.exports = { installStatusline };
