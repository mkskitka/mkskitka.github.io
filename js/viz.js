
// GLOBALS 
var vizData;
var colors = ["blue", "Teal", "purple", "black"];
var default_color = "grey";
var screen_width;
var screen_height;
var screen_ratio;
var viz_padding = 200; 
var sqroot;  						// square root of the total number of data entries or rows
var block_x; 						// x coordinate of first dot in the viz
var block_y; 						// y coordinate of first dot in the viz
var total_time = 3000; 				// time between transitions
var delay = (3/5) * total_time;  	// delay time
var duration = (2/5) * total_time;	// duration of transitions 
var sm_circle;						// size of small circle 
var selected_circle;				// size of selected circle 
var dist; 							// dist between each circle
var opacity = .7					// opacity of each circle 
var offset = -120;					// lol idk 		
var key_circle_radius = 20;			// radius of the key circles 
var title_x;						// main title 

/* variables used for multi-block mode */
var viz_lg_side;
var viz_sm_side; 
var indv_width;
var num_nodesX;
var total_nodes_per_block;
var num_nodesY = [];
var multi_padding = 30;
var multi_greater = 200;
var multi_view = false;

var animation = true; 				// animation on or off
var simple = false;  				// transitions simple or complex 

/* The current questions and responses displayed on the viz */
var block_question = "";
var color_question ="Do you feel that being identified as a person with a mental health issue would hurt your career?";
var block_response = [];
var color_response = ["Yes, I think it would", "No, I don't think it would", "Maybe", "Yes, it has"];
	

var block_x_by_resp = []; //holds the x values blocks
var index_by_resp = [];   //holds the response options
var resp2 = [];

/* loads the data*/
function loadData() {
	d3.csv("data/data1.csv", function(data) {

  		vizData = data;

  		viz_sm_side = Math.min(screen_width, screen_height) - viz_padding;
  		sqroot = Math.round(Math.sqrt(vizData.length));
  		sm_circle = viz_sm_side/((sqroot*4));
  		selected_circle = sm_circle * 1.5;
  		dist = sm_circle * 3;
  		block_x = $("#currentDisplay").width()/2 - viz_sm_side/2 + 50;
		block_y = $("#currentDisplay").height()/2 - viz_sm_side/2;
		color_question = fact2;
		color_response = questions[fact2];
  		animate();
	});
}

/* control flow for viz
   can make this centralized control flow using promises */
function animate() {
	reset_single();
	show_metric();
}



function populate() {

	d3.select("#currentDisplay").select("svg").select("g").selectAll("circle")
		.transition()
		.duration(total_time)
		.attr("cx", function(d) { return d.x - offset})
		.attr("cy", function(d) { return d.y});

	d3.selectAll("#key")
		.selectAll("text")
		.remove();

	d3.selectAll(".key_circle")
		.attr("fill", function(d, i) {if(i < index_by_resp.length) { return d; }
										else {return "transparent"}});
	
	d3.select("#key_svg").select("g")
		.selectAll("text")
		.data(colors)
		.enter()
		.append("text")
		.text(function(d, i) {if(i < index_by_resp.length){ return color_response[i]}
								else {return ""}})
		.attr("x", 60)
		.attr("y", function(d, i) {return 40 + 52*i});

	d3.select("#currentDisplay").select("svg").select("g")
		.selectAll("text").remove();

	$("#color_q").text("");
	$("#color_q").text(color_question).fadeIn();

	$("#block_q").text("");
	$("#block_q").text(block_question).fadeIn();

	if(block_response.length > 1){
	d3.select("#currentDisplay").select("svg").select("g")
		.selectAll("text")
		.data(block_response)
		.enter()
		.append("text")
		.attr("id", "b_resp")
		.text(function(d, i) {
			return block_response[i];
		})
		.attr("x", function(d, i) {return title_x+multi_padding+dist*3 - ((indv_width+multi_padding)*((block_response.length-1) -i) -5)})
		.attr("y", viz_padding/3);
	}
	else {
		
		$("#block_q").text("");
		$("#block_q").text("Over 1100 Employees in Tech Talk Mental Health");

	}


}



