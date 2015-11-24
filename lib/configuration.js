/* eslint id-length: 30 */

var _ = require('lodash');
var path = require('path');
var redis = require('redis');
var session = require('express-session');
var debug = require('debug')('4front:aws-platform:configuration');
var S3Storage = require('4front-s3-storage');
var DynamoDb = require('4front-dynamodb');

require('redis-streams')(redis);

module.exports = function(app, localInstance) {
  _.extend(app.settings, {
    localInstance: localInstance,
    awsRegion: process.env.AWS_REGION || 'us-west-2'
  });

  app.settings.logger = require('4front-logger')({
    logger: '4front-logger'
  });

  app.settings.dynamoOptions = {
    region: app.settings.awsRegion,
    tablePrefix: '4front_'
  };

  app.settings.s3Options = {
    region: app.settings.awsRegion,
    bucket: process.env.FF_S3_DEPLOYMENTS_BUCKET
  };

  // Load the ldap settings from environment variables.
  app.settings.ldap = {
    url: process.env.FF_LDAP_URL,
    baseDN: process.env.FF_LDAP_BASE_DN,
    usersDN: process.env.FF_LDAP_USERS_DN,
    groupsDN: process.env.FF_LDAP_GROUPS_DN,
    usernamePrefix: process.env.FF_LDAP_USERNAME_PREFIX
  };

  // If this is a local instance, override config settings to simulate
  // the real AWS resources.
  if (localInstance === true) {
    require('./local')(app);
  } else {
    var ldapIdentityProvider = require('4front-ldap-auth')(app.settings.ldap);

    // Configure ldap as the identity provider
    app.settings.identityProviders = [ldapIdentityProvider];
  }

  // Temporarily using LDAP auth locally
  // var ldapIdentityProvider = require('4front-ldap-auth')(app.settings.ldap);
  // app.settings.identityProviders = [ldapIdentityProvider];

  // other settings: sessionUserKey
  app.settings.database = new DynamoDb(app.settings.dynamoOptions);

  // Assuming redis is listening on default port
  // app.settings.cache = memoryCache();
  app.settings.cache = redis.createClient(
      process.env.FF_REDIS_PORT || 6379,
  		process.env.FF_REDIS_HOST || '127.0.0.1'
  );

  var RedisStore = require('connect-redis')(session);
  app.settings.sessionStore = new RedisStore({
    client: app.settings.cache
  });

  // Configure the login provider
  app.settings.membership = require('4front-membership')(app.settings);

  app.settings.virtualAppRegistry = require('4front-app-registry')(app.settings);

  app.settings.storage = new S3Storage(_.extend(app.settings.s3Options, {
    keyPrefix: process.env.FF_S3_DEPLOYMENTS_BUCKET_PREFIX
  }));

  app.settings.deployer = require('4front-deployer')(_.extend({}, app.settings, {
    gzip: process.env.FF_GZIP_DEPLOY_ASSETS_DISABLED !== '1'
  }));
};
