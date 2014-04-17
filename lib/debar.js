
/*!
 * Express debugging middleware
 * Copyright(c) 2014 Clifton Cunningham
 * MIT Licensed
 */

var prettyHrtime = require('pretty-hrtime'),
	express = require('express'),
	_ = require('lodash');

module.exports = function debar(app) {

  var self = this;

  function setDebugMiddleware() {
	if(app._router) {
		debugMiddleware(app);
	} else {
		process.nextTick(setDebugMiddleware);
	}
  }

  setDebugMiddleware();
  
  return function debar(req, res, next) {

	var debugData = setInitialData(req, res);
	
    next = next || noop;

	var _render = res.render;
	var _end = res.end;
	var _write = res.write;
	var _send = res.send;
	var _writeHead = res.writeHead;
	
	res.render = function (view, options, fn) {			
		_render.call(res, view, options, fn);
	};

	res.send = function (bodyOrStatus, body) {				
		if(body) return _send.call(res, bodyOrStatus, body);
		_send.call(res, bodyOrStatus);	
	};

	res.write = function (data) {		
		_write.call(res, data);
	};

	res.end = function (data, encoding) {		

		if(res._respondingRoute) {
			app._router.debug.routes[res._respondingRoute].duration = prettyHrtime(process.hrtime(app._router.debug.routes[res._respondingRoute].start), {exact:true});
		}

		data+=addDebugData(debugData);

		if(data) return _end.call(res, data, encoding);

		_end.call(res);

	};

	res.writeHead = function (code, headers) {
        res.removeHeader('Content-Length');
        if (headers) { delete headers['content-length']; }
        _writeHead.apply(res, arguments);
    };

    next();

  };
};


function setInitialData(req, res) {

	return {		
		settings: {
			etag: req.app.get('etag'),
			env: req.app.get('env'),
			viewEngine: req.app.get('view engine'),
			views: req.app.get('views'),
			poweredBy: req.app.get('x-powered-by'),
			mountPath: req.app.mountpath
		},
		application: {
			middleware: req.app._router.debug.middleware,
			routes: req.app._router.debug.routes
		}
	}
}

function debugMiddleware(app) {		

	app._router.debug = {routes:{_names:[]}, middleware:{_names:[]} };

	var mwSequence = 0, routeSequence = 0;

	app._router.stack.filter(function(item) { 					
		return item.route ? false : true;
	}).map(function(item) {			

		var _originalHandle = item.handle,
			mwName = item.handle.name;

		app._router.debug.middleware._names.push(mwName);
		app._router.debug.middleware[mwName] = {seq:mwSequence, name:mwName};

		item.handle = function(req, res, next) {

			var start = process.hrtime();

			function nextProxy(err) {
				app._router.debug.middleware[mwName].duration = prettyHrtime(process.hrtime(start), {exact:true});
				next(err);
			}

			_originalHandle.call(_originalHandle, req, res, nextProxy);	

		}

		mwSequence++;
	})

	app._router.stack.filter(function(item) { 					
		return item.route ? true : false;
	}).map(function(item) {		

		var _originalHandle = item.handle,
			routeName = (_.keys(item.route.methods) + "").toUpperCase() + " " + item.route.path;		

		app._router.debug.routes._names.push(routeName);
		app._router.debug.routes[routeName] = {seq:routeSequence, start: 0, name:routeName};		

		item.handle = function(req, res, next) {

			var start = process.hrtime();		

			res._respondingRoute = routeName;
			app._router.debug.routes[routeName].start = start;

			// This only works if the route actually calls next
			function nextProxy(err) {
				app._router.debug.routes[routeName].duration = prettyHrtime(process.hrtime(start), {exact:true});
				next(err);
			}

			_originalHandle.call(_originalHandle, req, res, nextProxy);			

		}

		routeSequence++;
	})

}

function addDebugData(debugData) {	

	var fs = require('fs'),
		debarhtml = fs.readFileSync(__dirname + "/static/debar.html"),
		debarjs = fs.readFileSync(__dirname + "/static/debar.js"),
		debarcss = fs.readFileSync(__dirname + "/static/debar.css"),
		html = "" + debarhtml + "\
				<script>\
					var debug = eval(" + JSON.stringify(debugData) + "\
				);\
				</script>\
				<script>\
					" + debarjs + "\
				</script>\
				<style>\
					" + debarcss + "\
				</style>\
				";

	return html;

}

function noop() {};