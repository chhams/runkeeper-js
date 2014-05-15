var _ = require('underscore');
var http = require('http');
var async = require('async');
var bearer = require('./token');
var request = require('request');
var restify = require('restify');
var fs = require('fs')


var api_domain = "api.runkeeper.com";
var dataStuff;
var items = []

fs.readFile('other.html', 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    dataStuff = data;
});

var callApi = function(endpoint, callback) {
    var request_details = {
        method: 'GET',
        headers: {'Accept': '*\/*',
            'Authorization' : 'Bearer ' + bearer},
        uri: "https://" + api_domain + endpoint
    };
    request(request_details, function(error, response, body) {
        try {
            parsed = JSON.parse(body);
        } catch(e) {
            error = new Error('Body reply is not a valid JSON string.');
            error.runkeeperBody = body;
        } finally {
            callback(error, parsed);
        }
    });
};

var mapByMonth = function(item){
    item.month = new Date(item.start_time).getMonth() + 1;
    item.year = new Date(item.start_time).getFullYear();
    item.date = item.year + '-' + item.month;
};

var reduceByMonth = function(items){
    var x = {};

    for (var i = 0; i < items.length; ++i) {
        if(items[i].year === 2013){
            if(testArray2013[items[i].month -1] == undefined){
                testArray2013[items[i].month -1] = items[i].total_distance /1000;
            }
            else{
                testArray2013[items[i].month -1] += items[i].total_distance /1000;
            }

        }

        if(items[i].year === 2014){
            if(testArray2014[items[i].month -1] == undefined){
                testArray2014[items[i].month -1] = items[i].total_distance /1000;
            }
            else{
                testArray2014[items[i].month -1] += items[i].total_distance /1000;
            }

        }


        var obj = items[i];

        if (x[obj.date] == undefined){
            x[obj.date] = obj.total_distance /1000;
        }else{
            x[obj.date] = x[obj.date] += obj.total_distance / 1000;

        }
    }
    console.log('ARRAY')
    console.log(x);
}



var difference = function (a, b) { return Math.abs(a - b) }

var compare = function ( a,b) {
    if (a.routeId < b.routeId)
        return -1;
    if (a.routeId > b.routeId)
        return 1;
    if (a.duration < b.duration)
        return -1;
    if (a.duration > b.duration)
        return 1;
    return 0;
}

function median(values) {

    values.sort( function(a,b) {return a - b;} );

    var half = Math.floor(values.length/2);

    if(values.length % 2)
        return values[half];
    else
        return (values[half-1] + values[half]) / 2.0;
}


