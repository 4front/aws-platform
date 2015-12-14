/* eslint id-length: 30 */

var _ = require('lodash');
var async = require('async');
var yaml = require('js-yaml');
var path = require('path');
var redis = require('redis');
var shared = require('4front-shared');
var session = require('express-session');
var debug = require('debug')('4front:aws-platform:configuration');
var S3Storage = require('4front-s3-storage');
var DynamoDb = require('4front-dynamodb');
var AWS = require('aws-sdk');

require('redis-streams')(redis);

module.exports = function(app, callback) {
  var awsRegion = process.env.AWS_REGION || 'us-west-2';

  _.extend(app.settings, {
    localInstance: process.env.NODE_ENV === 'development',
    awsRegion: awsRegion,
    s3Options: {
      region: awsRegion,
      bucket: process.env.FF_S3_BUCKET
    },
    dynamoOptions: {
      region: awsRegion,
      tablePrefix: '4front_'
    },
    deployedAssetsPath: '/'
  });

  var asyncTasks = [];
  if (app.settings.localInstance === true) {
    asyncTasks.push(require('./local')(app));
  }

  asyncTasks.push(function(cb) {
    // Load the configuration YAML file from S3.
    var s3 = new AWS.S3(app.settings.s3Options);
    s3.getObject({Bucket: process.env.FF_S3_BUCKET, Key: 'config.yml'}, function(err, data) {
      if (err) return callback(err);

      var instanceConfig;
      try {
        instanceConfig = yaml.safeLoad(data.Body.toString());
      } catch (err) {
        return callback(Error.create('Could not parse config.yml from S3', {}, err));
      }

      _.extend(app.settings, instanceConfig.settings);
      cb();
    });
  });

  async.series(asyncTasks, function(err) {
    if (err) return callback(err);

    try {
      var storage = new S3Storage(_.extend(app.settings.s3Options, {
        keyPrefix: app.settings.deploymentsKeyPrefix
      }));

      app.settings.logger = require('4front-logger')({
        logger: '4front-logger',
        elasticSearchHost: app.settings.elasticSearchLogHost
      });

      _.defaults(app.settings, shared.settingDefaults);
      app.settings.crypto = shared.crypto(app.settings.cryptoPassword);

      // Load the ldap settings from environment variables.
      app.settings.ldap = {
        url: app.settings.ldapUrl,
        baseDN: app.settings.baseDN,
        usersDN: app.settings.ldapUsersDN,
        groupsDN: app.settings.ldapGroupsDN,
        usernamePrefix: app.settings.ldapUsernamePrefix
      };

      // If this is a local instance, override config settings to simulate
      // the real AWS resources.
      if (app.settings.localInstance !== true) {
        var ldapIdentityProvider = require('4front-ldap-auth')(app.settings);

        // Configure ldap as the identity provider
        app.settings.identityProviders = [ldapIdentityProvider];
      }

      // other settings: sessionUserKey
      app.settings.database = new DynamoDb(app.settings.dynamoOptions);

      // Assuming redis is listening on default port
      // app.settings.cache = memoryCache();
      app.settings.cache = redis.createClient(
        app.settings.redisPort || 6379,
    		app.settings.redisHost || '127.0.0.1'
      );

      var RedisStore = require('connect-redis')(session);
      app.settings.sessionStore = new RedisStore({
        client: app.settings.cache
      });

      // Configure the login provider
      app.settings.membership = require('4front-membership')(app.settings);

      app.settings.virtualAppRegistry = require('4front-app-registry')(app.settings);

      app.settings.storage = new S3Storage(_.extend(app.settings.s3Options, {
        keyPrefix: app.settings.deploymentsS3Prefix
      }));

      app.settings.deployer = require('4front-deployer')(_.extend({}, app.settings, {
        gzip: app.settings.gzipEnabled !== false
      }));
    } catch (err) {
      debug('app setting error');
      return callback(err);
    }

    callback();
  });
};
