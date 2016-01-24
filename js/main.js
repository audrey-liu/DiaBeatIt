
var bg_frequency = {};
var bg_avg = {};
var bg_dates = [];
var allReadings;
var week_offset = 0;

// Wait for dom before loading
$(document).ready(function () {
    
    // Open up a pop-up page for oauth
    $("#signin").click(function () {
        var token = prompt("Enter Token", "CnkMgGJuSYKY9LMj71ux6n4UVA5S");

        if (token !== undefined) {
            setOauthToken(token);
            window.swagger.clientAuthorizations.authz.oauth2 = new SwaggerClient.ApiKeyAuthorization("Authorization",
                            "Bearer " + getOauthToken(), "header");
            analyzeReadings();
            updateUI();
        }
    });

    // Revoke token, clear it and log out
    $("#signout").click(function () {
        clearOauthToken();
        updateState("disconnected");
    });

    
    function updateUI() {
        
            var clicked = false;
    $(".fa-ellipsis-v").click(function(){
        if (clicked == false){
            $("#signout").fadeIn("fast");
            clicked = true;
        } else {
            $("#signout").fadeOut("fast");
            clicked = false;
        }
        
    });

    $("#signout").click(function(){
        $(this).fadeOut("fast");
          localStorage.removeItem("otr.oauth.token");
        console.log(localStorage.getItem("otr.oauth.token"));
        updateState("disconnected");
        location.reload();
        $(".signin-container, #signin").fadeIn("slow");
        
    })
        console.log("hi!")
        $(".signin-container, #signin").css({"display": "none"});
        $("#main").css({"display": "inherit"});
        $(".fa-ellipsis-v").css({"opacity":"1"});
        
        
    }

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
            analyzeReadings();
            updateUI();

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
        $(".signin-container").fadeOut();
        $(".fa-ellipsis-v").fadeIn();
    } else {
        $("#signin").removeClass("hidden");
        $("#signout").addClass("hidden");
        $(".signin-container").fadeIn();
        $(".fa-ellipsis-v").fadeOut();
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

function past_week(){
    week_offset -= 1;
    update_graph_week();
}

function next_week(){
    if(week_offset < 0) {
        week_offset += 1;
        update_graph_week();
    }
}

function update_graph_week() {
    var week_data;
    if (onFrequency) {
        week_data = get_freqs_x_week();
    } else {
        week_data = get_avgs_x_week();
    }
    var points = myNewChart["datasets"][0]["points"];
    console.log(points.length);
    for (var i = 0; i < points.length; i++) {
        points[i].value = week_data[i];
    }
    myNewChart.update();
}

function get_avgs_x_week(){
    var dates = get_dates_diff_week(week_offset);
    if(week_offset == 0) {
        return this_week_avg(bg_avg, bg_dates);
    } else {        
        return get_avgs_for_dates(dates);
    }
    
}

function get_freqs_x_week(){
    var dates = get_dates_diff_week(week_offset);
    if(week_offset == 0) {
        return this_week_frequency(bg_frequency, bg_dates);
    } else {        
        return get_freqs_for_dates(dates);
    }
}

function get_dates_diff_week(week_diff){
    var DayLength = 86400000;
    var now = new Date();
    var today = new Date(now - (now.valueOf() % DayLength) + (5.0/24) * DayLength);
    wkday = today.getDay();
    var end_time = today.valueOf() - ((wkday - 1) * DayLength) - 1;
    var start_time = today.valueOf() - ((wkday + 6) * DayLength);
    var week_adjustment = (week_diff + 1) * 7 * DayLength;
    var Sunday = new Date(end_time + week_adjustment);
    var Monday = new Date(start_time + week_adjustment);
    dates = [];
    date_array = JSON.parse(localStorage.getItem("bg_dates"));
    for (var d = 0; d < date_array.length; d++){
        date = new Date(date_array[d]);
        if (date < Monday)
            continue;
        if (date > Sunday)
            return dates;
        else
            dates.push(date_array[d]);
    }
    return dates;
}


function get_avgs_for_dates(dates){
    var daily_avgs = JSON.parse(localStorage.getItem("bg_avg"));
    var avgs = [0,0,0,0,0,0,0];
    for (var i = 0; i < dates.length; i++){
        if (daily_avgs[dates[i]])
            avgs[i] = daily_avgs[dates[i]];
    }
    return avgs;
}

function get_freqs_for_dates(dates){
    var daily_avgs = JSON.parse(localStorage.getItem("bg_frequency"));
    var avgs = [0,0,0,0,0,0,0];
    for (var i = 0; i < dates.length; i++){
        if (daily_avgs[dates[i]])
            avgs[i] = daily_avgs[dates[i]];
    }
    return avgs;
}

function get_avgs_for_week(){
    var DayLength = 86400000;
    var now = new Date();
    var today = new Date(now - (now.valueOf() % DayLength) + (5.0/24) * DayLength);
    var wkday = (7 + (-1 + today.getDay())) % 7;
    var end_time = today.valueOf() - (wkday * DayLength) - 1;
    var start_time = today.valueOf() - ((wkday + 7) * DayLength);
    var week_adjustment = (week_offset + 1) * 7 * DayLength;
    var Sunday = new Date(end_time + week_adjustment);
    var Monday = new Date(start_time + week_adjustment);
    console.log(Sunday);
    console.log(Monday);
    dates = [];
    for (var i = 0; i < 7; i++){
        dates.push((new Date(Monday.valueOf() + i * DayLength)).toDateString());
    }
    return get_avgs_for_dates(dates);
}

function get_freqs_for_week(){
    var DayLength = 86400000;
    var now = new Date();
    var today = new Date(now - (now.valueOf() % DayLength) + (5.0/24) * DayLength);
    var wkday = (7 + (-1 + today.getDay())) % 7;
    var end_time = today.valueOf() - (wkday * DayLength) - 1;
    var start_time = today.valueOf() - ((wkday + 7) * DayLength);
    var week_adjustment = (week_offset + 1) * 7 * DayLength;
    var Sunday = new Date(end_time + week_adjustment);
    var Monday = new Date(start_time + week_adjustment);
    console.log(Sunday);
    console.log(Monday);
    dates = [];
    for (var i = 0; i < 7; i++){
        dates.push((new Date(Monday.valueOf() + i * DayLength)).toDateString());
    }
    return get_freqs_for_dates(dates);
}


function get_freqs_for_dates(dates){
    var daily_avgs = JSON.parse(localStorage.getItem("bg_frequency"));
    var freqs = []
    for (var i = 0; i < dates.length; i++){
        freqs.push(daily_avgs[dates[i]]);
    }
    return freqs;
}

function get_cumulative_avg(dates){
    var daily_avgs = JSON.parse(localStorage.getItem("bg_avg"));
    var sum = 0.0;
    for (var i = 0; i < dates.length; i++){
        console.log(daily_avgs[dates[i]]);
        sum += parseInt(daily_avgs[dates[i]]);
    }
    return Math.round(sum / dates.length);
}

var onFrequency = true;
var myNewChart;
var week_avg, week_freq;

function this_week_avg(bg_avg, bg_dates) {
    var startOfWeek = moment().startOf('isoweek').toDate();
    var endOfWeek   = moment().endOf('isoweek').toDate();
    var thisWeekAvg = new Array(7);

    for(var i = 0; i < bg_dates.length; i++) {
      var current_date = new Date(bg_dates[i]);
      if ((current_date <= endOfWeek && 
        current_date >= startOfWeek)) {
        var index = current_date.getDay();
        thisWeekAvg[index] = bg_avg[current_date.toDateString()];
      }
    }
    return thisWeekAvg;
}

function load_freq(){
    var week_freq = get_freqs_x_week();
    console.log(week_freq);
    var points = myNewChart["datasets"][0]["points"];
    console.log(points.length);
    for (var i = 0; i < points.length; i++) {
        points[i].value = week_freq[i];
    }
    onFrequency = true;
    myNewChart.update();
}

function load_avg(){
    var week_avg = get_avgs_x_week();
     console.log(week_avg);
    var points = myNewChart["datasets"][0]["points"];
    console.log(points.length);
    for (var i = 0; i < points.length; i++) {
        points[i].value = week_avg[i];
    }
    onFrequency = false;
    myNewChart.update();
}

function this_week_frequency(bg_frequency, bg_dates) {
    var startOfWeek = moment().startOf('isoweek').toDate();
    var endOfWeek   = moment().endOf('isoweek').toDate();
    var thisWeekFreq = new Array(7);

    for(var i = 0; i < bg_dates.length; i++) {
      var current_date = new Date(bg_dates[i]);
      if ((current_date <= endOfWeek && 
        current_date >= startOfWeek)) {
        var index = current_date.getDay();
        thisWeekFreq[index] = bg_frequency[current_date.toDateString()];
      }
    }
    return thisWeekFreq;
}

function drawGraph() {

    bg_frequency = JSON.parse(localStorage.getItem("bg_frequency"));
    bg_avg = JSON.parse(localStorage.getItem("bg_avg"));
    bg_dates = JSON.parse(localStorage.getItem("bg_dates"))
    allReadings = JSON.parse(localStorage.getItem("allReadings"));

    var week_data = this_week_avg(bg_frequency, bg_dates);
    var weekdays = ["Mon", "Tu", "Wed", "Th", "Fri", "Sat", "Sun"];
      var readingsData = {
        labels : weekdays,
        datasets : [{
                  fillColor: "rgba(220,220,220,0.2)",
                  strokeColor: "rgba(220,220,220,1)",
                  pointColor: "#1f77b4",
                  pointStrokeColor: "#fff",
                  pointHighlightFill: "#17becf",
                  pointHighlightStroke: "rgba(220,220,220,1)",
                  data: week_data
            }]
      };

    var canvas = $("#readings").get(0);
    var ctx = canvas.getContext("2d");
    myNewChart = new Chart(ctx).Line(readingsData, {
    scaleShowGridLines : false
    }); 
}