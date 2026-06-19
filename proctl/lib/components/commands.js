'use strict';

async function installCommand(cmdDef, fetchFile, agentAdapter, pluginName, opts = {}) {
  const content = await fetchFile(cmdDef.path);
  agentAdapter.installCommand(cmdDef.name, content, opts);
}

module.exports = { installCommand };
