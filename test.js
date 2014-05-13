var request = require('request');
var api_domain = "api.runkeeper.com";
var _ = require('underscore');
var bearer = 'todo';

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

callApi('/fitnessActivities?page=0&pageSize=200', function(err, body){
	var items = body.items;
	var totalDistance = 0;
	var totalTime = 0;

	_.each(items, function(item){
		totalTime += item.duration;
		totalDistance += item.total_distance;

		/*callApi(item.uri, function (err2, itemBody){
                	console.log(itemBody);
			console.log('--- --- ---');
		});*/
	}) 
	//console.log(items);
	console.log('Total Distance: ' + totalDistance / 1000 + ' km' );
	console.log('Total Time: ' + totalTime /60 + ' min' );
	console.log('Average: ' + (totalDistance / totalTime) * 3.6 + ' km\/h');
	console.log('ItemCount: ' + items.length);
});
