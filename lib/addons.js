var async = require('async');
var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;

// Install any necessary addons
module.exports = function(settings) {
  return function(callback) {
    if (process.env['FF_AUTO_INSTALL_ADDONS'] === '0')
      return callback();

    settings.logger.info("Installing add-on modules");

    // Read the FF_ADDONS environment variable and run npm on each value in the
    // list writing to the local addons directory.
    var addons = process.env.FF_ADDONS;
    if (!addons)
      return callback();

    // Just install the addons to the same node_modules where main app
    // dependencies are located.
    var spawnOptions = {
      cwd: path.resolve(__dirname, ".."),
      waitForExit: true,
      stdio: 'inherit'
    };

    var npmPath = process.env.NPM_PATH || 'npm';
    var npmArgs = ['install'].concat(addons.split(','));

    settings.logger.info("Running npm " + npmArgs.join(' '));
    var npmInstall = spawn(npmPath, npmArgs, spawnOptions)

    npmInstall.on('exit', function(code, signal) {
      if (code !== 0)
        return callback(new Error("Error running npm install for addons"));

      callback(null);
    });
  }
};
