'use strict';

const fs = require('fs');
const path = require('path');
const { pluginDir } = require('./mcp');

const EVENTS_WITH_MATCHER = new Set(['PreToolUse', 'PostToolUse']);

async function installHook(hookDef, fetchFile, agentAdapter, pluginName, localPluginDir, opts = {}) {
  const scriptFilename = path.basename(hookDef.script);
  const hooksDir = path.join(localPluginDir || pluginDir(pluginName), 'hooks');

  if (!opts.dryRun) {
    fs.mkdirSync(hooksDir, { recursive: true });
    const destPath = path.join(hooksDir, scriptFilename);

    if (fetchFile) {
      const content = await fetchFile(hookDef.script);
      fs.writeFileSync(destPath, content);
    } else {
      // local file copy
      fs.copyFileSync(hookDef.script, destPath);
    }

    const hookEntry = {
      type: 'command',
      command: `powershell -File "${destPath}"`
    };
    if (hookDef.async !== undefined) hookEntry.async = hookDef.async;

    const hookGroup = {
      hooks: [hookEntry],
      __proctl: pluginName
    };

    if (EVENTS_WITH_MATCHER.has(hookDef.event)) {
      hookGroup.matcher = hookDef.matcher || '*';
    }

    agentAdapter.installHook(hookDef.event, hookGroup, opts);
  }
}

module.exports = { installHook };
