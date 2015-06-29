var express = require('express');
var http = require('http');
var fs = require('fs');
var path = require('path');
var favicon = require('serve-favicon');
var debug = require('debug')('4front:aws-platform');
var _ = require('lodash');
var ChildProcess = require('child_process');
var log = require('4front-logger');
var serveStatic = require('serve-static')
var cookieParser = require('cookie-parser');

var app = express();
app.enable('trust proxy');
app.set('view engine', 'jade');

var localInstance = process.env.NODE_ENV === 'development';

try {
  require('./lib/configuration')(app, localInstance);
}
catch (err) {
  console.error("App configuration error %s", err.stack);
  process.exit();
}

app.use(favicon(path.join(__dirname, './public/images/favicon.ico')));

// Static assets. Can be cached for a long time since every asset is
// fingerprinted with versionId.
app.get('/deployments/:appId/:versionId/*', function(req, res, next) {
  var filePath = req.params[0];

  app.settings.deployer.serve(req.params.appId,
    req.params.versionId, filePath, res);
});

// Putting this after the deployment static asset path
// to avoid flooding logs with js and css requests.
app.use(app.settings.logger.middleware.request);

app.use(cookieParser());

// Initialize the extended request object
app.use(function(req, res, next) {
  req.ext = {};
  next();
});

// The virtual app host subapp. Needs to come first
// in the router pipeline.
app.use(require('4front-apphost')());

app.get('/', function(req, res) {
  res.send("4front Web App Platform");
});

app.use("/api", require('4front-api')(app.settings));

var portal;
// For ease of development on portal
if (process.env.FF_DEV_LOCAL_PORTAL) {
  debug("using local filesystem portal");
  portal = require('../../4front/portal');
}
else
  portal = require('4front-portal');

app.use("/portal", portal(_.extend({}, app.settings, {
  basePath: '/portal',
  apiUrl: '/api'
})));

// Deliberately register the static middleware after all the other routes
app.use(serveStatic('public/', {fallthrough: true, index: false}));

app.all('*', function(req, res, next) {
  // If we fell all the way through, then raise a 404 error
  next(Error.http(404, "Page not found"));
});

// Register the error middleware together with middleware to display the error page.
// This is the most reliable way I've found to reliably log the error first before
// the error page rendering middleware steals final control.
app.use(function(err, req, res, next) {
  app.settings.logger.middleware.error(err, req, res, function() {
    debug("last chance error page middleware %s", err.stack);

    var errorJson = Error.toJson(err);

    if (process.env.NODE_ENV !== 'development')
      errorJson = _.pick(errorJson, 'message', 'code');

    res.set('Cache-Control', 'no-cache');

    if (!err.status)
      err.status = 500;

    res.statusCode = err.status;

    if (req.xhr)
      return res.json(errorJson);

    var errorView;
    if (req.ext)
      errorView = req.ext.customErrorView;

    if (!errorView)
      errorView = path.join(__dirname + '/views/error.jade');

    res.render(errorView, errorJson);
  });
});

// app.use('/debug', require('4front-debug'));
// app.use('/debug', function(req, res, next) {
//   res.json(app.settings.cache.keys);
// });

// TODO: Run a series of diagnostic tests to ensure connectivity to all required
// AWS resources including DynamoDB, Redis, and S3

// Start the express server
// Assuming that SSL cert is terminated upstream by something like Apache, Ngninx, or ELB,
// so the node app only needs to listen over http.
debug("start the express server");
var server = http.createServer(app);
return server.listen(app.settings.port, function(err){
  if (err) return callback(err);

  app.settings.logger.info("4front platform running on port " + app.settings.port);
});