function factor_recolor (question, response) {


	index_by_resp.length = response.length;

	for(var i = 0; i < block_x_by_resp.length; i++) {   //i = block number
		for(var j = 0; j < index_by_resp.length; j++){	//j = color 
				index_by_resp[i] = new Array(response.length);  
				index_by_resp[i].fill(0);
		}
	}

	//sets the correct index per response type
	d3.select("#currentDisplay").select("svg").select("g").selectAll("circle")
	  .transition()
	  .duration(1000)
	  .attr("r", 
	  	function(d){ 
	  		for (var i = 0; i < resp2.length; i++){
		  		for (var j = 0; j < response.length; j++){
		  			if (d[question] == response[j] && ((multi_view == false) || (d.resp2 == i))) {
		  				d.new_i = index_by_resp[i][j];
		  				d.resp = j;
		  				index_by_resp[i][j] = index_by_resp[i][j] + 1;
		  				return sm_circle;
		  			}
		  		}
	  		}
	  });

	//sets the color, the x and the y value 
	for(var i = 0; i < block_x_by_resp.length; i++){
		var index_accum = 0;
		for(var j = 0; j < response.length; j++){
			d3.select("#currentDisplay").select("svg").select("g").selectAll("circle")
			  .attr("r", 
			  	function(d) { 
			  			if(d.resp == j && ((multi_view == false) || (d.resp2 == i))){
			  				d.color = colors[j];
			  				d.x = block_x_by_resp[i] + (((index_accum + d.new_i) % sqroot) * dist) - offset;
			  				d.y = block_y + (Math.floor((d.new_i+index_accum)/sqroot) * dist);
			  				if(d.new_i == 1 && d.color == colors[0]){
			  					title_x = d.x;
			  				}
			  			}
			  			return sm_circle;
			  	});

			index_accum += index_by_resp[i][j]; 
		}
	}

	if(simple == true) {
		recolor();
	}
	else {
		recolor_recurse(0, index_by_resp.length);
	}

	
	//reorganize graph to show key/value pair that 
	//should be recolored and placed together in
	//the graph

}

function recolor_recurse(i, length) {
	
	if(i != length) {
		
		color_key(i);

		d3.select("#currentDisplay").select("svg").select("g").selectAll("circle")
			.transition()
			.duration(duration)
			.attr("r", function(d) { 
				if(d.resp == i){
					return selected_circle;
				}
			    else{ 
			    	return sm_circle;
			    }})
			.style("fill", function(d) {
				if(d.resp <= i) {
					return d.color;
				}
				else 
					return default_color;
			})
			.transition()
			.delay(1000)
			.duration(duration)
			.attr("r", function(d) {return sm_circle});
		
		setTimeout(function() {
			i++;
			recolor_recurse(i, length);	  
		}, 3000);
	}
	
	else {
		populate();
		return;
	}
}


function recolor(i, length, time) {

	d3.select("#currentDisplay").select("svg").select("g").selectAll("circle")
		.transition()
		.duration(duration)
		.style("fill", function(d) {
				return d.color;

		})
	setTimeout(function() {
		populate();
	}, duration);
}


function group_by_factor(question, response) {

	multi_view = true; 
	resp2.length = response.length; 
	resp2.fill(0);
	indv_width = (viz_sm_side+multi_greater)/response.length-multi_padding; 
	num_nodesX = Math.round(indv_width/dist) 
	sqroot = num_nodesX;

	d3.select("#currentDisplay").select("svg").select("g").selectAll("circle")
	  .attr("r", function(d) {
				for (var i = 0; i < response.length; i++){
		  			if (d[question] == response[i]) {
		  				d.resp2 = i;
		  				resp2[i] = resp2[i] + 1;
		  				return sm_circle;
		  			}
	  		}
	  })

	for(var i = 0; i< resp2.length; i++) {
		num_nodesY[i] = resp2[i]/num_nodesX;
	}
	
	var accum = screen_width/2 - (viz_sm_side+multi_greater)/2 +100;

	for(var i = 0; i < response.length; i++) {
		block_x_by_resp[i] = accum + ((indv_width+multi_padding) * i);
	} 

	factor_recolor(color_question, color_response);

}

function reset() {

	color_question ="Do you feel that being identified as a person with a mental health issue would hurt your career?";
	color_response = ["Yes, I think it would", "No, I don't think it would", "Maybe", "Yes, it has"];
	block_question = "";
	block_response = [];
	reset_single();
	factor_recolor(color_question, color_response);
}

function reset_single() {
	sqroot = Math.round(Math.sqrt(vizData.length));
	multi_view = false;
	block_x_by_resp.length = 1;
	block_x_by_resp.fill(block_x)
	resp2.length = 1; 
}

function change_block_question() {
	var q = event.toElement.innerHTML;
	block_question = q;
	block_response = questions[q];
	group_by_factor(q, questions[q]);
}

function change_color_question() {
	var q = event.toElement.innerHTML;
	color_question = q;
	color_response = questions[q];
	factor_recolor(q, questions[q]);
}
/************************************************************************************************

							MOUSE EVENTS

************************************************************************************************/


function nodeMouseOver(d, i) {

	console.log(d);
	d3.select(this)
	  .attr("r", selected_circle)
	  .style("opacity", opacity);

	var g = d3.select(this).append("g");
	  g.append("rect")
	  .attr("x", d.x)
	  .attr("y", d.y)
	  .attr("width", 160)
	  .attr("height", 100)
      .attr("fill", "white");

      g.append("text")
      .attr("x", d.x)
	  .attr("y", d.y)
	  .attr("dy", ".35em")
      .text(String(d[fact2]));
}

function nodeMouseOut(d, i) {

 	d3.select(this)
 	  .attr("r", sm_circle)
 	  .style("opacity", opacity);
 	d3.select(this).selectAll("g").remove();

}