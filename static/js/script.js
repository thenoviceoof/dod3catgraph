// script.js
////////////////////////////////////////////////////////////////////////////////

/**
 * HSV to RGB color conversion
 *
 * H runs from 0 to 360 degrees
 * S and V run from 0 to 100
 * 
 * Ported from the excellent java algorithm by Eugene Vishnevsky at:
 * http://www.cs.rit.edu/~ncs/color/t_convert.html
 *
 * copied from http://snipplr.com/view.php?codeview&id=14590
 */
function hsvToRgb(h, s, v) {
    var r, g, b;
    var i;
    var f, p, q, t;
    
    // Make sure our arguments stay in-range
    h = Math.max(0, Math.min(360, h));
    s = Math.max(0, Math.min(100, s));
    v = Math.max(0, Math.min(100, v));
    
    // We accept saturation and value arguments from 0 to 100 because that's
    // how Photoshop represents those values. Internally, however, the
    // saturation and value are calculated from a range of 0 to 1. We make
    // That conversion here.
    s /= 100; v /= 100;
    
    if(s == 0) {
	// Achromatic (grey)
	r = g = b = Math.round(v*255);
	return [r,g,b];
    }
    
    h /= 60; // sector 0 to 5
    i = Math.floor(h);
    f = h - i; // factorial part of h
    p = v * (1 - s);
    q = v * (1 - s * f);
    t = v * (1 - s * (1 - f));

    switch(i) {
    case 0:
	r = v;g = t;b = p;break;
    case 1:
	r = q;g = v;b = p;break;
    case 2:
	r = p;g = v;b = t;break;
    case 3:
	r = p;g = q;b = v;break;
    case 4:
	r = t;g = p;b = v;break;
    default: // case 5:
	r = v;g = p;b = q;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function tripleToString(color) {
    var colors = color.map(function(c){ return Math.round(c).toString(16); });
    var s = "#" + colors.join("");
    return s;
}

////////////////////////////////////////////////////////////////////////////////
// util

// first, we randomly arrange the repos, in case arrangement is strange
function shuffle(list) {
    function swap(list, i,j) {
	var tmp = list[i];
	list[i] = list[j];
	list[j] = tmp;
    }
    // from http://stackoverflow.com/questions/1527803/generating-random-numbers-in-javascript
    function getRandomInt (min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function randomInd(list) {
	return getRandomInt(0, list.length-1);
    }
    for(var i in list) {
	var j = randomInd(list);
	swap(list, i, j);
    }
    return list;
}
repo_list = shuffle(repo_list);

// we have to shuffle the colors, too: like colors by default end up
// next to each other
var repo_colors = shuffle(d3.range(repo_list.length));


// open the repo of interest in a new tab/window
function followRepo(user, name) {
    var url = "https://github.com/" + user + "/" + name;
    window.open(url,'_blank');
}

////////////////////////////////////////////////////////////////////////////////
// d3

// consts
var m = repo_list.length;
var n = 52;

var p = 24; // padding for labels
var w = $("#main").width();
var h = 300 - p; // height for data

// generate some empty data
var start = true;
var data = d3.range(m).map(function(d, j) {
    var tmp_data = d3.range(n).map(function(d, i){
	return {x: i, y: 0,
		name: repo_list[j].name,
		user: repo_list[j].user};
    });
    return tmp_data;
});

// transform the data appropriately
var stack_data = d3.layout.stack()(data);
// get the hue for each repo, evenly interpolated
var color = d3.scale.linear()
    .domain([0,m])
    .range([0,360]);

// bounds in x and y
var mx = n;
var my = d3.max(stack_data, function(d) {
    return d3.max(d, function(d) {
        return d.y0 + d.y;
    });
}) || 1;

// interpolation
var x = function(d) { return d.x * w / mx; };
var y0 = function(d) { return h - d.y0 * h / my; };
var y1 = function(d) { return h - (d.y + d.y0) * h / my; };


////////////////////////////////////////
// add the containing svg element
var vis = d3.select("#chart")
    .append("svg")
    .attr("width", w)
    .attr("height", h + p);

// get some horizontal rules
var ruleData = d3.range(10).map(function (d){
    // return 10*d;
    // return Math.pow(2, d);
    return 2*Math.pow(d+1, 2);
});
// util function for y-pos of rules
function ySpot(offset) {
    offset = offset || 0;
    return function(d){ return y0({y0: d}) + offset; };
}
vis.selectAll("line.rule")
    .data(ruleData)
    .enter().append("line")
    .attr("class", "rule")
    .attr("x1", 0)
    .attr("x2", w)
    .attr("y1", ySpot())
    .attr("y2", ySpot());
// and the associated text
var ruleLabelOffset = -5;
vis.selectAll("text.rule")
    .data(ruleData)
    .enter().append("text")
    .attr("class", "rule")
    .text(String)
    .attr("text-anchor", "left")
    .attr("x", 0)
    .attr("y", ySpot(ruleLabelOffset));

// the floating repo name
var repoNameText = vis.append("text")
    .attr("id","overlay")
    .text("")
    .attr("x", w*0.5)
    .attr("y", h*0.5)
    .attr("text-anchor", "middle");

// layers for each repo
var layers = vis.selectAll("g.layer")
    .data(stack_data)
    .enter().append("g")
    .style("fill", function(d, i) {
	return tripleToString(hsvToRgb(color(repo_colors[i]), 50, 85));
    })
    .attr("class", "layer");

// group for each stack
var bars = layers.selectAll("g.bar")
    .data(function(d) { return d; })
    .enter().append("g")
    .attr("class", "bar")
    .attr("transform", function(d) { return "translate(" + x(d) + ",0)"; });

// draw "empty" bars, which we update later
var barPadding = 0.2;
bars.append("rect")
    .attr("class", "bars")
    .attr("width", x({x: 1.0 - barPadding}))
    .attr("x", x({x: barPadding/2}))
    .attr("y", h)
    .attr("height", 0)
    .on("click", function(d) {
	followRepo(d.user, d.name);
    })
    .on("mouseover", function(d) {
	repoNameText.text(d.name);
	repoNameText.transition()
	    .ease("linear")
	    .duration(500)
	    .attr("x", 0.5*x({x: d.x}) + 0.25*w);
    })
    .on("mouseout", function() {
	repoNameText.text("");
    });

function prevWeekMonthChange(i) {
    function prevWeekMonth(a) {
	var timestamp = a*7*24*3600*1000;
	return (new Date((new Date()).getTime()-timestamp)).getMonth();
    }
    var m1 = prevWeekMonth(i);
    var m2 = prevWeekMonth(i-1);
    if(m1 != m2)
	return m2;
    return -1;
}

// time labels
var labels = vis.selectAll("text.label")
    .data(data[0]) // just to get the right res
    .enter().append("text")
    .attr("class", "label")
    .attr("x", x)
    .attr("y", h + 6)
    .attr("dx", "0.3em")
    .attr("dy", ".71em")
    .attr("text-anchor", "left")
    .text(function(d, i) {
	// figure out if we're in the beginning of a month
	var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
		      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	var m = prevWeekMonthChange(n-i+1);
	if(m != -1) {
	    return months[m];
	}
	return "";
    });
// line to mark beginning of month
var labelLines = vis.selectAll("line.label")
    .data(data[0])
    .enter().append("line")
    .attr("class", "label")
    .attr("x1",x)
    .attr("x2",x)
    .attr("y1", h + 4)
    .attr("y2", function(d, i) {
	// figure out if we're in the beginning of a month
	if(prevWeekMonthChange(n-i+1) != -1)
	    return h + 18;
	return h + 4;
    });

// baseline
vis.append("line")
    .attr("x1", 0)
    .attr("x2", w)
    .attr("y1", h)
    .attr("y2", h)
    .attr("class","baseline");

// lines to highlight each week, especially in long stretches of empty time
var spacing = 2;
var labelLines = vis.selectAll("line.weekhighlight")
    .data(data[0])
    .enter().append("line")
    .attr("class", "weekhighlight")
    .attr("x1",function(d) {
	return x(d) + spacing;
    })
    .attr("x2",function(d) {
	var a = {x: d.x + 1};
	return x(a) - spacing;
    })
    .attr("y1", h)
    .attr("y2", h);

function redraw() {
    // re-make the data
    stack_data = d3.layout.stack()(data);

    // re-find maximum bound
    my = d3.max(stack_data, function(d) {
	return d3.max(d, function(d) {
            return d.y0 + d.y;
	});
    }) || 1;

    // and redraw the bars
    bars.selectAll("rect")
        .transition()
	.duration(800)
	.delay(function(d, i) { return d.x * 20; })
	.attr("y", y1)
	.attr("height", function(d) { return y0(d) - y1(d); });

    // move the rules
    vis.selectAll("line.rule")
	.transition()
    	.duration(800)
	.attr("y1", ySpot())
	.attr("y2", ySpot());
    vis.selectAll("text.rule")
	.transition()
    	.duration(800)
	.attr("y", ySpot(ruleLabelOffset));
}

////////////////////////////////////////////////////////////////////////////////
// Data load requests

var RELOAD_LIMIT = 2;
var reload_count = d3.range(repo_list.length).map(function(){ return 0; });

// recursion, so I can use setTimeout: trying to load cached data means
// a big pileup, and locks up the cpu pretty well, so we stagger requests
function loadData(i) {
    if(i >= repo_list.length)
	return;
    var repo = repo_list[i];
    // closure to pass in repo name
    var repoClosure = function (repo) {
	// success handler
	return function(tmp_data) {
	    // find the index of the repo
	    var ind = $.inArray(repo, repo_list);
	    tmp_data = d3.range(n).map(function(d, i) {
		return {x: i, y: tmp_data[i]};
	    });
	    // update the data inline
	    for(var j in tmp_data) {
		data[ind][j].x = tmp_data[j].x;
		data[ind][j].y = tmp_data[j].y;
	    }
	    console.log("redrawing");
	    redraw();
	}
    };
    var errorClosure = function (repo) {
	// sometimes, you need to give github a bit of time to count up
	return setTimeout(function() {
	    var ind = $.inArray(repo, repo_list);
	    if(reload_count[ind] < RELOAD_LIMIT) {
		reload_count[ind] += 1;
		fetch_repo(repo);
	    }
	}, 5000 + 5000*Math.random());
    }
    function fetch_repo(repo) {
	$.ajax({
	    url: "/"+repo.user+"/"+repo.name,
	    success: repoClosure(repo),
	    error: errorClosure(repo),
	});
    }
    fetch_repo(repo);
    setTimeout(function(){loadData(i+1)}, 1000);
}
loadData(0);