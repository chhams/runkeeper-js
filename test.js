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


callApi('/fitnessActivities?page=0&pageSize=200', function(err, body){
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
		_.each(items, function(item){
			
			if(lastI && lastI.route !== item.route){
				console.log('Median: ' + median(mediaCalc) + ' Average: ' + mediaCalc.map(function(x,i,arr){return x/arr.length}).reduce(function(a,b){return a + b}));
				console.log(' --- --- --- '); //Average Distance: ' + (routeDistance / nextCount));
				mediaCalc = [];
			}
			mediaCalc.push(item.total_distance);
			lastI = item;
			console.log(item.route + ' ' +  item.start_time  + ' TIME: ' + 
				convertToTime(item.duration) + ' ' + item.duration + ' ' + item.total_distance + 
				' Average: ' + (item.total_distance / item.duration) * 3.6 + ' km\/h');
		});
	})

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



