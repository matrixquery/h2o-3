var savedData;
var myChart;
var agg_frame_id; // the aggregator frame
var frame_id; // the original input frame
var klime_frame_id; // the klime frame (contains reason codes)
var interpret_output_data;
var response_variable = "the response variable";
var ModelInterpretability;
(function (ModelInterpretability) {
    function plot_klime(data, title, single_row_idx) {
        var option = {
            title: {
                text: title,
                left: 'center'
            },
            tooltip: {
                trigger: 'axis'
            },
            legend: {
                data: ['Model Prediction', 'KLime Model Prediction'],
                top: 20
            },
            xAxis: { data: data.columns[data.column_names.indexOf("h2oframe_idx")],
                axisLabel: { show: false } },
            yAxis: {},
            series: [{
                    name: 'Model Prediction',
                    type: 'line',
                    data: data.columns[data.column_names.indexOf("model_pred")],
                    lineStyle: { normal: { width: 0 } },
                    showAllSymbol: true,
                    symbolSize: 1
                },
                {
                    name: 'KLime Model Prediction',
                    type: 'line',
                    data: data.columns[data.column_names.indexOf("predict_klime")],
                    lineStyle: { normal: { width: 0 } },
                    showAllSymbol: true,
                    symbolSize: 1
                }
            ].concat(data.column_names.map(function (x) {
                if (x.match('^rc_')) {
                    return {
                        name: x,
                        type: 'line',
                        data: data.columns[data.column_names.indexOf(x)],
                        showSymbol: false,
                        symbolSize: 0,
                        hoverAnimation: false,
                        lineStyle: { normal: { width: 0 } }
                    };
                }
            })).filter(function (x) { return x; })
        };
        if (single_row_idx != NaN) {
            option.series[1]['markLine'] = {
                data: [
                    { name: "Queried Row",
                        xAxis: single_row_idx
                    },
                    { name: "Queried Row",
                        xAxis: single_row_idx
                    }
                ],
                symbolSize: 0,
                lineStyle: { normal: { width: 0.5, type: 'solid' } },
                label: { normal: { show: false } }
            };
        }
        myChart.setOption(option);
    }
    function load_klime(frame_key) {
        $.ajax({
            type: "POST",
            url: "http://localhost:54321/3/Vis/Stats",
            data: JSON.stringify({
                "graphic": {
                    "type": "stats",
                    "parameters": { "digits": 3, "data": true }
                },
                "data": { "uri": frame_key }
            }),
            contentType: "application/json",
            success: function (data) {
                console.log(data);
                savedData = data;
                plot_klime(data, "Global KLIME Plot", NaN);
                loadGlobalTable();
                // plot by klime cluster
                // click / select id value, generate cluster, permanent pinned row for that query
            }
        });
    }
    function loadPage() {
        $('#main').css('height', window.innerHeight).css('width', window.innerWidth);
        var params = new URLSearchParams(document.location.search);
        var interpret_key = params.get("interpret_key");
        $.get("http://localhost:54321/3/InterpretModel/" + interpret_key, function (data) {
            interpret_output_data = data;
            agg_frame_id = data.interpret_id.name;
            klime_frame_id = data.klime_frame_id.name;
            frame_id = data.frame_id.name;
            console.log(agg_frame_id);
            resizePlot();
            load_klime(agg_frame_id);
            loadSelectBars(frame_id);
        });
    }
    function resizePlot() {
        $('#main').css('height', window.innerHeight * (2.0 / 3.0)).css('width', window.innerWidth);
        myChart.resize();
    }
    function loadSelectBars(frame_id) {
        $.get("http://localhost:54321/3/Frames/" + frame_id + "/columns", function (data) {
            var columns = data.frames[0].columns.filter(function (col) { return ["int", "enum"].indexOf(col.type) >= 0; });
            var labels = columns.map(function (x) { return x.label; });
            console.log(labels);
            // the klime frame has this column but the orig frame does not
            $('<option>').val("h2oframe_idx").text("H2O Frame Row #").appendTo($('#columns'));
            for (var _i = 0, labels_1 = labels; _i < labels_1.length; _i++) {
                var e = labels_1[_i];
                $('<option>').val(e).text(e).appendTo($('#columns'));
            }
        });
        $('<option>').val(-1).text("Global").appendTo($('#cluster'));
        for (var i = 0; i < interpret_output_data.cluster_intercepts.length; i++) {
            $('<option>').val(i).text("Cluster" + i).appendTo($('#cluster'));
        }
    }
    function loadGlobalTable() {
        $('#table').empty();
        var content = '<table>';
        for (var i = 0; i < interpret_output_data.cluster_r2s.length; i++) {
            content += '<tr><td colspan=100%> Cluster ' + i + " explains " +
                (parseFloat(interpret_output_data.cluster_r2s[i]) * 100).toFixed(2) +
                '% of the variability in ' + response_variable + '</td></tr>';
        }
        content += '<tr><td colspan=100%> Global Klime explains ' +
            (parseFloat(interpret_output_data.global_r2) * 100).toFixed(2) +
            '% of the variability in ' + response_variable + '</td></tr>';
        content += '</table>';
        $('#table').append(content);
    }
    function loadClusterTable(data) {
        // create a table with data from pre-klime frame
        $('#table').empty();
        var content = '<table>';
        content += '<tr><td colspan=100%> The baseline prediction for this cluster is: ' +
            parseFloat(interpret_output_data.cluster_intercepts[$('#cluster').val()]).toFixed(3) +
            '</td></tr>';
        content += '<tr><td colspan=100%><b> Row Values </b></td></tr>';
        for (var i = 0; i < data.frames[0].column_count; i++) {
            var dataVal = void 0;
            if (data.frames[0].columns[i].type == "enum") {
                // get the enum string
                dataVal = data.frames[0].columns[i].domain[data.frames[0].columns[i].data[0]];
            }
            else {
                dataVal = data.frames[0].columns[i].data[0];
            }
            content += '<tr><td>' + data.frames[0].columns[i].label + '</td><td>' +
                dataVal + '</td></tr>';
        }
        content += '</table>';
        $('#table').append(content);
    }
    function plotClusterPlus1Row(data) {
        console.log(data);
        var cluster_col = data.frames[0].columns.filter(function (x) { return x.label == "cluster_klime"; });
        var clusterNumber = cluster_col[0].data[0];
        var new_columns = [];
        var cluster_idx = savedData.column_names.indexOf("cluster_klime");
        var modelpred_idx = savedData.column_names.indexOf("model_pred");
        var single_row_pushed = false;
        var single_row_idx = NaN;
        var push_count = 0;
        for (var i = 0; i < savedData.number_of_columns; i++) {
            new_columns.push([]);
        }
        for (var i = 0; i < savedData.number_of_rows; i++) {
            if (savedData.columns[cluster_idx][i] == clusterNumber) {
                for (var j = 0; j < savedData.number_of_columns; j++) {
                    new_columns[j].push(savedData.columns[j][i]);
                }
                // push the one row if its right above the current model pred score
                if (!single_row_pushed &&
                    data.frames[0].columns[modelpred_idx].data[0] <= savedData.columns[modelpred_idx][i]) {
                    for (var j = 0; j < savedData.number_of_columns; j++) {
                        if (savedData.number_of_columns - j == 1) {
                            new_columns[j].push(NaN);
                        }
                        else if (savedData.number_of_columns - j == 2) {
                            new_columns[j].push(parseInt(data.frames[0].columns[j].data[0]));
                        }
                        else {
                            new_columns[j].push(data.frames[0].columns[j].data[0].toFixed(3));
                        }
                    }
                    single_row_pushed = true;
                    single_row_idx = push_count;
                }
                push_count += 1;
            }
        }
        var new_data = $.extend(true, {}, savedData);
        new_data.columns = new_columns;
        plot_klime(new_data, "Cluster " + clusterNumber + " KLIME Plot", single_row_idx + 1);
    }
    function plotCluster(clusterNumber) {
        var new_columns = [];
        var cluster_idx = savedData.column_names.indexOf("cluster_klime");
        for (var i = 0; i < savedData.number_of_columns; i++) {
            new_columns.push([]);
        }
        for (var i = 0; i < savedData.number_of_rows; i++) {
            if (savedData.columns[cluster_idx][i] == clusterNumber) {
                for (var j = 0; j < savedData.number_of_columns; j++) {
                    new_columns[j].push(savedData.columns[j][i]);
                }
            }
        }
        var new_data = $.extend(true, {}, savedData);
        new_data.columns = new_columns;
        plot_klime(new_data, "Cluster " + clusterNumber + " KLIME Plot", NaN);
    }
    function switchPlot() {
        var selectVal = parseInt($('#cluster').val());
        $('#table').empty();
        if (selectVal > -1) {
            plotCluster(selectVal);
        }
        else {
            plot_klime(savedData, "Global KLIME Plot", NaN);
            loadGlobalTable();
        }
    }
    function pullOneRow(data) {
        // get one row from the orig frame as well as the klime frame for the RCs
        $.get("http://localhost:54321/3/Frames/" + klime_frame_id + "?row_count=1&row_offset=" + data.next, function (klime_data) {
            var cluster_col = klime_data.frames[0].columns.filter(function (x) { return x.label == "cluster_klime"; });
            var clusterNumber = cluster_col[0].data[0];
            $('#cluster').val(clusterNumber);
            // this call relies on the cluster known
            $.get("http://localhost:54321/3/Frames/" + frame_id + "?row_count=1&row_offset=" + data.next, function (frame_data) { return loadClusterTable(frame_data); });
            // reset the selector inside the function
            plotClusterPlus1Row(klime_data);
        });
    }
    function loadClusterPlot(e) {
        console.log(e);
        if ($('#columns').val() == "h2oframe_idx") {
            pullOneRow({ next: parseInt($('#search-value').val()) });
        }
        else {
            $.get("http://localhost:54321/3/Find?key=" + frame_id + "&column=" + $('#columns').val() +
                "&match=" + $('#search-value').val() + "&row=0&_exclude_fields=key", function (data) {
                if (data.next == -1) {
                    $('#cluster').val(-1);
                    plot_klime(savedData, "Global KLIME Plot", NaN);
                    loadGlobalTable();
                }
                else {
                    pullOneRow(data);
                }
            });
        }
    }
    function main() {
        myChart = echarts.init(document.getElementById('main'));
        loadPage();
        window.onresize = _.debounce(resizePlot, 500);
        $(document).on('click', '#search-trigger', function (e) { loadClusterPlot(e); return true; });
        $('#cluster').change(switchPlot);
    }
    ModelInterpretability.main = main;
})(ModelInterpretability || (ModelInterpretability = {}));
Zepto(ModelInterpretability.main);