var convertToTime = function (mySeconds) {
    var sec_num = parseInt(mySeconds, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
}

var isItemSame = function(item1, item2){
    var totalDifference = 0;
    totalDifference += difference(item1.maxLat, item2.maxLat);
    totalDifference += difference(item1.minLat, item2.minLat);
    totalDifference += difference(item1.maxLong, item2.maxLong);
    totalDifference += difference(item1.minLong, item2.minLong);

    if(totalDifference > 0.002){
        return false;
    }
    return true;
    //console.log('Total diff: ' + totalDifference + ' for ' + item1.total_distance + ' vs ' + item2.total_distance);
};

var loadRunData = function(cb){

callApi('/fitnessActivities?page=0&pageSize=200', function(err, body){
    items = body.items;

    var totalDistance = 0;
    var totalTime = 0;
    var counter = body.items.length;
    var durations = [];

    async.each(items, function(item, cb){
        mapByMonth(item);


        totalTime += item.duration;
        totalDistance += item.total_distance;
        durations.push(item.total_distance);

        item.maxLong = 0;
        item.maxLat = 0;
        item.minLong = 100;
        item.minLat = 100;

        callApi(item.uri, function (err2, itemBody){
            _.each(itemBody.path, function(pp){
                if(pp.longitude > item.maxLong){
                    item.maxLong = pp.longitude;
                }
                if(pp.latitude > item.maxLat){
                    item.maxLat = pp.latitude;
                }
                if(pp.longitude < item.minLong){
                    item.minLong = pp.longitude;
                }
                if(pp.latitude < item.minLat){
                    item.minLat = pp.latitude;
                }

            });
            //console.log('TESTING ITEMS');
            //console.log(itemBody);
            // og('--- --- ---');
            //console.log(item.total_distance + ' ' + item.maxLat + ' ' + item.maxLong + ' ' + item.minLat + ' ' + item.minLong);
            cb();
        });
        //console.log('Test: ' + item.duration);
    }, function(err){

        var counti = 1;
        _.each(items, function(item1){
            _.each(items, function(item2){
                if(isItemSame(item1,item2) && item2.route){
                    item1.routeId = item2.routeId;
                    item1.route = item2.route;
                }
            });

            if(!item1.route){
                item1.routeId = counti;
                item1.route = 'Route ' + counti++;
            };
        });

        items.sort(compare);

        var lastI;
        var mediaCalc = [];
        var itemContainer = []
        _.each(items, function(item){

            if(lastI && lastI.route !== item.route){

                _.each(itemContainer, function(ic){
                    ic.median = median(mediaCalc);
                    ic.average = mediaCalc.map(function(x,i,arr){return x/arr.length}).reduce(function(a,b){return a + b});
                });

                mediaCalc = [];
                itemContainer = [];
            }
            mediaCalc.push(item.total_distance);
            itemContainer.push(item);
            lastI = item;

        });

	_.each(itemContainer, function(ic){
		ic.median = median(mediaCalc);
                ic.average = mediaCalc.map(function(x,i,arr){return x/arr.length}).reduce(function(a,b){return a + b});
        });

	cb();



    })


});

};

var displayData = function(){
	 var html = dataStuff;

	var htmlStuff = '';
	//var htmlStuff = '<!DOCTYPE html><html><head><title>My Title</title></head><body>';
	
	//htmlStuff += '<br>'
        //htmlStuff += 'Total Distance: ' + totalDistance / 1000 + ' km' +'\n';
    	//htmlStuff +='Total Time: ' + totalTime /60 + ' min' +'\n';
    	//htmlStuff +='Average: ' + (totalDistance / totalTime) * 3.6 + ' km\/h'+'\n';
    	//htmlStuff +='ItemCount: ' + items.length +'<br>';
    	//htmlStuff += '<br>'

	var last2;
        _.each(items, function(item){
            if(last2 && last2.route !== item.route){
                //htmlStuff += ' --- --- --- <br>';
            };
            last2 = item;

	    htmlStuff += '<tr>';
            htmlStuff += '<td>' + item.route + '</td>';
            htmlStuff += '<td>' + item.start_time + '</td>';
            htmlStuff += '<td>' + item.year + '</td>';
            htmlStuff += '<td>' + convertToTime(item.duration) + '</td>';
            htmlStuff += '<td>' + item.duration + '</td>';
            htmlStuff += '<td>' + Math.floor(item.median) + '</td>';
            htmlStuff += '<td>' + Math.floor(item.total_distance) + '</td>';
            htmlStuff += '<td>' + Math.floor(difference(item.median, item.total_distance)) + '</td>';
            htmlStuff += '<td>' + (item.median / item.duration) * 3.6 + '</td>';
	    htmlStuff += '</tr>';

        });

 	html = html.replace('<REPLACE>',htmlStuff);

	return html;// + '</body></html>';

};


function respondReload(req, res, next) {
  res.send('loading data...');
  console.log('loading...');

  loadRunData(function(){ 
	console.log('done')
	res.send('done');
  });

	
}

function respondData(req, res, next) {
	res.writeHead(200, {
  'Content-Length': Buffer.byteLength(displayData()),
  'Content-Type': 'text/html'
});
res.write(displayData());
res.end();

  //res.send(displayData());
}

var server = restify.createServer();
server.get('/runkeeper/reload', respondReload);
server.get('/runkeeper/data', respondData);

server.listen(3333, function() {
  console.log('%s listening at %s', server.name, server.url);
});


/*
 http.createServer(function (request, response) {

 response.writeHead(200, { 'Content-Type': 'text/html' });

 console.log(testArray2013);

 var html = dataStuff;

 html = html.replace('REPLACE_ME_2013','[' + testArray2013 + ']');
 html = html.replace('REPLACE_ME_2014','[' + testArray2014 + ']');

 response.end(html, 'utf-8');

 }).listen(1234);
 */



