var path = require('path');
var spawn = require('child_process').spawn;

// Install any necessary addons
module.exports = function(settings) {
  return function(callback) {
    if (process.env.FF_AUTO_INSTALL_PLUGINS === '0') return callback();

    settings.logger.info('installing plugins with npm');

    // Read the FF_ADDONS environment variable and run npm on each value in the
    // list writing to the local addons directory.
    var plugins = process.env.FF_PLUGINS;
    if (!plugins) return callback();

    // Just install the addons to the same node_modules where main app
    // dependencies are located.
    var spawnOptions = {
      cwd: path.resolve(__dirname, '..'),
      waitForExit: true,
      stdio: 'inherit'
    };

    var npmPath = process.env.NPM_PATH || 'npm';
    var npmArgs = ['install'].concat(plugins.split(','));

    settings.logger.info('Running npm ' + npmArgs.join(' '));
    var npmInstall = spawn(npmPath, npmArgs, spawnOptions);

    npmInstall.on('exit', function(code) {
      if (code !== 0) return callback(new Error('Error running npm install for plugins'));

      callback(null);
    });
  };
};
