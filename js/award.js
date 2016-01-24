
var bg_readings;

function checkForAward(){

	
	$.getJSON("sample.json", function( data ) {
	  var items = [];
	  bg_readings = data["bloodGlucose"];
	  console.log(bg_readings);
	  $.each( data, function( key, val ) {
	    items.push( "<li id='" + key + "'>" + val + "</li>" );
	  });
	 
	  $( "<ul/>", {
	    "class": "my-new-list",
	    html: items.join( "" )
	  }).appendTo( "body" );
	});
}