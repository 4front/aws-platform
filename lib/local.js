var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var AWS = require('aws-sdk');
var deasync = require('deasync');
var debug = require('debug')('4front:local');

require('simple-errors');

// Apply configuration overrides for running in local mode
module.exports = function(app) {
  debug('applying local config overrides');

  _.extend(app.settings.s3Options, {
    // These values don't actually matter for the fake S3 server
    accessKeyId: '4front',
    secretAccessKey: '4front',
    endpoint: 'localhost:' + process.env.FAKE_S3_PORT,
    sslEnabled: false,
    s3ForcePathStyle: true
  });

  _.extend(app.settings.dynamoOptions, {
    accessKeyId: '4front',
    secretAccessKey: '4front',
    endpoint: 'http://localhost:' + process.env.DYNAMO_LOCAL_PORT
  });

  // Local identity provider to use as a stand-in for LDAP
  // TODO: Use a http basic password file for auth
  // https://www.npmjs.com/package/ht-auth
  var localIdentityProvider = {
    providerName: 'local',
    default: true,
    authenticate: function(username, password, callback) {
      // Always authenticate successfully
      if (_.isEmpty(username) || password !== '4front') {
        callback(Error.create('Invalid credentials', {code: 'invalidCredentials'}));
      }

      callback(null, {userId: username, username: username});
    },
    getUserId: function(username, callback) {
      // Make ther providerUserId the same as the username
      callback(null, username);
    }
  };

  // Configure ldap as the identity provider
  app.settings.identityProviders = [localIdentityProvider];
  deasync(initializeConfigYaml)();

  // Load the localconfig.yml and put it in S3
  function initializeConfigYaml(callback) {
    var configYml;
    async.series([
      function(cb) {
        debug('read localconfig.yml file');
        fs.readFile(path.join(__dirname, '../localconfig.yml'), function(err, data) {
          if (err) return cb(err);
          configYml = data.toString();
          cb();
        });
      },
      function(cb) {
        // Write the localconfig.yml to the bucket.
        debug('write localconfig.yml file to fake bucket');
        var s3 = new AWS.S3(app.settings.s3Options);
        s3.putObject({Bucket: app.settings.s3Options.bucket, Key: 'config.yml', Body: configYml}, function(err) {
          if (err) {
            return cb(Error.create('Error writing localconfig.yml', {}, err));
          }
          cb();
        });
      }
    ], callback);
  }
};
