var Chart = function(){

    var me = {};
    var chart;
    var currentScope = "mines";
    var chartTitle;
    var maxWorkers = 0;

    me.render = function(){

        if (Config.useStory) return;

        chartTitle = document.getElementById("chart_title");
        var subtitle = document.getElementById("chart_subtitle");
        var legend = document.getElementById("legend");
        if (!subtitle) legend.innerHTML = Template.get("chart");

        if (chart) chart = chart.destroy();

        var sourceData = Config.layers.miningsites_new.data;
        if (sourceData){

            var features = sourceData.features;
            var doFilter = true;
            if (Config.layers.miningsites_new.bbox){
                features = map.queryRenderedFeatures(Config.layers.miningsites_new.bbox, { layers: ["miningsites_new"] });
                doFilter = false; // queryRenderedFeatures is already filtered
            }

            var max =  sourceData.features.length;
            var _maxWorkers = 0;

            var totalMines = 0;
            var dataMines = {};
            var totalWorkers = 0;
            var dataWorkers = {};

            features.forEach(function(feature){
                var passed = true;

                if (doFilter && Config.layers.miningsites_new.filteredIds){
                    passed = Config.layers.miningsites_new.filteredIds.indexOf(feature.properties.id)>=0;
                }

                if (passed){
                    totalMines++;
                    totalWorkers += (feature.properties.workers || 0);
                    var mineral = feature.properties.mineral || "Autre";
                    dataMines[mineral] = (dataMines[mineral] || 0) + 1;
                    dataWorkers[mineral] = (dataWorkers[mineral] || 0) + feature.properties.workers;
                }
                _maxWorkers += (feature.properties.workers || 0);
            });
            maxWorkers = Math.max(maxWorkers,_maxWorkers);

            var current = totalMines;
            var data = dataMines;
            var tooltip = " sites miniers";
            if (currentScope === "workers"){
                current = totalWorkers;
                max = maxWorkers;
                data = dataWorkers;
                tooltip = " creuseurs";
            }

            subtitle.innerHTML = current + " de " + max + tooltip;
            legend.classList.add("show");

            var chartData = {
                columns: [],
                colors: [],
                type : 'donut',
                onclick: function (d, i) { /*console.log("onclick", d, i);*/ },
                onmouseover: function (d, i) { /*console.log("onmouseover", d, i);*/ },
                onmouseout: function (d, i) { /*console.log("onmouseout", d, i);*/ }
            };

            for (var key in data){
                if (data.hasOwnProperty(key)){
                    chartData.columns.push([key,data[key]]);
                    chartData.colors[key] = Config.colorMap[key] || "grey";
                }
            }

            chart = c3.generate({
                bindto: '#chart1',
                size:{
                    height: 220,
                    width: 190
                },
                data: chartData,
                donut: {
                    title: current
                },
                legend: {show: false},
                tooltip: {
                    format: {
                        title: function (d) { return 'Substance&nbsp;minérale&nbsp;principale'},
                        value: function (value, ratio, id) {
                            return value + tooltip.split(" ").join("&nbsp;");
                        }
                        // value: d3.format(',') // apply this format to both y and y2
                    }
                }
            });
        }
    };

    me.setScope = function(scope){
        currentScope = scope;
        var other = (scope === "mines") ? "workers" : "mines";
        document.getElementById("tab_" + scope).classList.remove("inactive");
        document.getElementById("tab_" + other).classList.add("inactive");


        if(chartTitle){
            if (scope === "mines"){
                chartTitle.innerHTML = "Sites miniers visibles";
            }else{
                chartTitle.innerHTML = "Creuseurs visibles";
            }
        }
        me.render();
    };

    EventBus.on(EVENT.filterChanged,me.render);
    EventBus.on(EVENT.baseLayerChanged,function(){
        setTimeout(me.render,1000);
    });


    return me;

}();