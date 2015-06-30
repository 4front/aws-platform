var async = require('async');
var path = require('path');
var fs = require('fs');
var rimraf = require('rimraf');
var spawn = require('child_process').spawn;

// Install any necessary addons

module.exports = function(settings) {
  return function(callback) {
    settings.logger.info("Initialize addons");

    async.series([
      function(cb) {
        ensureAddonDirectory(cb);
      },
      function(cb) {
        settings.logger.info("Deleting previous addons");
        rimraf(path.join(settings.addonsDir, 'node_modules'), cb);
      },
      function(cb) {
        installAddons(cb);
      }
    ], function(err) {
      if (err)
        return callback(err);

      settings.logger.info("Done installing addons");
      callback();
    });
  };

  // Read the FF_ADDONS environment variable and run npm on each value in the
  // list writing to the local addons directory.
  function installAddons(callback) {
    settings.logger.info("Install addons with npm");

    var addons = process.env.FF_ADDONS;
    if (!addons)
      return callback();

    var spawnOptions = {
      cwd: settings.addonsDir,
      waitForExit: true,
      stdio: 'inherit'
    };

    var npmInstall = spawn('npm', ['install'].concat(addons.split(',')), spawnOptions)

    npmInstall.on('exit', function(code, signal) {
      if (code !== 0)
        return callback(new Error("Error running npm install for addons"));

      callback(null);
    });
  }

  function ensureAddonDirectory(callback) {
    settings.logger.info("Ensuring addons directory");
    fs.mkdir(settings.addonsDir, function(err) {
      if (err) {
        if (err.code !== 'EEXIST')
          return callback(err);
      }

      callback();
    });
  }
};
