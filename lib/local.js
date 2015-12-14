var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var AWS = require('aws-sdk');
var debug = require('debug')('4front:local');

require('simple-errors');

var FAKE_S3_PORT = 4658;
var DYNAMO_LOCAL_PORT = 8000;

// Apply configuration overrides for running in local mode
module.exports = function(app) {
  return function(done) {
    debug('applying local config overrides');

    _.extend(app.settings.s3Options, {
      // These values don't actually matter for the fake S3 server
      accessKeyId: '4front',
      secretAccessKey: '4front',
      endpoint: 'localhost:' + FAKE_S3_PORT,
      sslEnabled: false,
      s3ForcePathStyle: true
    });

    _.extend(app.settings.dynamoOptions, {
      accessKeyId: '4front',
      secretAccessKey: '4front',
      endpoint: 'http://localhost:' + DYNAMO_LOCAL_PORT
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

    fakeS3Server(done);
  };

  function fakeS3Server(callback) {
    var configYml;
    async.series([
      function(cb) {
        fs.mkdir(path.resolve(__dirname, '../' + app.settings.s3Options.bucket), function(err) {
          if (err) {
            debug('fake bucket already exists');
          }
          cb();
        });
      },
      function(cb) {
        // Start the fake S3rver
        debug('start the fake S3rver');
        var S3rver = require('s3rver');
        new S3rver({
          port: FAKE_S3_PORT,
          hostname: 'localhost',
          silent: true,
          directory: path.resolve(__dirname, '..')
        }).run(function(err, host, port) {
          if (err) {
            debug('error starting fake S3rver');
            return cb(Error.create('Error starting fake S3 server', {}, err));
          }
          debug('S3rver started at %s:%s', host, port);
          cb();
        });
      },
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
