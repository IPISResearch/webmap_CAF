var version = "0.0.1";

var Config = {
	mapId: "CAFV3",
	apiScope: "caf",
	apiScopeDev: "caf",
	useMapBoxInspector: false,
	templateURL: "_templates/main.html",
	showDisclaimerOnFirstUse: false,
	disclaimerUrl: "_templates/disclaimer.html",
	infoUrl: "_templates/info.html",
	// starting point for map
	mapCoordinates: {
		x: 22,
		y: 5.5,
		zoom: 5.5,
		bounds: [[14.05, 0.20], [30.38, 10.26]],
		maxZoom: 18,
		minZoom: 5
	},
	defaultBaseLayerIndex: 4,
	// if preLoad is defined, this occurs before the map is shown - used to pre-generate datasets etc.
	__preLoad: function () {
		Data.init();
	},
	// baselayer info
	baselayers: [
		{index: 1, id: "satellite", label: "Satellite", url: "mapbox://styles/ipisresearch/ciw6jsekm003a2jql0w0a7qca"},
		{index: 4, id: "streetscar", label: "Streets (IPIS)", url: "mapbox://styles/ipisresearch/cjix950k084i72rno4tpu5mkm"}, // this is streets CAR
		{index: 2, id: "streets", label: "Streets (OSM)", url: "mapbox://styles/ipisresearch/ciw6jpn5s002r2jtb615o6shz"},
		{index: 3, id: "empty", label: "Empty", url: "mapbox://styles/ipisresearch/cjav3e31blm5w2smunhb32kzm"}
	],
	defaultRefLayer: "ref_layer", // reference layer where to insert all custom layers - should be present in all baselayers
	colorMap:{
		"Diamant": "#78bfcc",
		"Or": "#cca621",
		"Carbone": "#364971",
		"Argent": "#dee5e8",
		"Cassitière" : "#b87acc",
		"default": "#a3b4aa"
	},
	// layer info
	layers: {
		miningsites_new: {
			id: "miningsites_new",
			filterId: 1,
			label: "Recent Mining Sites <small>(2019)</small>",
			source: function(layer){
				if (layer.data){
					return layer.data;
				}
				
				console.log("Fetching data for layer " + layer.id);
				var dataSourceUrl = "http://ipis.annexmap.net/api/data/caf/miningsites2019";
				
				FetchService.json(dataSourceUrl,function(data){
					if (data && data.type === "FeatureCollection"){
						
						var minerals = [];
						
						data.features.forEach(function(feature){
							feature.properties.mineralList = feature.properties.minerals.split(",");
							feature.properties.workers = parseInt(feature.properties.workers_numb);
							for (var i = 0, max = feature.properties.mineralList.length; i<max; i++){
								feature.properties.mineralList[i] = feature.properties.mineralList[i].trim();
								if (minerals.indexOf(feature.properties.mineralList[i]) < 0) minerals.push(feature.properties.mineralList[i]);
							}
							
							feature.properties.mineral = feature.properties.mineralList[0];
							feature.properties.chantiers = feature.properties.chantiers_numb;
							
							// services are represented in one line
							feature.properties.servicesList = [];
							feature.properties.servicesList.push(feature.properties.services1_name, feature.properties.services2_name, feature.properties.services3_name);

							feature.properties.services = feature.properties.servicesList.filter(Boolean).join("<br>");

							
						});
						
						
						// build filter based on minerals found
						var filterItems = [];
						
						minerals.forEach(function(mineral){
							filterItems.push({value: mineral, color: Config.colorMap[mineral] || Config.colorMap.default});
						});
						
						layer.filters = [
							{
								id: "mineral",
								index: 141,
								label: "Minerals",
								items: filterItems,
								onFilter: MapService.genericMultiFilter,
								filterProperty: "mineralList",
								array: true
							}
						];
						var parent = layer.labelElm.parentElement;
						UI.appendLayerFilters(layer, parent);
						
						
						layer.display = {
							type: 'circle',
								visible: true,
								canToggle: true,
								size:{
								property: 'workers',
									interval: [[1, 3.5], [50, 4.5], [500, 6.5], [5000, 8.5]],
							default: 3
							},
							color: {
								property: "mineral",
									data: filterItems
							},
							belowLayer: 'ref_layer_mines'
						}
					}
					layer.data=data;
					MapService.addLayer(layer);
				});
			},
			sourceId: "miningsites_new",
			display: {
				visible: true,
				canToggle: true,
				zIndex: 98
			},
			popupOnhover: "name",
			onClick: function(item){
			  UI.popup(item.properties,"minePopup",item.geometry.coordinates,true);
			},
			onLoaded : function(){

				Chart.render(); // render chart
				
				if (!Config.layers.miningsites_new.data) return;

				map.boxZoom.disable(); // disable default zoom

				var canvas = map.getCanvasContainer(); // target canvas
				var start; // start xy coordinates on mouse move or up
				var curr; // current xy coordinates held
				var box; // draw box
				var hasGhost = false;
				
				canvas.addEventListener("mousedown", mouseDown, true);
				
				// add gray mines dots to map
				function addMineGhosts(){
					if (hasGhost) return;
					map.addLayer({
						"id": "miningsites_ghost",
						"type": "circle",
						"source": "miningsites_new",
						"paint": {
							'circle-color': "rgba(190,190,190,0.63)",
							'circle-radius' : {
								'default': 3,
								'property': 'workers',
								'type': 'interval',
								'stops': [[1, 3.5], [50, 4.5], [500, 6.5], [5000, 8.5]]
							}
						}
					});
					hasGhost = true;
				}
				 
				// Get mouse position
				function mousePosition(e) {
					var rect = canvas.getBoundingClientRect();
					//console.log(rect);
					return new mapboxgl.Point(
					e.clientX - rect.left - canvas.clientLeft,
					e.clientY - rect.top - canvas.clientTop
					);
				}

				function mouseDown(e) {
					// Continue if shiftkey is pressed
					if (!(e.shiftKey && e.button === 0)) return;

					// remove filter first
					map.setFilter("miningsites_new", undefined);
					 
					// Disable default drag on shiftkey
					map.dragPan.disable();
					 
					// Add mouse events to document
					document.addEventListener("mouseup", onMouseUp);
					document.addEventListener("keydown", onKeyDown);
					document.addEventListener("mousemove", onMouseMove);
					 
					// get first mouse position
					start = mousePosition(e);
					// console.log(start);
				}

				function onMouseMove(e) {
					// Capture mouse position
					curr = mousePosition(e);
					 
					// Append box
					if (!box) {
					box = document.createElement("div");
					box.classList.add("drawbbox");
					canvas.appendChild(box);
				}
					 
					var minX = Math.min(start.x, curr.x),
						minY = Math.min(start.y, curr.y),
						maxX = Math.max(start.x, curr.x),
						maxY = Math.max(start.y, curr.y);
					 
					// Adjust width and xy position box
					var pos = "translate(" + minX + "px," + minY + "px)";

					box.style.transform = pos;
					box.style.WebkitTransform = pos;
					box.style.width = maxX - minX + "px";
					box.style.height = maxY - minY + "px";
				}

				function onMouseUp(e) {
					// store xy coordinates
					finish([start, mousePosition(e)]);
					// console.log(finish);
				}
					 
				function onKeyDown(e) {
					// Check if ESC is pressed
					if (e.keyCode === 27) finish();
				}
					 
				function finish(bbox) {
					// Remove events from DOM on "finish".
					document.removeEventListener("mouseup", onMouseUp);
					document.removeEventListener("keydown", onKeyDown);
					document.removeEventListener("mousemove", onMouseMove);
					 
					if (box) {
						box.parentNode.removeChild(box);
						box = null;
					}

					Config.layers.miningsites_new.bbox = bbox;
					addMineGhosts();
					 
					// If bbox exists, query rendered features
					if (bbox) {
						var features = map.queryRenderedFeatures(bbox, { layers: ["miningsites_new"] });
						//  console.log(features);
	
	
						var filter = features.reduce(function(temp, feature) {
							temp.push(feature.properties.id);
							return temp;
						}, ['in', 'id']);

						var inverseFilter = features.reduce(function(temp, feature) {
							temp.push(feature.properties.id);
							return temp;
						}, ['!in', 'id']);
						
						map.setFilter("miningsites_ghost", inverseFilter);
						map.setFilter("miningsites_new", filter);
					}
						
					map.dragPan.enable(); // enable drag on pan
					Chart.render();
				}


				map.on("mousemove", function(e) {
					var features = map.queryRenderedFeatures(e.point, { layers: ["miningsites_new"] });
					map.getCanvas().style.cursor = (features.length) ? "pointer" : "";
				});

			
			},
			
			onFilter: function(){
				Chart.render();
			}
		},
		miningsites_old: {
			id: "miningsites_old",
			filterId: 14,
			label: "Older Mining Sites <small>(2014-2017)</small>",
			source: function(layer){
				if (layer.data) return layer.data;

				console.log("Fetching data for layer " + layer.id);
				var url_2017 = "http://ipis.annexmap.net/api/data/caf/miningsites";
				var url_2014 = "http://ipis.annexmap.net/api/data/caf/miningsites2014";
				
				var _data = {};

				FetchService.json(url_2017,function(data){
					_data._2017 = data;
					process();
				});

				FetchService.json(url_2014,function(data){
					_data._2014 = data;
					process();
				});
				
				function process(){
					if (_data._2017 && _data._2014){

						var minerals = [];
						var mineralMapping = {
							"Gold" : "Or",
							"Diamond" : "Diamant",
							"Gold & Diamond" : "Or",
							"Cassiterite" : "Cassitière"
						};
						var data = _data._2014;
						
						data.features.forEach(function(feature){
							feature.properties.mineral = mineralMapping[feature.properties.mineral] || "Autre";
							feature.properties.minerals = feature.properties.mineral;
							if (minerals.indexOf(feature.properties.mineral)<0) minerals.push(feature.properties.mineral);
						});
						
						_data._2017.features.forEach(function(feature){
							feature.properties.id = "_2017" + feature.properties.id;
							feature.properties.mineral = feature.properties.substance_1;
							feature.properties.mineral = mineralMapping[feature.properties.mineral] || "Autre";
							feature.properties.minerals = feature.properties.mineral;
							if (minerals.indexOf(feature.properties.mineral)<0) minerals.push(feature.properties.mineral);
							data.features.push(feature);
							//console.log(feature);
						});
						
						console.log(minerals);

						var filterItems = [];

						minerals.forEach(function(mineral){
							filterItems.push({value: mineral, color: Config.colorMap[mineral] || Config.colorMap.default});
						});

						layer.filters = [
							{
								id: "mineral",
								index: 141,
								label: "Minerals",
								items: filterItems,
								onFilter: MapService.genericFilter,
								filterProperty: "mineral",
								array: true
							}
						];
						var parent = layer.labelElm.parentElement;
						UI.appendLayerFilters(layer, parent);


						layer.display = {
							type: 'circle',
							visible: true,
							canToggle: true,
							size:{
								property: 'workers',
								interval: [[1, 3.5], [50, 4.5], [500, 6.5], [5000, 8.5]],
								default: 3
							},
							color: {
								property: "mineral",
								data: filterItems
							},
							belowLayer: 'ref_layer_mines'
						};

						layer.data=data;
						MapService.addLayer(layer);
						
						//console.log(_data._2014);
					}
				}
				
				
			},
			sourceId: "miningsites_old",
			display: {
				visible: false,
				canToggle: true,
				zIndex: 97
			},
			onClick: function(item){
			  UI.popup(item.properties,"minePopup",item.geometry.coordinates,true);
			},
		},
		miningActivities: {
			id: "miningactivities",
			filterId: 18,
			label: "Recent mining activities <small>(2013-2017)</small>",
			source: "http://ipis.annexmap.net/api/data/caf/miningactivities",
			sourceId: "miningactivities",
			visible: false,
			display: {
				type: 'circle',
				radius: [
					"interpolate",
					["exponential", 2],
					["zoom"],
					0, 0,
					18, 6000
				],
				color: "rgb(204, 155, 120)",
				circleBlur: 0.7,
				circleStrokeWidth: 0,
				circleStrokeColor: "transparent",
				visible: false,
				canToggle: true,
				zIndex: 97
			}
		},
		miningzoneskp: {
			id: "miningzoneskp",
			filterId: 26,
			label: "KP Compliance Zones <small>(2017)</small>",
			source: "http://ipis.annexmap.net/api/data/caf/miningzoneskp",
			sourceId: "miningzoneskp",
			display: {
				type: 'fill',
				fillColor: '#78bfcc',
				fillOpacity: 0.5,
				hoverOpacity: 0.8,
				visible: false,
				canToggle: true,
				zIndex: 92
			},
			onClick: function (item, lngLat) {
				UI.popup(item.properties, "miningzoneskpPopup", lngLat, true);
			}
		},
		mineralConcessions: {
			id: "mineralconcessions",
			filterId: 5,
			label: "Mineral Concessions",
			source: "http://ipis.annexmap.net/api/data/caf/mineralconcessions",
			sourceId: "mineralconcessions",
			display: {
				type: 'fill',
				fillColor: {
					property: "perm_type_long",
					data: [
						{value: "Permis de Recherche", color: "#43b7ff"},
						{value: "Autorisation de Reconnaissance Minière", color: "#2396dd"},
						{value: "Permis d'Exploitation", color: "#36ae71"},
						{value: "Permis d'Exploitation Artisanale Semi-Mecanisee", color: "#9f2bae"}
					]
				},
				fillOpacity: 0.5,
				hoverOpacity: 0.8,
				visible: false,
				canToggle: true,
				zIndex: 96
			},
			subLayers: [
				{
					type: "line",
					paint: {
						'line-color': {
							property: "perm_type_long",
							type: "categorical",
							stops: [
								["Permis de Recherche", "#43b7ff"],
								["Autorisation de Reconnaissance Minière", "#2396dd"],
								["Permis d'Exploitation", "#36ae71"],
								["Permis d'Exploitation Artisanale Semi-Mecanisee", "#9f2bae"]
							]
						},
						'line-opacity': 1,
						'line-width': 1
					}
				}
			],
			filters: [
				{
					id: "permType", index: 51, label: "Type", items:
						[
							{value: "Permis de Recherche", color: "#43b7ff"},
							{value: "Autorisation de Reconnaissance Minière", color: "#2396dd"},
							{value: "Permis d'Exploitation", color: "#36ae71"},
							{value: "Permis d'Exploitation Artisanale Semi-Mecanisee", color: "#9f2bae"}
						],
					onFilter: MapService.genericFilter, filterProperty: "perm_type_long"
				},
				{
					id: "resources", index: 52, label: "Resources", items:
						[
							{value: "Gold", color: "#aaaaaa"},
							{value: "Diamond", color: "#aaaaaa"},
							{value: "Gold and Diamond", color: "#aaaaaa"},
							{value: "Iron", color: "#aaaaaa"},
							{value: "Limestone", color: "#aaaaaa"},
							{value: "Colombo-Tantalite", color: "#aaaaaa"},
							{value: "Unknown", color: "#aaaaaa"}
						],
					onFilter: MapService.genericFilter, filterProperty: "resources"
				}
			],
			onClick: function (item, lngLat) {
				UI.popup(item.properties, "mineralConcessionsPopup", lngLat, true);
			},
			onFilter: function (item, lngLat) {
				console.log("filter");
			}
		}
	}
};
