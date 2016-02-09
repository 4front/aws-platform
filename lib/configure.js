var _ = require('lodash');
var https = require('https');
var yaml = require('js-yaml');
var redis = require('redis');
var shared = require('4front-shared');
var session = require('express-session');
var debug = require('debug')('4front:aws-platform:configuration');
var S3Storage = require('4front-s3-storage');
var DynamoDb = require('4front-dynamodb');
var AWS = require('aws-sdk');
var deasync = require('deasync');

require('redis-streams')(redis);

module.exports = function(app) {
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
      // https://github.com/aws/aws-sdk-js/issues/862
      httpOptions: {
        agent: new https.Agent({
          rejectUnauthorized: true,
          keepAlive: true,                // workaround part i.
          secureProtocol: 'TLSv1_method', // workaround part ii.
          ciphers: 'ALL'                  // workaround part ii.
        })
      }
    },
    deployedAssetsPath: '/'
  });

  if (app.settings.localInstance === true) {
    require('./local')(app);
  }

  var yamlContents = deasync(loadConfigYamlSettings)();

  // Extend the app.settings with settings from the config.yml file on S3
  var instanceConfig = yaml.safeLoad(yamlContents);
  _.extend(app.settings, instanceConfig.settings);

  // Set the tablePrefix now that the app settings are loaded from the yaml config
  app.settings.dynamoOptions.tablePrefix = app.settings.dynamoDbTablePrefix || '4front_';

  app.settings.logger = require('4front-logger')({
    logger: '4front-logger',
    elasticSearchHost: app.settings.elasticSearchLogHost,
    awsRegion: awsRegion
  });

  _.defaults(app.settings, shared.settingDefaults);
  app.settings.crypto = shared.crypto(app.settings.cryptoPassword);

  // Load the ldap settings from environment variables.
  app.settings.ldap = {
    url: app.settings.ldapUrl,
    baseDN: app.settings.ldapBaseDN,
    usersDN: app.settings.ldapUsersDN,
    groupsDN: app.settings.ldapGroupsDN,
    usernamePrefix: app.settings.ldapUsernamePrefix
  };

  // If this is a local instance, override config settings to simulate
  // the real AWS resources.
  if (app.settings.localInstance !== true) {
    var ldapIdentityProvider = require('4front-ldap-auth')(app.settings.ldap);

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

  function loadConfigYamlSettings(callback) {
    debug('load config.yml from S3 bucket');
    var s3 = new AWS.S3(app.settings.s3Options);
    s3.getObject({Bucket: process.env.FF_S3_BUCKET, Key: 'config.yml'}, function(err, data) {
      if (err) return callback(err);

      callback(null, data.Body.toString());
    });
  }
};
