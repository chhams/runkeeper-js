var restify = require('restify');
var runkeeper = require('./runkeeper');

var bearer_chris = require('./token');
var bearer_jessi = require('./token_j');

function respondReload(req, res, next) {
    res.send('loading data...');
    console.log('loading...');

    runkeeper.loadRunData(bearer_chris, function(){
        console.log('done')
        res.send('done');
    });
}

function respondReloadJessi(req, res, next) {
    res.send('loading data...');
    console.log('loading...');

    runkeeper.loadRunData(bearer_jessi, function(){
        console.log('done')
        res.send('done');
    });
}

function respondData(req, res, next) {
    var data = runkeeper.displayData();
    res.writeHead(200, {
        'Content-Length': Buffer.byteLength(data),
        'Content-Type': 'text/html'
    });
    res.write(data);
    res.end();
}

function respondDataG(req, res, next) {
    runkeeper.displayDataGrouped(function(data){
        res.writeHead(200, {
            'Content-Length': Buffer.byteLength(data),
            'Content-Type': 'text/html'
        });
        res.write(data);
        res.end();
    });
}

function respondChart(req, res, next) {
    var data = runkeeper.displayChart();
    res.writeHead(200, {
        'Content-Length': Buffer.byteLength(data),
        'Content-Type': 'text/html'
    });
    res.write(data);
    res.end();
}

var server = restify.createServer();
server.get('/runkeeper/reload', respondReload);
server.get('/runkeeper/reload2', respondReloadJessi);
server.get('/runkeeper/data', respondData);
server.get('/runkeeper/data2', respondDataG);
server.get('/runkeeper/chart', respondChart);

server.listen(3333, function() {
    console.log('%s listening at %s', server.name, server.url);
});