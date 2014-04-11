/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    path = require('path'),
    partials  = require('express-partials');

var app = express();

// preview uses basic auth
if ('preview' === app.get('env')) {
  app.use(express.basicAuth(function(username, password, callback) {
    callback(null,
      (username === process.env.BASIC_AUTH_USERNAME && password === process.env.BASIC_AUTH_PASSWORD));
  }));
}

/* jshint ignore:start */
var helpers = require('./helpers')(app);
/* jshint ignore:end */

// all environments
app.set('port', process.env.PORT || 1337);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(partials());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

// Healthcheck for Nagios
app.get('/healthcheck', routes.healthcheck);

// Redirect root to transaction start page on GOV.UK
app.get('/', routes.epdq.middleware.findTransaction, routes.epdq.rootRedirect);

// EPDQ Transaction Routes.
app.get('/start', routes.epdq.middlewares, routes.epdq.start);
app.post('/confirm', routes.epdq.middleware.findTransaction, routes.epdq.confirm);
app.get('/confirm', function (req, res) { res.redirect('/start'); });
app.get('/done', routes.epdq.middleware.findTransaction, routes.epdq.done);

module.exports = app;

http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
