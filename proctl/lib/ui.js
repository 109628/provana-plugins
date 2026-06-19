'use strict';

async function pickPlugin(plugins) {
  const { default: inquirer } = await import('inquirer');
  const { plugin } = await inquirer.prompt([{
    type: 'list',
    name: 'plugin',
    message: 'Which plugin do you want to install?',
    choices: plugins.map(p => ({
      name: `${p.name} v${p.version} — ${p.description}`,
      value: p.name
    }))
  }]);
  return plugin;
}

async function pickComponents(manifest) {
  const { default: inquirer } = await import('inquirer');
  const choices = [];

  const skills = manifest.listSkills();
  if (skills.length > 0) {
    choices.push(new inquirer.Separator('── Skills ──'));
    for (const s of skills) {
      choices.push({ name: `${s.name} — ${s.description || ''}`, value: `skill:${s.name}`, checked: true });
    }
  }

  const mcps = manifest.listMcpServers();
  if (mcps.length > 0) {
    choices.push(new inquirer.Separator('── MCP Servers ──'));
    for (const m of mcps) {
      choices.push({ name: `${m.name} — ${m.description || ''}`, value: `mcp:${m.name}`, checked: true });
    }
  }

  const hooks = manifest.listHooks();
  if (hooks.length > 0) {
    choices.push(new inquirer.Separator('── Hooks ──'));
    for (const h of hooks) {
      choices.push({ name: `${h.name} — ${h.description || h.event}`, value: `hook:${h.name}`, checked: true });
    }
  }

  const commands = manifest.listCommands();
  if (commands.length > 0) {
    choices.push(new inquirer.Separator('── Commands ──'));
    for (const c of commands) {
      choices.push({ name: c.name, value: `command:${c.name}`, checked: true });
    }
  }

  if (manifest.hasStatusline()) {
    choices.push(new inquirer.Separator('── Statusline ──'));
    choices.push({ name: 'statusline', value: 'statusline', checked: true });
  }

  if (choices.filter(c => !(c instanceof inquirer.Separator)).length === 0) {
    return { skills: [], mcp: [], hooks: [], commands: [], statusline: false };
  }

  const { selected } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selected',
    message: 'Which components do you want to install?',
    choices
  }]);

  return {
    skills: selected.filter(s => s.startsWith('skill:')).map(s => s.slice(6)),
    mcp: selected.filter(s => s.startsWith('mcp:')).map(s => s.slice(4)),
    hooks: selected.filter(s => s.startsWith('hook:')).map(s => s.slice(5)),
    commands: selected.filter(s => s.startsWith('command:')).map(s => s.slice(8)),
    statusline: selected.includes('statusline')
  };
}

async function pickAgents(available) {
  const { default: inquirer } = await import('inquirer');
  const { agents } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'agents',
    message: 'Which agents do you want to install to?',
    choices: available.map(a => ({ name: a, value: a, checked: true })),
    validate: (ans) => ans.length > 0 || 'Select at least one agent'
  }]);
  return agents;
}

async function confirmInstall(summary) {
  const { default: inquirer } = await import('inquirer');
  const { ok } = await inquirer.prompt([{
    type: 'confirm',
    name: 'ok',
    message: summary || 'Proceed?',
    default: true
  }]);
  return ok;
}

module.exports = { pickPlugin, pickComponents, pickAgents, confirmInstall };
