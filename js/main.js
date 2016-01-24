
var bg_frequency = {};
var bg_avg = {};
var bg_dates = [];
var allReadings;

// Wait for dom before loading
$(document).ready(function () {

    // Open up a pop-up page for oauth
    $("#signin").click(function () {
            $(".signin-container, #signin").css({"display": "none"});
            $("#main").css({"display": "inherit"});
        var token = prompt("Enter Token", "CnkMgGJuSYKY9LMj71ux6n4UVA5S");
        if (token !== undefined) {
            setOauthToken(token);
            window.swagger.clientAuthorizations.authz.oauth2 = new SwaggerClient.ApiKeyAuthorization("Authorization",
                            "Bearer " + getOauthToken(), "header");
            analyzeReadings();
            
        }
    });

    // Revoke token, clear it and log out
    $("#signout").click(function () {
        clearOauthToken();
        updateState("disconnected");
    });


    // Initialize swagger, point to a resource listing
    new SwaggerClient({
        url: "http://trident26.cl.datapipe.net/swagger/otr-api.yaml",
        authorizations : {

            // Required in test environment, remove this later
            httpbasic: new SwaggerClient.PasswordAuthorization("developer", "c0nn3ct"),

        },
        usePromise: true
    }).then(function (swagger) {

        // Save swagger for future use
        window.swagger = swagger;
        var token = getOauthToken();

        // Set oauth token for auth, and load data if already logged in
        if (token) {
            window.swagger.clientAuthorizations.authz.oauth2 =
            new SwaggerClient.ApiKeyAuthorization("Authorization", "Bearer " + token, "header");
             $(".signin-container, #signin").css({"display": "none"});
             $("#main").css({"display": "inherit"});
            analyzeReadings();

        // Otherwise go to disconnect state
        } else {
            updateState("disconnected");
        }

        return swagger;
    }).catch(function(error) {
        console.error("Swagger promise rejected", error);
    });
});

// Update the app to a set state
function updateState(updateStateTo){

    // Show the selected state, hide all others
    ["disconnected", "loading", "lastglucose", "noglucose"].forEach(function (state) {

        if ( updateStateTo === state ) {
            $("#" + state).removeClass("hidden");
        } else {
            $("#" + state).addClass("hidden");
        }
    });

    // Set sign in appropriately based on current state
    if (localStorage.getItem("otr.oauth.token")) {
        $("#signin").addClass("hidden");
        $("#signout").removeClass("hidden");
    } else {
        $("#signin").removeClass("hidden");
        $("#signout").addClass("hidden");
    }
}

// Get the last glucose reading from the API and update the UI
function analyzeReadings() {
    updateState("loading");
    window.swagger["Health Data"].get_v1_patient_healthdata_search({
        startDate: moment().add(-89, "d").startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        endDate:   moment().add(1, "d").startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        type:      "bloodGlucose",
        limit:     5000
    }).then(function(searchResponse){

        if (searchResponse.obj.bloodGlucose && searchResponse.obj.bloodGlucose.length > 0) {
            allReadings = searchResponse.obj.bloodGlucose;

            if (localStorage.getItem("allReadings") === null) {
                localStorage.setItem('allReadings', 
                    JSON.stringify(allReadings));
            }
            getLastReading();
            countFrequency(allReadings);
            checkAwards();
        }
    }).catch(function (error) {

        // Oauth token was invalid, clear it and go to disconnected
        if (errror.status === 401) {
            clearOauthToken();
            updateState("disconnected");

        // Pop error
        } else {
            console.error("Could not fetch readings", error);
        }
    });
}

// Keep the oauth token in local storage
function setOauthToken(token) {
    localStorage.setItem("otr.oauth.token", token);
}

// Remove the token from storage and also revoke it in the api
function clearOauthToken() {
    var token = getOauthToken();
    localStorage.removeItem("otr.oauth.token", token);
}

function getOauthToken() {
    return localStorage.getItem("otr.oauth.token");
}


function countFrequency(allReadings) {
    var currentDate;
    var dateString;
    for (var i = 0; i < allReadings.length; i++) {
        currentDate = new Date(allReadings[i].readingDate);
        dateString = currentDate.toDateString();
        if (bg_frequency.hasOwnProperty(dateString)) {
            var prev_avg = bg_avg[dateString];
            var prev_count = bg_frequency[dateString];
            bg_frequency[dateString] += 1;
            bg_avg[dateString] = ((prev_avg * prev_count + 
                allReadings[i]["bgValue"].value) / (prev_count + 1.0)).toFixed(0);
        } else {
            bg_dates.push(dateString);
            bg_frequency[dateString] = 1;
            bg_avg[dateString] = allReadings[i]["bgValue"].value;
        }
    }

    localStorage.setItem('bg_frequency', 
        JSON.stringify(bg_frequency));
    localStorage.setItem('bg_dates', 
        JSON.stringify(bg_dates));
    localStorage.setItem('bg_avg',
        JSON.stringify(bg_avg));
   
}

function getLastReading() {
    var lastReading = allReadings[allReadings.length-1];
    var lastReadingVal = lastReading["bgValue"].value;
    var lastDate = new Date(lastReading["readingDate"]);
    $("#last-reading").append("<div>" + lastDate.toDateString() + "</div>");
    console.log("hello!");
    $("#last-reading").append("<div id='bgval' class='content-padded'>" + lastReading["bgValue"].value + "</div><div>" +
        lastReading["bgValue"].units + "</div><br>");
    var numAnim = new CountUp("bgval", 24.02, lastReadingVal);
numAnim.start();
}

function checkAwards(){
    var frequency_n = 6;
    var consecutive_n = 3;

    atleastNDays(frequency_n, bg_frequency);
    atleastNConsecutiveDays(consecutive_n, bg_dates);
}


function atleastNDays(n, bg_frequency) {
    $("#winning-dates").append("<div> Days with at least " + n + " readings</div><br>");
    for (var key in bg_frequency) {
      if (bg_frequency.hasOwnProperty(key)) {
        if(bg_frequency[key] >= n) {
            $("#winning-dates").append("<p>" + key + "</p>");
        }
      }
    }
}

function atleastNConsecutiveDays(n, bg_dates) {

    var count = 0;
    var today = new Date();

    if (bg_dates[bg_dates.length-1] !== today.toDateString()) {
        count = 0;
    } else {
        for (var i=bg_dates.length-1; i > 1 ; i--) {
            var d2 = bg_dates[i];
            var d1 = bg_dates[i-1];
            
            if (Date.parse(d2) - Date.parse(d1) === 86400000)  {
                count++;
            } else {
                break;
            }
        }
    }

    console.log(count);
    if (count >= n) {
        $("#consecutive-dates").html("Your on a " + count + " day streak!");
    } else {
        $("#consecutive-dates").html("Get on track! Record for " + (n-count) + " more consecutive days!");
    }

}
