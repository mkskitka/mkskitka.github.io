/* introduces circle metric at the beginning */
var fact2 = "Would you feel comfortable discussing a mental health disorder with your direct supervisor(s)?";
var q2 = "Do you currently have a mental health disorder?"; 
var q3 = "Does your employer provide mental health benefits as part of healthcare coverage?";
var q4 = "Do you know the options for mental health care available under your employer-provided coverage?";
var q5 = "Have you observed or experienced an unsupportive or badly handled response to a mental health issue in your current or previous workplace?";
var q6 = "What is your gender?";
var q7 = "Do you feel that being identified as a person with a mental health issue would hurt your career?";
// RESET
var q8 = "Would you be willing to bring up a physical health issue with a potential employer in an interview?";
var q9 = "Would you bring up a mental health issue with a potential employer in an interview?";
var q10 = "Do you think that team members/co-workers would view you more negatively if they knew you suffered from a mental health issue?";

function show_metric() {

	var svg = d3.select("#currentDisplay").select("svg").append("g");
	svg.append("text").html('--- One Person')
		.attr("x", $("#currentDisplay").width()/2 + 60)
		.attr("y", $("#currentDisplay").height()/2);

	svg.append("circle")
		.attr("id", "vizCircle")
		.attr("cx", function() { return $("#currentDisplay").width()/2})
        .attr("cy", function() { return $("#currentDisplay").height()/2 })
        .attr("r", 50)
        .style("opacity", opacity)
        .style("fill", colors[0])    
        .transition()
        .duration(duration)
        .attr("r", sm_circle)
        .transition()
        
    svg.append("text")
    	.attr("id", "num_people")
        .html('of 1100 People Employed in Tech Companies in the United States')
        .transition()
    	.delay(2000)
    	.duration(1000)
		.attr("x", $("#currentDisplay").width()/2 -300)
		.attr("y", $("#currentDisplay").height()/2 -100);

    setTimeout(function(){ 
    	random_populate();  	
    }, total_time +1000);
    
}

/* populates viz nodes randomly */
function random_populate() {
	d3.select("#currentDisplay").select("svg").select("g").selectAll("circle")
    	.data(vizData)
    	.enter()
    	.append("circle")
    	.attr("id", vizCircle)
    	.attr("cx", function() { return Math.random() * $("#currentDisplay").width()-10 })
        .attr("cy", function() { return Math.random() * $("#currentDisplay").height()-10 })
		.attr("r", 0)
		.style("fill", default_color)
		.style("opacity", opacity)
		.on("mouseover", nodeMouseOver)
        .on("mouseout", nodeMouseOut)
		.transition()
		.duration( function(d, i) {
								 return 200 * i/100})
		.attr("r", sm_circle);

	setTimeout(function(){
		d3.select("#currentDisplay").select("svg").select("g").selectAll("text")
			.remove();
		block_populate();  	
    }, total_time);
}

/* populates viz into a square grid */
function block_populate() {

	$("#buttons").show();
	d3.select("#currentDisplay").select("svg").select("g").selectAll("circle")
		.attr("r", function(d, i) { d.x = block_x + ((i % sqroot) * dist) - offset; return sm_circle;})
		.attr("r", function(d, i) { d.y = block_y + (Math.floor(i/sqroot) * dist); return sm_circle;});

	populate();

	setTimeout(function(){
		//group_by_factor(fact2, rsp2);
		setTimeout(function() {
			factor_recolor(fact2, questions[fact2]);

			setTimeout(function() {
				simple = true;
				block_question = q2;
				block_response = questions[q2];
				group_by_factor(q2, questions[q2]);

				$("#explain").text("");
				$("#explain").text("Here we divide the data into columns showing whether people believe they have a mental health disorder.").fadeIn("slow", .5);

					setTimeout(function() {
					color_question = q3;
					color_response = questions[q3];
					factor_recolor(q3, questions[q3]);
					
					$("#explain").text("");
					$("#explain").text("Many people are unaware if they have benefits even if it could help them").fadeIn("slow", .5);
					setTimeout(function() {
						color_question = q4;
						color_response = questions[q4];
						factor_recolor(q4, questions[q4]);

					$("#explain").text("");
					$("#explain").text("Here we see people don't take advantage of mental health benefits, as they are unaware of the options.").fadeIn("slow", .5);

						setTimeout(function() {
							color_question = q5;
							color_response = questions[q5];
							factor_recolor(q5, questions[q5]);

							$("#explain").text("");
							$("#explain").text("This data suggests people without mental disorders are less aware of poorly handled responses or mental health issues").fadeIn("slow", .5);

								setTimeout(function() {
									block_question = q6;
									block_response = questions[q6];
									group_by_factor(q6, questions[q6]);
									$("#explain").text("");
									$("#explain").text("Now we split the data based on gender identity.").fadeIn("slow", .5);
									setTimeout(function() {

										$("#explain").text("");
										$("#explain").text("People accross gender indenty, have similar takes on mental health and it's potential negitive affect on their career path.").fadeIn("slow", .5);
										color_question = q7;
										color_response = questions[q7];
										factor_recolor(q7, questions[q7]);
										setTimeout(function() {
											reset();
											$("#explain").text("");
											$("#explain").text("Here we can people's comfort levels talking about physical health issues in an interview ").fadeIn("slow", .5);
											color_question = q8;
											color_response = questions[q8];
											factor_recolor(q8, questions[q8]);
												setTimeout(function() {
												$("#explain").text("");
												$("#explain").text("However when asked about speaking on mental heath during an interview significantly less people are comfortable doing so.").fadeIn("slow", .5);
												color_question = q9;
												color_response = questions[q9];
												factor_recolor(q9, questions[q9]);
													setTimeout(function() {
														$("#explain").text("");
														$("#explain").text("Theres a stigma towards Mental Illness in Tech that needs to be addressed.").fadeIn("slow", .5);
														color_question = q10;
														color_response = questions[q10];
														factor_recolor(q10, questions[q10]);
					
													}, 8000)
												}, 8000)
											}, 8000)
										}, 8000)
									}, 8000)
								}, 8000)
							}, 8000)
						}, 6000)
					}, 16000)
				}, 1000);
			}, total_time);

}

function color_key(x) {
	console.log("color_key");
	d3.selectAll(".key_circle")
		.attr("r", function(i){if(i>x){return 0 }
								else {return key_circle_radius;}})
		.transition()
		.duration(1000)
		.delay(0)
		.attr("r", key_circle_radius)
		.attr("fill", function(d, i) {
				return d;

		});

		d3.select("#key_svg").select("g")
		.append("text")
		.transition()
		.delay(1000)
		.text( function(d, i) {return color_response[x]})
		.attr("x", 60)
		.attr("y", function(d, i) {return 40 + 52*x});

}