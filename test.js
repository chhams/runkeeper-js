var _ = require('underscore');
var http = require('http');
var async = require('async');
var bearer = require('./token');
var request = require('request');

var api_domain = "api.runkeeper.com";
var testArray2013 = [];
var testArray2014 = [];
var dataStuff;

//bad code following: 

var fs = require('fs')
fs.readFile('test.html', 'utf8', function (err,data) {
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



callApi('/fitnessActivities?page=0&pageSize=20', function(err, body){
	var items = body.items;

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

		//console.log('Run ' + counter-- + ' ' + item.total_distance);
		//console.log(item);
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
            console.log(item.total_distance + ' ' + item.maxLat + ' ' + item.maxLong + ' ' + item.minLat + ' ' + item.minLong);
            cb();
		});
        //console.log('Test: ' + item.duration);
	}, function(err){console.log('Done')})

	//reduceByMonth(items);

	//console.log(items);
	console.log('');
	console.log('Total Distance: ' + totalDistance / 1000 + ' km' );
	console.log('Total Time: ' + totalTime /60 + ' min' );
	console.log('Average: ' + (totalDistance / totalTime) * 3.6 + ' km\/h');
	console.log('ItemCount: ' + items.length);
	console.log('');
	
	/*var last;
	var distance = 0;
	_.each(durations.sort(),function(entry){
 		if(last){
			distance = entry - last;
		}
		console.log(entry + '   ' + distance);
		last = entry;
	})*/
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



