'use strict';

module.exports = {
  Registry: require('./registry').Registry,
  Installer: require('./installer').Installer,
  Manifest: require('./manifest').Manifest,
  StateTracker: require('./state'),
  Settings: require('./settings')
};
