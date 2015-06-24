var _ = require('lodash');
var path = require('path');
var AWS = require('aws-sdk');
var redis = require('redis');
var session = require('express-session');
var debug = require('debug')('nordstrom:4front:configuration');
var S3Storage = require('4front-s3-storage');
var DynamoDb = require('4front-dynamodb');

require('redis-streams')(redis);

module.exports = function(app, localInstance) {
  _.extend(app.settings, {
    localInstance: localInstance,
    port: process.env.PORT || 1903,
    // The virtual host is the domain that the platform runs, i.e. "myapphost.com"
    virtualHost: process.env['FF_VIRTUAL_HOST'],
    pluginsDir: path.resolve(__dirname, "../plugins"),
    jwtTokenSecret: process.env['FF_JWT_TOKEN_SECRET'],
    jwtTokenExpireMinutes: parseInt(process.env['FF_JWT_TOKEN_EXPIRE'] || "30"),
    sessionSecret: process.env['FF_SESSION_SECRET'],
    awsRegion: process.env['AWS_REGION'] || 'us-west-2',

    // This is the default environment when there is no virtual environment name
    // specified in the URL, i.e. appname.webapps.nordstrom.net. This is only when
    // there is not a virtual environment specified like so:
    // appname--test.webapps.nordstrom.net.
    defaultVirtualEnvironment: process.env['FF_DEFAULT_ENV'] || 'production',

    cryptoPassword: process.env['FF_CRYPTO_PASSWORD'],

    // Normally this would be an absolute S3 url or a CDN whose origin is set to
    // the S3 bucket, but for 4front local just serving static assets out of
    // the same Express app.
    staticAssetPath: process.env['FF_STATIC_ASSET_PATH'],

    // TODO: This should live in a JSON file
    starterTemplates: [
      {
        name: 'React Startify',
        description: 'React JS application skeleton using Browserify, Gulp, and ES6',
        url : 'https://github.com/4front/react-starterify/archive/master.zip'
      }
    ]
  });

  app.settings.dynamoOptions = {
    region: app.settings.awsRegion,
    tablePrefix: '4front_',
    cryptoPassword: app.settings.cryptoPassword
  };

  app.settings.s3Options = {
    region: app.settings.awsRegion,
    bucket: process.env['FF_S3_DEPLOYMENTS_BUCKET']
  };

  // If this is a local instance, override config settings to simulate
  // the real AWS resources.
  if (localInstance === true) {
    require('./local')(app);
  }
  else {
    var ldapIdentityProvider = require('4front-ldap-auth')({
      ldap: {
        url: process.env.FF_LDAP_URL,
        baseDN: process.env.FF_LDAP_BASE_DN,
      },
      usernamePrefix: process.env.FF_LDAP_USERNAME_PREFIX
    });

    // Configure ldap as the identity provider
    app.settings.identityProviders = [ldapIdentityProvider];
  }

  // other settings: sessionUserKey
  app.settings.database = new DynamoDb(app.settings.dynamoOptions);

  // Assuming redis is listening on default port
  // app.settings.cache = memoryCache();
  app.settings.cache = redis.createClient(
      process.env['FF_REDIS_PORT'] || 6379,
  		process.env['FF_REDIS_HOST'] || "127.0.0.1"
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

  app.settings.deployer = require('4front-deployer')(app.settings);

  app.settings.logger = require('4front-logger')({
    logger: '4front-logger'
  });
};
