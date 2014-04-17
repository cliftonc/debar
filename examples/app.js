var express = require('express');
var app = express();
var debar = require('../lib/debar.js');

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use(debar(app));

app.disable('etag');

app.get('/', function index(req, res){
  res.render('index',{hello:"Hello World"});
});

app.post('/test', function index(req, res){
  res.render('index',{hello:"Hello World"});
});

app.get('/test/:a', function test(req, res) {
  res.render('index', {hello: 'Goodbye cruel world'});
});

app.listen(3000);

console.log("Example app server listening on http://localhost:3000/");