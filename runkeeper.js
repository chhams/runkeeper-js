var _ = require('underscore');
var http = require('http');
var async = require('async');
var bearer_chris = require('./token');
var bearer_jessi = require('./token_j');
var request = require('request');
var restify = require('restify');
var fs = require('fs');


var m2012 = [0,0,0,0,0,0,0,0,0,0,0,0];
var m2013 = [0,0,0,0,0,0,0,0,0,0,0,0];
var m2014 = [0,0,0,0,0,0,0,0,0,0,0,0];

var t2012 = [0,0,0,0,0,0,0,0,0,0,0,0];
var t2013 = [0,0,0,0,0,0,0,0,0,0,0,0];
var t2014 = [0,0,0,0,0,0,0,0,0,0,0,0];

var api_domain = "api.runkeeper.com";
var dataStuff;
var chartStuff;
var items = [];

var loadFile = function(name, cb){
    fs.readFile(name, 'utf8', function (err,data) {
        if (err) {
            return console.log(err);
        }
        cb(JSON.parse(data));
    });
}

var saveFile = function(name, data){
    fs.writeFile(name, JSON.stringify(data),function (err){
        console.log(err);
    })
}

fs.readFile('other.html', 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    dataStuff = data;
});

fs.readFile('barTest.html', 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    chartStuff = data;
});

var callApi = function(endpoint, bearer, callback) {
    var request_details = {
        method: 'GET',
        headers: {'Accept': '*\/*',
            'Authorization' : 'Bearer ' + bearer},
        uri: "https://" + api_domain + endpoint
    };
    console.log('before request')
    request(request_details, function(error, response, body) {
        console.log(error)
        console.log(response)
        console.log(body)
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
    item.day = new Date(item.start_time).getDay();
    item.date = item.year + '-' + item.month;
    item.shortdate = item.year + '-' + item.month;
    item.fulldate = item.year + '-' + item.month + '-' + item.day;
};

var fillByMonth = function(items){
    console.log('filling')
    var found = false;
    itemsByMonth = [];
    _.each(items, function(item){
        console.log('doing item ' + item.date);
        found = false;
        _.each(itemsByMonth, function(itemByMonth){
            if(item.shortdate === itemByMonth.shortdate){
                found = true;
                itemByMonth.itemcount = itemByMonth.itemcount + 1;
                itemByMonth.duration += item.duration;
                itemByMonth.total_median += item.median;
            }

        })

        if(!found){
            var itemByMonth = _.clone(item);
            itemByMonth.itemcount = 1;
            itemByMonth.total_median = item.median;
            itemByMonth.sortByString = (item.year * 1000 + item.month);
            delete itemByMonth.day;
            delete itemByMonth.date;
            itemsByMonth.push(itemByMonth);
        }
    })

    return itemsByMonth.sort(compareByMonth);

}

var reduceByMonth = function(items){
    for (var i = 0; i < items.length; ++i) {
        if(items[i].year === 2012){
        	m2012[items[i].month -1] += items[i].total_distance /1000;
		t2012[items[i].month -1] += items[i].duration / 60;
        }
	if(items[i].year === 2013){
        	m2013[items[i].month -1] += items[i].total_distance /1000;
		t2013[items[i].month -1] += items[i].duration / 60;
        }
        if(items[i].year === 2014){
        	m2014[items[i].month -1] += items[i].total_distance /1000;
		t2014[items[i].month -1] += items[i].duration / 60;
        }
    }
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

var compareByMonth = function ( a,b) {
    if (a.sortByString > b.sortByString)
        return -1;
    if (a.sortByString < b.sortByString)
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
};

var loadRunData = function(bearer, cb){

callApi('/fitnessActivities?page=0&pageSize=200', bearer, function(err, body){
    console.log(err);
    console.log(body)

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

        callApi(item.uri, bearer, function (err2, itemBody){
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
            cb();
        });
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

	reduceByMonth(items);

    saveFile(bearer, items);


	cb();
    })
});
};

var displayData = function(){
	var html = dataStuff;
	var htmlStuff = '';

    var htmlStuff = '<thead><tr>';
    htmlStuff += '<th>Route</th>';
    htmlStuff += '<th>Date</th>';
    htmlStuff += '<th>Year</th>';
    htmlStuff += '<th>Duration</th>';
    htmlStuff += '<th>Duration - seconds</th>';
    htmlStuff += '<th>Distance - Median</th>';
    htmlStuff += '  <th>Distance - GPS</th>';
    htmlStuff += ' <th>Off</th>';
    htmlStuff += ' <th>km/h</th>';
    htmlStuff += '</tr></thead><tbody>';

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
            htmlStuff += '<td>' + Math.floor(item.median) / 1000 + '</td>';
            htmlStuff += '<td>' + Math.floor(item.total_distance) / 1000 + '</td>';
            htmlStuff += '<td>' + Math.floor(difference(item.median, item.total_distance)) / 1000 + '</td>';
            htmlStuff += '<td>' + Math.floor((item.median / item.duration) * 3.6 * 100) / 100+ '</td>';
	    htmlStuff += '</tr>';

        });

    htmlStuff += '</tbody>';

 	html = html.replace('<REPLACE>',htmlStuff);

	return html;
};

var getTableHeader = function(headers){
    var htmlStuff = '<thead><tr>';
    _.each(headers, function(head){
        htmlStuff += '<th>' + head + '</th>';
    });
    htmlStuff += '</tr></thead>';
}

var displayDataGrouped = function(cb){
    var html = dataStuff;
    var htmlStuff = '';

    var htmlStuff = '<thead><tr>';
    htmlStuff += '<th>Year-Month</th>';
    htmlStuff += '<th>Activities</th>';
    htmlStuff += '<th>Duration - seconds</th>';
    htmlStuff += '<th>Duration</th>';
    htmlStuff += '<th>Distance</th>';
    htmlStuff += '<th>Average Distance</th>';
    htmlStuff += ' <th>km/h</th>';
    htmlStuff += '</tr></thead><tbody>';

    var last2;

    loadFile(bearer_chris, function(it){
        var r = fillByMonth(it);

        _.each(r, function(item){
            if(last2 && last2.route !== item.route){
                //htmlStuff += ' --- --- --- <br>';
            };
            last2 = item;

            htmlStuff += '<tr>';
            htmlStuff += '<td>' + item.shortdate + '</td>';
            htmlStuff += '<td>' + item.itemcount + '</td>';
            htmlStuff += '<td>' + Math.floor(item.duration) + '</td>';
            htmlStuff += '<td>' + convertToTime(item.duration) + '</td>';
            htmlStuff += '<td>' + Math.floor(item.total_median ) / 1000 + '</td>';
            htmlStuff += '<td>' + (Math.floor(item.total_median / item.itemcount) / 1000) + '</td>';
            htmlStuff += '<td>' + Math.floor((item.total_median / item.duration) * 3.6 * 100) / 100+ '</td>';
            htmlStuff += '</tr>';

        });

        htmlStuff += '</tbody>';

        html = html.replace('<REPLACE>',htmlStuff);

        cb(html);
    })

};


var displayChart = function(){
	var html = chartStuff;

 	html = html.replace('<REPLACE1>','[' + m2012 +']');
 	html = html.replace('<REPLACE2>','[' + m2013 +']');
 	html = html.replace('<REPLACE3>','[' + m2014 +']');

	return html;
};

module.exports.loadRunData = loadRunData;
module.exports.displayData = displayData;
module.exports.displayDataGrouped = displayDataGrouped;
module.exports.displayChart = displayChart;
