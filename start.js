var runkeeper = require('./lib/runkeeper');

// Create a Client
var client = new runkeeper.HealthGraph({});
var test = '';
var access = '';

client.getNewToken(test, function(err, access_token) {

    console.log('Starting...');

    // If an error occurred during the Access Token request, handle it. For the example, we'll just output it and return false.
    if(err) { console.log(err); return false; }
		
    console.log(access_token);

    // Set the client's Access Token. Any future API Calls will be performed using the authorized user's access token. 
    client.access_token = access_token;

    // Usually, you'll want to store the access_token for later use so that you can set it upon initialization of the Client

    // Example: Get user's Profile information
    client.profile(function(err, reply) {
        if(err) { console.log(err); }

        // Do whatever you need with the API's reply.
        console.log(reply);
    });
})


