var express = require('express');
var debug = require('debug')('4front:aws-platform');
var _ = require('lodash');
var serveStatic = require('serve-static');
var shared = require('4front-shared');

require('simple-errors');

var app = express();
app.enable('trust proxy');
app.set('view engine', 'jade');

require('./lib/configure')(app);

app.use(app.settings.logger.middleware.request);

// No harm in parsing cookies on all requests. But intentionally
// not parsing the body as the express-request-proxy needs the
// raw body to passthrough. The body-parser can be declared at the
// level in the middleware stack where it is needed.
app.use(require('cookie-parser')());

// Initialize the extended request object
app.use(function(req, res, next) {
  req.ext = {};
  next();
});

// The httpHostRouter and apiRouter are also needed by the health check.
// However the real routes cannot be mounted until after the __health endpoint.
// Otherwise the localhost:8080 that the ELB makes the call on will result in
// a 404 response from the http-host which will cause the servers to be deemed
// unhealthy and taken out of service.
var httpHostRouter = require('4front-http-host')(app.settings);
var apiRouter = require('4front-api')(app.settings);

app.use('/__debug', shared.routes.debug(app.settings));
app.use('/__health', shared.routes.healthCheck(app.settings, apiRouter, httpHostRouter));

// Mount the http-host router
app.use(httpHostRouter);

// Mount the api router
app.use('/api', apiRouter);

var portal;
// For ease of development on portal
if (process.env.FF_DEV_LOCAL_PORTAL) {
  debug('using local filesystem portal');
  portal = require('../../4front/portal');
} else {
  portal = require('4front-portal');
}

app.use('/portal', portal(_.extend({}, app.settings, {
  basePath: '/portal',
  apiUrl: '/api'
})));

// Deliberately register the static middleware after all the other routes
app.use(serveStatic('public/', {fallthrough: true, index: false}));

app.get('/', function(req, res, next) {
  debug('root request');
  if (req.hostname !== app.settings.virtualHost) return next();

  res.redirect('/portal');
});

app.use(shared.routes.catchAll(app.settings));

app.use(shared.routes.error(app.settings));

debug('start the express server');
app.listen(app.settings.port, function() {
  debug('server listening on port ' + app.settings.port);
});
