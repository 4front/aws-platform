var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var debug = require('debug')('4front:local');

require('simple-errors');

// Apply configuration overrides for running in local mode
module.exports = function(app) {
	debug("applying local config overrides");

	_.extend(app.settings.dynamoOptions, {
		accessKeyId: '4front',
		secretAccessKey: '4front',
		endpoint: 'http://localhost:8000'
	});

	var ldapIdentityProvider = require('4front-ldap-auth')({
		ldap: {
			url: process.env.FF_LDAP_URL,
			baseDN: process.env.FF_LDAP_BASE_DN,
		},
		usernamePrefix: process.env.FF_LDAP_USERNAME_PREFIX
	});

	// Local identity provider to use as a stand-in for LDAP
	//TODO: Use a http basic password file for auth
	//https://www.npmjs.com/package/ht-auth
	var localIdentityProvider = {
    providerName: 'local',
    default: true,
    authenticate: function(username, password, callback) {
      // Always authenticate successfully
      if (_.isEmpty(username) || password !== '4front')
        callback(Error.create({code: 'invalidCredentials'}));

      callback(null, {userId: username, username: username});
    },
		getUserId: function(username, callback) {
			// Make ther providerUserId the same as the username
			callback(null, username);
		}
  };

	// Configure ldap as the identity provider
	app.settings.identityProviders = [localIdentityProvider];

	fakeS3Server();

	function fakeS3Server() {
		_.extend(app.settings.s3Options, {
			// These values don't actually matter for the fake S3 server
			accessKeyId: "4front",
			secretAccessKey: "4front",
			endpoint: "localhost:4658",
			sslEnabled: false,
			s3ForcePathStyle: true
		});

		var fakeBucket = 'fake-s3-bucket';
		process.env.FF_S3_DEPLOYMENTS_BUCKET = fakeBucket;

		// Ensure the fake-s3-bucket directory exists
		try {
			fs.mkdirSync(path.resolve(__dirname, "../fake-s3-bucket"));
		}
		catch (err) {}

		// Use s3rver as a stand-in for S3
		var S3rver = require('s3rver');
		new S3rver()
			.setHostname('localhost')
			.setPort(4658)
			.setSilent(true)
			.setDirectory(path.resolve(__dirname, '..'))
			.run(function() {
				app.settings.logger.info("S3rver started");
			});
	}
};
