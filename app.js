var express = require('express');
var http = require('http');
var debug = require('debug')('4front:aws-platform');
var _ = require('lodash');
var serveStatic = require('serve-static');
var shared = require('4front-shared');

require('simple-errors');

var app = express();
app.enable('trust proxy');
app.set('view engine', 'jade');

function initializationError(err) {
  (app.settings.logger ? app.settings.logger : console).error('App configuration error: %s', err.stack);
  return process.exit();
}

require('./lib/configure')(app, function(configErr) {
  if (configErr) {
    return initializationError(configErr);
  }

  try {
    registerRoutes();
  } catch (routeError) {
    return initializationError(routeError);
  }

  startExpressServer();
});

function registerRoutes() {
  debug('register routes');
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

  // The appHostRouter and apiRouter are also needed by the health check.
  // However the real routes cannot be mounted until after the __health endpoint.
  // Otherwise the localhost:8080 that the ELB makes the call on will result in
  // a 404 response from the apphost which will cause the servers to be deemed
  // unhealthy and taken out of service.
  var appHostRouter = require('4front-apphost')(app.settings);
  var apiRouter = require('4front-api')(app.settings);

  app.use('/__debug', shared.routes.debug(app.settings));
  app.use('/__health', shared.routes.healthCheck(app.settings, apiRouter, appHostRouter));

  // Mount the apphosting router
  app.use(appHostRouter);

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
}

// Start the express server
// Assuming that SSL cert is terminated upstream by something like Apache, Ngninx, or ELB,
// so the node app only needs to listen over http.
function startExpressServer() {
  debug('start the express server');
  var server = http.createServer(app);
  server.listen(app.settings.port, function(err) {
    if (err) {
      return initializationError(err);
    }

    app.settings.logger.info('4front platform running on port ' + app.settings.port);
  });
}
