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
// d3

// !!! TMP:
var user = "thenoviceoof";
var repo_list = ["pensievr", "rooibos"];

var m = repo_list.length;
var n = 52;

// generate some empty data
var start = true;
var data = d3.range(m).map(function(d) {
    var tmp_data = d3.range(n).map(function(d,i){ return {x: i, y: 0}; });
    return tmp_data;
});

// transform the data appropriately
var stack_data = d3.layout.stack()(data);
// get the hue for each repo, evenly interpolated
var color = d3.scale.linear()
    .domain([0,m])
    .range([0,360]);

var p = 20; // padding for labels
var w = 0.6*$("body").width();
var h = 200 - .5 - p; // height for data

// bounds in x and y
var mx = n;
var my = d3.max(stack_data, function(d) {
    return d3.max(d, function(d) {
        return d.y0 + d.y;
    });
});

// interpolation
var x = function(d) { return d.x * w / mx; };
var y0 = function(d) { return h - d.y0 * h / my; };
var y1 = function(d) { return h - (d.y + d.y0) * h / my; };

// add the containing svg element
var vis = d3.select("#chart")
    .append("svg")
    .attr("width", w)
    .attr("height", h + p);

// layers for each repo
var layers = vis.selectAll("g.layer")
    .data(stack_data)
    .enter().append("g")
    .style("fill", function(d, i) {
	return tripleToString(hsvToRgb(color(i), 60, 90));
    })
    .attr("class", "layer");

// group for each stack
var bars = layers.selectAll("g.bar")
    .data(function(d) { return d; })
    .enter().append("g")
    .attr("class", "bar")
    .attr("transform", function(d) { return "translate(" + x(d) + ",0)"; });

// draw "empty" bars
bars.append("rect")
    .attr("width", x({x: .9}))
    .attr("x", 0)
    .attr("y", h)
    .attr("height", 0);

// time labels
var labels = vis.selectAll("text.label")
    .data(data[0])
    .enter().append("text")
    .attr("class", "label")
    .attr("x", x)
    .attr("y", h + 6)
    .attr("dx", x({x: .45}))
    .attr("dy", ".71em")
    .attr("text-anchor", "middle")
    .text(function(d, i) { return i; });

// baseline (?)
vis.append("line")
    .attr("x1", 0)
    .attr("x2", w)
    .attr("y1", h)
    .attr("y2", h)
    .attr("class","baseline");

function redraw() {
    stack_data = d3.layout.stack()(data);

    // bounds in x and y
    my = d3.max(stack_data, function(d) {
	return d3.max(d, function(d) {
            return d.y0 + d.y;
	});
    });

    // interpolation
    x = function(d) { return d.x * w / mx; };
    y0 = function(d) { return h - d.y0 * h / my; };
    y1 = function(d) { return h - (d.y + d.y0) * h / my; };

    // and redraw the bars
    bars.selectAll("rect")
        .transition()
	.delay(function(d, i) { return i * 10; })
	.attr("y", y1)
	.attr("height", function(d) { console.log(d); return y0(d) - y1(d); });
}

////////////////////////////////////////////////////////////////////////////////
// Data load requests

for(var i in repo_list) {
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
    $.ajax({
	url: "/"+user+"/"+repo,
	success: repoClosure(repo),
    });
}