// Pull in your favorite version of jquery 
require({ 
	packages: [{ name: "jquery", location: "http://ajax.googleapis.com/ajax/libs/jquery/2.1.0/", main: "jquery.min" }] 
});
// Bring in dojo and javascript api classes as well as config.json and content.html
define([
	"esri/SpatialReference", "esri/geometry/Extent", "esri/tasks/query", "esri/layers/ArcGISDynamicMapServiceLayer", "dojo/_base/declare", "framework/PluginBase", "esri/layers/FeatureLayer", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", 
	"esri/symbols/SimpleMarkerSymbol", "esri/graphic", "esri/tasks/RelationshipQuery", "dojo/_base/Color", 	"dijit/layout/ContentPane", "dijit/form/HorizontalSlider", "dojo/dom", 
	"dojo/dom-class", "dojo/dom-style", "dojo/dom-construct", "dojo/dom-geometry", "dojo/_base/lang", "dojo/on", "dojo/parser", 'plugins/species/js/ConstrainedMoveable',
	"dojo/text!./config.json", "jquery", "dojo/text!./html/legend.html", "dojo/text!./html/content.html", 'plugins/species/js/jquery-ui-1.11.0/jquery-ui'
],
function (SpatialReference, Extent, Query, ArcGISDynamicMapServiceLayer, declare, PluginBase, FeatureLayer, SimpleLineSymbol, SimpleFillSymbol, SimpleMarkerSymbol, Graphic, RelationshipQuery, Color,
	ContentPane, HorizontalSlider, dom, domClass, domStyle, domConstruct, domGeom, lang, on, parser, ConstrainedMoveable, config, $, legendContent, content, ui ) {
		return declare(PluginBase, {
			toolbarName: "Species Explorer", showServiceLayersInLegend: false, allowIdentifyWhenActive: false, rendered: false, resizable: false,
			hasCustomPrint: true, usePrintPreviewMap: true, previewMapSize: [600, 400],
			// First function called when the user clicks the pluging icon. 
			initialize: function (frameworkParameters) {
				// Access framework parameters
				declare.safeMixin(this, frameworkParameters);
				// Set initial app size based on split screen state
				this.con = dom.byId('plugins/species-0');
				this.con1 = dom.byId('plugins/species-1');
				if (this.con1 != undefined){
					domStyle.set(this.con1, "width", "265px");
					domStyle.set(this.con1, "height", "250px");
				}else{
					domStyle.set(this.con, "width", "265px");
					domStyle.set(this.con, "height", "250px");
				}	
				// Define object to access global variables from JSON object. Only add variables to config.JSON that are needed by Save and Share. 
				this.config = dojo.eval("[" + config + "]")[0];	
				// Define global config not needed by Save and Share
				this.items = [];
				this.itemsFiltered = [];
				this.atRow = [];
				this.firstRun = "yes";
				this.url = this.config.url;
			},
			// Called after initialize at plugin startup (why all the tests for undefined). Also called after deactivate when user closes app by clicking X. 
			hibernate: function () {
				this.small = "yes";
				if (this.appDiv != undefined){
					$('#' + this.appDiv.id).hide();
					$('#' + this.appDiv.id + 'myTable, #' + this.appDiv.id + 'leftSide, #' + this.appDiv.id + 'rightSide').css('display', 'none');
					$('#' + this.appDiv.id + 'bottomDiv').hide();
					$('#' + this.appDiv.id + 'clickTitle').html("<p>Welcome to the NRN Species Explorer. Use this tool to identify species that may be present in your project area currently or in the future. Export custom species lists, identify priorities, and view models of current and future habitat.  Click a Hexagon to Begin!</p>" + 
																"<p class='headerBottom'><i>Hold the Shift key while dragging your mouse over the map to zoom to your area of interest. </i></p>");
					$('#' + this.appDiv.id + 'myLegendDiv').hide();
				}
				if (this.dynamicLayer != undefined)  {
					this.dynamicLayer.setVisibility(false);
					this.map.graphics.clear();
				}
				if (this.fc != undefined){
					this.fc.clear();
					this.mapClick = "pause";
				}
				if (this.map != undefined){
					this.map.graphics.clear();
				}
				if (this.fcDraw != undefined){
					this.map.removeLayer(this.fcDraw);	
				}
				$('.legend').removeClass("hideLegend");
			},
			// Called after hibernate at app startup. Calls the render function which builds the plugins elements and functions.   
			activate: function () {
				// Hide framework default legend
				$('.legend').addClass("hideLegend");
				if (this.rendered == false) {
					this.rendered = true;							
					this.render();
					// Hide the print button until a hex has been selected
					$(this.printButton).hide();
					this.dynamicLayer.setVisibility(true);
				} else {
					if (this.dynamicLayer != undefined)  {
						this.dynamicLayer.setVisibility(true);	
						if ( this.map.getZoom() > 12 ){
							this.map.setLevel(12)	
						}	
					}
					if (this.fcDraw != undefined){
						this.map.addLayer(this.fcDraw);					
					}
					this.mapClick = "go";
					if (this.small == "yes"){
						this.con = dom.byId('plugins/species-0');
						this.con1 = dom.byId('plugins/species-1');
						if (this.con1 != undefined){
							domStyle.set(this.con1, "width", "265px");
							domStyle.set(this.con1, "height", "250px");
						}else{
							domStyle.set(this.con, "width", "265px");
							domStyle.set(this.con, "height", "250px");
						}
						$('#' + this.appDiv.id).css('height', '20');
						$('#' + this.appDiv.id).show();
						$(this.printButton).hide();
					}	
				}
			},
			// Called when user hits the minimize '_' icon on the pluging. Also called before hibernate when users closes app by clicking 'X'.
			deactivate: function () {
				this.small = "no"
			},	
			// Called when user hits 'Save and Share' button. This creates the url that builds the app at a given state using JSON. 
			// Write anything to you config.json file you have tracked during user activity.		
			getState: function () {
				this.config.extent = this.map.geographicExtent;
				this.config.stateSet = "yes";
				// Get OBJECTIDs of filtered items
				if ( this.itemsFiltered.length > 0 ){
					$.each(this.itemsFiltered, lang.hitch(this,function(i,v){
						this.config.filteredIDs.push(v.OBJECTID)
					}));
				}	
				var state = new Object();
				state = this.config;
				return state;
			},
			// Called before activate only when plugin is started from a getState url. 
			//It's overwrites the default JSON definfed in initialize with the saved stae JSON.
			setState: function (state) {
				this.config = state;
			},
			// Called when the user hits the print icon
			beforePrint: function(printDeferred, $printArea, mapObject) {
				// Add hexagons
				var layer = new ArcGISDynamicMapServiceLayer(this.url);
				layer.setVisibleLayers([0])
				mapObject.addLayer(layer);
				// Add map graphics (selected hexagon) 
				mapObject.graphics.add(new Graphic(this.fc.graphics[0].geometry, this.fc.graphics[0].symbol ));
				// Update data filters section next to printed map
				// Species Name and Taxon: if no filter add -
				var sn = this.config.tsFilters[0]
				var ta = this.config.tsFilters[1]
				if (sn.length == 0){sn = "-"}
				if (ta.length == 0){ta = "-"}
				$('#' + this.appDiv.id + 'psSN').html(sn);
				$('#' + this.appDiv.id + 'psTa').html(ta);
				// Other filters: if no filter add -
				$.each(this.config.filter, lang.hitch(this,function(i,v){
					var val = v.text.toString();
					if (val.length == 0){val ="-"}	
					$('#' + this.appDiv.id + 'ps' + v.field).html(val)
				}))
				// Add content to printed page
				$printArea.append("<div id='title'>NY Species Report</div>")
				$printArea.append("<div id='summary' class='printSummary'>" + $('#' + this.appDiv.id + 'printSummary').html() + "</div>")
				$printArea.append("<div id='tableWrapper'><div id='tableTitle'>Species with Suitable Habitat in Hexagon</div><table id='table' class='printTable'>" + $('#' + this.appDiv.id + 'myPrintTable').html() + "</table></div>");
			
                printDeferred.resolve();
            },	
			// Resizes the plugin after a manual or programmatic plugin resize so the button pane on the bottom stays on the bottom.
			// Tweak the numbers subtracted in the if and else statements to alter the size if it's not looking good.
			resize: function(w, h) {
				cdg = domGeom.position(this.container);
				if (cdg.h == 0) { this.sph = this.height - 80; }
				else { this.sph = cdg.h - 62; }
				domStyle.set(this.appDiv.domNode, "height", this.sph + "px"); 
			},
			// Called by activate and builds the plugins elements and functions
			render: function() {
				this.map.setMapCursor("wait");
				this.mapClick = "go";
				// Define Content Pane		
				this.appDiv = new ContentPane({style:'padding:8px 2px 8px 8px'});
				parser.parse();
				console.log(this)
				dom.byId(this.container).appendChild(this.appDiv.domNode);					
				// Get html from content.html, prepend appDiv.id to html element id's, and add to appDiv
				var idUpdate = content.replace(/id='/g, "id='" + this.appDiv.id);	
				$('#' + this.appDiv.id).html(idUpdate);
				// Custom legend
				// Get the parent element of the map for placement
				var a = $('#' + $(this.map).attr('id')).parent();
				// Use legend.html to build the elements in the ContentPane - update the ids with this.appDiv
				var legHTML = legendContent.replace(/id='/g, "id='" + this.appDiv.id);
				this.legendWin = new ContentPane({ id: this.appDiv.id + "myLegendDiv", innerHTML: legHTML	});
				// Add legend window to maps parent and add class for symbology
				dom.byId(a[0]).appendChild(this.legendWin.domNode)
				$('#' + this.appDiv.id + 'myLegendDiv').addClass('myLegendDiv');
				$('#' + this.appDiv.id + 'myLegendDiv').hide();
				// Make legend div movable
				var p = new ConstrainedMoveable( dom.byId(this.legendWin.id), {
					handle: dom.byId(this.appDiv.id + "myLegendHeader"), within: true
				});
				// Click handler to close legend
				$('#' + this.appDiv.id + 'myLegendDiv .myLegendCloser' ).on('click',lang.hitch(this,function(){
					$('#' + this.appDiv.id + 'myLegendDiv').hide();
				}));
				// Add dynamic map service
				this.dynamicLayer = new ArcGISDynamicMapServiceLayer(this.url, {opacity: 1 - this.config.sliderVal/10});
				this.map.addLayer(this.dynamicLayer);
				this.dynamicLayer.on("load", lang.hitch(this, function () {  
					if (this.config.extent == ""){
						if ( this.map.getZoom() > 12 ){
							this.map.setLevel(12)	
						}	
					}else{
						var extent = new Extent(this.config.extent.xmin, this.config.extent.ymin, this.config.extent.xmax, this.config.extent.ymax, new SpatialReference({ wkid:4326 }))
						this.map.setExtent(extent, true);
						this.config.extent = ""; 	
					}
					if (this.config.visibleLayers.length > 0){	
						this.dynamicLayer.setVisibleLayers(this.config.visibleLayers);
						this.spid = this.config.visibleLayers[0];	
					}
					this.layersArray = this.dynamicLayer.layerInfos;;
				}));				
				this.resize();
				// Create and handle transparency slider
				$('#' + this.appDiv.id + 'slider').slider({ min: 0,	max: 10, value: this.config.sliderVal });
				$('#' + this.appDiv.id + 'slider').on( "slidechange", lang.hitch(this,function( e, ui ) {
					this.config.sliderVal = ui.value;
					this.dynamicLayer.setOpacity(1 - ui.value/10);
				}));				
				// Enable jquery plugin 'tablesorter'
				require(["jquery", "plugins/species/js/jquery.tablesorter.combined"],lang.hitch(this,function($) {
					$("#" + this.appDiv.id + "myTable").tablesorter({
						widthFixed : true,
						headerTemplate : '{content} {icon}', // Add icon for various themes

						widgets: [ 'zebra', 'stickyHeaders', 'filter' ],
						theme: 'blue',
						
						widgetOptions: {
							// jQuery selector or object to attach sticky header to
							stickyHeaders_attachTo : '.wrapper',
							stickyHeaders_includeCaption: false // or $('.wrapper')
						}
					})	
					// called after table filter ends when typing in Species Name or Taxon windows
					.bind('filterEnd',lang.hitch(this,function(e, filter){					
						if ( filter.filteredRows == 0 && filter.totalRows > 0){
							$('#' + this.appDiv.id + 'selectNone').slideDown('fast');
							this.noneSelected();
							this.config.tsFilters = $.tablesorter.getFilters( $('.tablesorter') );						
						}else{
							if (this.config.stateSet == "no"){
								this.config.tsFilters = $.tablesorter.getFilters( $('.tablesorter') );
								$('#' + this.appDiv.id + 'selectNone').slideUp('fast');
								// Use filters on visible table to update filters on print table
								this.isFiltered = "no"
								// If something was filtered by taxon or species name in view table add filtered class to print table row
								$("#" + this.appDiv.id + "myTable tr.trclick").each(lang.hitch(this,function (i, row){
									if($(row).hasClass("filtered")){
									this.isFiltered = "yes"
										var filterName = $(row).children('td:first').text()
										$("#" + this.appDiv.id + "myPrintTable tr:contains('"+ filterName +"')").addClass("filtered")
									}	
								}))
								// Check if anything in view table is filtered by taxon or species name
								if (this.isFiltered == "no"){
									// If no, remove filtered class from all rows in printed table
									$("#" + this.appDiv.id + "myPrintTable tr").each(lang.hitch(this,function (i, row){
										$(row).removeClass("filtered");
									}))	
								}	
							}
						}
					}));
					
				}));	
				// Enable jquery plugin 'chosen'
				require(["jquery", "plugins/species/js/chosen.jquery"],lang.hitch(this,function($) {
					var config = { '.chosen-select'           : {allow_single_deselect:true, width:"138px", disable_search:true},
						'.chosen-select-multiple'     : {width:"263px"} }
					for (var selector in config) { $(selector).chosen(config[selector]); }
				}));	
				// Add hex for display/mouse-over
				this.fcDraw = new FeatureLayer(this.url + "/0", {
					mode: FeatureLayer.MODE_SNAPSHOT,
					outFields: ["OBJECTID"]
				});
				this.map.addLayer(this.fcDraw);	
				this.fcDraw.on('update-end', lang.hitch(this,function(){
					this.map.setMapCursor("default");
				}));
				dojo.connect(this.fcDraw, "onMouseOver", lang.hitch(this,function(e){
					this.map.setMapCursor("pointer");
				}));
				dojo.connect(this.fcDraw, "onMouseOut", lang.hitch(this,function(e){
					this.map.setMapCursor("default");
				}));				
				// Add hex feature class and click events
				this.fc = new FeatureLayer(this.url + "/0", {
					mode: FeatureLayer.MODE_SELECTION,
					outFields: ["*"]
				});
				var hlsymbol = new SimpleFillSymbol( SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(
					SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 2 ), new Color([125,125,125,0.15])
				);
				this.fc.setSelectionSymbol(hlsymbol);
				this.fc.on("selection-complete", lang.hitch(this,function(evt){
					var features = evt.features;
					if (features.length > 0){
						$('#' + this.appDiv.id + 'spDetails').slideUp('slow');
						$('#' + this.appDiv.id + 'myLegendDiv').hide();
						$('#' + this.appDiv.id + 'rmText').html('Show Suitable Habitat On Selection');
						if (this.config.stateSet == "no") {
							this.spid = -1;
							this.config.visibleLayers = [this.spid];
							this.dynamicLayer.setVisibleLayers(this.config.visibleLayers); 
							this.config.speciesRow = "";
							this.config.detailsVis = "none";
						}
						this.config.selectedObId = features[0].attributes.OBJECTID;
						$('#' + this.appDiv.id + 'psHe').html(features[0].attributes.hexzone)
						var relatedTopsQuery = new RelationshipQuery();
						relatedTopsQuery.outFields = ["*"];
						relatedTopsQuery.relationshipId = 0;
						relatedTopsQuery.objectIds = [features[0].attributes.OBJECTID];
						this.fc.queryRelatedFeatures(relatedTopsQuery, lang.hitch(this,function(relatedRecords) {
							var fset = relatedRecords[features[0].attributes.OBJECTID];
							this.items = $.map(fset.features, function(feature) {
								return feature.attributes;
							});
							this.updateTable(this.items);
						}));
					}
				}));
				this.map.addLayer(this.fc);				
				// If setState select feature
				if (this.config.selectedObId.length != "") {
					var q = new Query()
					q.where = 'OBJECTID = ' + this.config.selectedObId;
					this.fc.selectFeatures(q,FeatureLayer.SELECTION_NEW);
				}	
				this.map.on("click", lang.hitch(this,function(evt){
					if (this.mapClick == "go"){
						var selectionQuery = new Query();
						var tol = 0;
						var x = evt.mapPoint.x;
						var y = evt.mapPoint.y;
						var queryExtent = new Extent(x-tol,y-tol,x+tol,y+tol,evt.mapPoint.spatialReference);
						selectionQuery.geometry = queryExtent;
						this.fc.selectFeatures(selectionQuery,FeatureLayer.SELECTION_NEW);	
						this.mapSide = evt.currentTarget.id
					}	
				}));
				// Print and CSV clicks
				$('#' + this.appDiv.id + 'printReport').on('click',lang.hitch(this,function(e) { 
					//$(this.printButton).trigger('click')
					alert("Methods are coming soon. Brace yourself, it's going to be awesome!")
				}));
				// Table row click
				$('#' + this.appDiv.id + 'myTable').on('click','.trclick',lang.hitch(this,function(e) { 
					// Get text from Species cell
					this.config.speciesRow = e.currentTarget.children[0].innerHTML;
					// Find object position in items by row number
					$.each(this.items, lang.hitch(this,function(i,v){
						if ( v.Display_Name == this.config.speciesRow ){
							this.atRow = this.items[i];
							return false;
						}		
					}));
					// Figure out species code and see if it's in the map service
					this.config.sppcode = this.atRow.sppcode;
					$.each(this.layersArray, lang.hitch(this,function(i,v){
						if (v.name == this.config.sppcode){
							this.config.visibleLayers = [];
							this.spid = v.id;
							return false;
						}	
					}))
					// If it is and the checkbox is checked, show it 
					if ( $('#' + this.appDiv.id + 'rMapCb').is(":checked") ){
						this.config.visibleLayers.push(this.spid);
						this.dynamicLayer.setVisibleLayers(this.config.visibleLayers); 
						$('#' + this.appDiv.id + 'rmText').html('Click to Hide Suitable Habitat');
						this.buildLegend();
						$('#' + this.appDiv.id + 'myLegendDiv').show();
						$('#' + this.appDiv.id + 'sliderDiv').css('display', 'inline-block');
					}else{
						$('#' + this.appDiv.id + 'rmText').html('Click to Show Suitable Habitat');
					}		
					// Update Sepecies Details
					this.updateSpeciesDetails();
				}));
				// Suitable Habitat check box
				$('#' + this.appDiv.id + 'rMapCb').on('change', lang.hitch(this,function() { 
					if	( $('#' + this.appDiv.id + 'rMapCb').is(':checked') ){
						if (this.config.speciesRow == ""){
							$('#' + this.appDiv.id + 'rmText').html('Now Select Row to See Suitable Habitat');
						}else{	
							this.config.visibleLayers.push(this.spid);
							$('#' + this.appDiv.id + 'rmText').html('Click to Hide Suitable Habitat');
							this.buildLegend();
							$('#' + this.appDiv.id + 'myLegendDiv').show();
							$('#' + this.appDiv.id + 'sliderDiv').css('display', 'inline-block');
						}
					}else{
						this.config.visibleLayers = [-1];
						$('#' + this.appDiv.id + 'rmText').html('Click to Show Suitable Habitat');
						$('#' + this.appDiv.id + 'myLegendDiv').hide();
						$('#' + this.appDiv.id + 'sliderDiv').css('display', 'none');
					}	
					this.dynamicLayer.setVisibleLayers(this.config.visibleLayers); 
				}));		
				// Species Details Key Clicks
				$('#' + this.appDiv.id + 'sdkClose').on('click',lang.hitch(this,function(){
					$('#' + this.appDiv.id + 'spDetailsKey').slideUp();
				}));	
				//Use selections on chosen menus to update this.config.filter object
				require(["jquery", "plugins/species/js/chosen.jquery"],lang.hitch(this,function($) {			
					$('#' + this.appDiv.id + 'rightSide .filter').chosen().change(lang.hitch(this,function(c, p){
						$("body").css("cursor", "progress");
						// Figure out which menu was selected
						var filterField = c.currentTarget.id.split("-").pop() 
						// Get select text
					/*	if (c.currentTarget.selectedOptions){
							var selectedText = c.currentTarget.selectedOptions[0].innerHTML
						}
*/						// multiple select menu handler
						if (filterField == "Associations"){
							// Get index of the object where field equals 'Associations' in this.config.filter object
							$.each(this.config.filter, lang.hitch(this,function(i,v){
								if (filterField == v.field){ 
									this.ind = i; 
								}	
							}));
							// Add selected field to value array in object where field equals 'Associations'
							if (p.selected){
								this.config.filter[this.ind].value.push(p.selected)
								// reset text array and add text of selected options
								this.config.filter[this.ind].text = [];
								$.each(c.currentTarget.selectedOptions, lang.hitch(this,function(j,k){
									this.config.filter[this.ind].text.push(k.innerHTML)  
								}));								
							}
							// Remove selected field to value array in object where field equals 'Associations'
							else{
								var index = this.config.filter[this.ind].value.indexOf(p.deselected);
								if (index > -1) {
									this.config.filter[this.ind].value.splice(index, 1);
									this.config.filter[this.ind].text.splice(index, 1);
								}
							}			
						}	
						// Single select menu handler
						else{
							// Get object where active menu id matches the field value. If option is seleceted add its value to the value property in current object.
							// If deselected, make value empty text in current object
							$.each(this.config.filter, lang.hitch(this,function(i,v){
								if (filterField == v.field){
									if (p){
										this.config.filter[i].value = p.selected;
										// Add text of selected option
										this.config.filter[i].text = c.currentTarget.selectedOptions[0].innerHTML;
									}else{
										this.config.filter[i].value = "";
										this.config.filter[i].text = "";
									}	
								}	
							}))								
						}
						// Remove filtered2 class from all rows to make them visible. If anything is filtered the class will be added back to the correct row in the filterItems function
						$("#" + this.appDiv.id + "myTable tr.trclick").each(lang.hitch(this,function (i, row){
							$(row).removeClass("filtered2");
						}))
						$("#" + this.appDiv.id + "myPrintTable tr").each(lang.hitch(this,function (i, row){
							$(row).removeClass("filtered2");
						}))
						// No items are selected
						if (this.config.filter[0].value.length == 0 && this.config.filter[1].value.length == 0 && this.config.filter[2].value.length == 0 && this.config.filter[3].value.length == 0 && this.config.filter[4].value.length == 0){
							this.itemsFiltered = [];
							// Check if Species or Taxon filters have hidden every row on their own. If they have every row will have 3 classes (trclick, odd or even, and filtered).
							// If one row has less than 3 classes (meaning filtered is missing) then the Species/Taxon filter will return a visible row so we need to hide the selectNone div
							$("#" + this.appDiv.id + "myTable tr.trclick").each(lang.hitch(this,function (i, row){
								var c = $(row).attr('class').split(/\s+/);
								if (c.length < 3){
									$('#' + this.appDiv.id + 'selectNone').slideUp('fast');
								}		
							}))
							$("body").css("cursor", "default");
						}
						// At least one item is selected
						else{
							this.filterItems()
						}	
					}));
				}));
				this.rendered = true;				
			},
			// Called when this.config.filter has values for filtering
			filterItems: function (){
				// Make copy of this.items for filtering
				this.itemsFiltered = this.items.slice();	
				// Loop throuhg filter object and remove non-matches from itemsFiltered
				$.each(this.config.filter, lang.hitch(this,function(i,v){
					this.keepArray = [];
					// Find non-matching item positions and add to removeArray
					// For multi-select menu
					if (v.field == "Associations"){
						if (this.config.filter[i].value.length > 0){
							$.each(this.config.filter[i].value, lang.hitch(this,function(i1,v1){
								$.each(this.itemsFiltered, lang.hitch(this,function(i2,v2){
									if (v2[v1] == 'Y'){
										this.keepArray.push(v2.Display_Name)
									}	
								}));
							}))	
							$.each(this.itemsFiltered, lang.hitch(this,function(i,v){	
								this.remove = "yes"
								$.each(this.keepArray, lang.hitch(this,function(i1,v1){
									if (v.Display_Name == v1){
										this.remove = "no"
									}
								}));
								if (this.remove == "yes"){
									this.hideRow(v.Display_Name)
								}	
							}));						
						}	
					}	
					// For single-select menu
					else if (v.value != ""){
						// Make an array of all values and split them by a comma
						this.valArray = v.value.split(",");
						// This is for a single select menu where you want one value from one field. That means remove everything that doesn't match that one value
						// If only one value in array remove rows that don't equal that value
						if (this.valArray.length == 1){
							$.each(this.itemsFiltered, lang.hitch(this,function(i2,v2){
								if (v2[v.field] != this.valArray[0]){
									this.hideRow(v2.Display_Name)
								}	
							}));									
						}
						/* This is for a single select menu where one selection looks for mutiple values within a field. Provide a comma-
						separated-list of the values you DO NOT want shown in the options value property. The code below will remove rows with
						provided values */
						// If array has two or more values loop through and keep rows that match those values
						if (this.valArray.length > 1){
							// Loop through each value
							$.each(this.valArray, lang.hitch(this,function(i3,v3){
								// Check each value against each row and if value matches the display name remove the row
								$.each(this.itemsFiltered, lang.hitch(this,function(i4,v4){
									if (v4[v.field] == v3){
										this.hideRow(v4.Display_Name)
									}	
								}));	
							}));			
						}	
					}	
				}));
				// If no rows visible (number of filtered items equlas number of data rows), show message to clear some filters
				if ( $("#" + this.appDiv.id + "myTable tr.filtered2").length == $("#" + this.appDiv.id + "myTable tr.trclick").length ){
					$('#' + this.appDiv.id + 'selectNone').slideDown('fast');
				}else{
					$('#' + this.appDiv.id + 'selectNone').slideUp('fast');
				}
				$("body").css("cursor", "default");				
			},	
			// Hide rows filtered by chosen selects
			hideRow: function (rowName){
				// Add filterer2 class to hide the row
				$("#" + this.appDiv.id + "myTable tr:contains('"+ rowName +"')").addClass("filtered2")
				$("#" + this.appDiv.id + "myPrintTable tr:contains('"+ rowName +"')").addClass("filtered2")
				// Get species name from selected row and check to see if the selected row is being hidden
				var selRow = $('tr.selected').find('td')
				if ( $(selRow[0]).html() == rowName ){
					this.noneSelected();
				}
			},			
			// Build tabele rows based on map click or itemsFiltered objects
			updateTable: function (items){
				// Show print button
				$(this.printButton).show();
				// Clear table rows from visible and print table 
				$('#' + this.appDiv.id + 'myTable tbody tr').remove()				
				$('#' + this.appDiv.id + 'myPrintTable tbody tr').remove()
				// Sort items by Display_Name
				function compare(a,b) {
					if (a.Display_Name < b.Display_Name){
						return -1;
					}
					if (a.Display_Name > b.Display_Name){
						return 1;
					}	
					return 0;
				}
				items = items.sort(compare);
				// Add rows
				this.rowType = "even";
				$.each(items, lang.hitch(this,function(i,v){
					if (v.Display_Name != "Unknown"){
						if (this.rowType == "even"){
							this.rowType = "odd";	
						}else{
							this.rowType = "even";
						}
						// Update visible table						
						var newRow ="<tr class='trclick " + this.rowType +"' id='" + this.appDiv.id + "row-" + i + "'><td>" + v.Display_Name + "</td><td>" + v.TAXON + "</td></tr>" ;
						$('#' + this.appDiv.id + 'myTable tbody').append(newRow)
						// Update print table
						var newPrintRow ="<tr>" + 
							"<td>" + v.Display_Name + "</td>" + 
							"<td>" + v.TAXON + "</td>" +
							"<td>" + v.Condition_C + "</td>" + 
							"<td>" + v.Threat_C + "</td>" +
							"<td>" + v.Range_position + "</td>" +
							"<td>" + v.Clim_Vuln_C + "</td>" + 
							"<td>" + v.CCVIS_mean_cls + "</td>" +
							"<td>" + v.fut_rpatch_ratio_cls + "</td>" + 
							"<td>" + v.Range_Shift_NY + "</td>" +
							"<td>" + v.Rare_spp + "</td>" + 
							"<td>" + v.SGCN + "</td>" +
							"<td>" + v.NHP_tConnect_label + "</td>" +
							"<td>" + v.NHPc_rel_patch_qnt + "</td>" +
							"<td>" + v.GAP_rel_patch_qnt + "</td>" +
							"<td>" + v.FVc_rel_patch_qnt + "</td>" + 
							"<td>" + v.McK_rel_patch_qnt + "</td>" +
							"<td>" + v.USFS_CCTA_cur_qnt + "</td>" +
						"</tr>"
						$('#' + this.appDiv.id + 'myPrintTable tbody').append(newPrintRow)
					}
				}));
				// Update table
				require(["jquery", "plugins/species/js/jquery.tablesorter.combined"],lang.hitch(this,function($) {
					$('#' + this.appDiv.id + 'myTable').trigger("update");
				}));
				$('#' + this.appDiv.id + 'clickTitle').html('Species with Suitable Habitat in Hexagon')
				$('#' + this.appDiv.id + 'spDetailsHeader').html('<img src="plugins/species/images/leftArrow.png" width="20" alt="left arrow">  Click Rows for Species Details')
				//Resize main container - check which side first
				if (this.mapSide == "map-1_container"){
					this.useCon = this.con1;
				}else{
					this.useCon = this.con;
				}
				if ($(this.useCon).width() < 300){
					$( this.useCon ).animate({
						width: "604",
						height: "573px"
					}, 500 , lang.hitch(this,function() {
						$('#' + this.appDiv.id + 'myTable, #' + this.appDiv.id + 'leftSide, #' + this.appDiv.id + 'rightSide').css('display', 'block');
						$('#' + this.appDiv.id + 'bottomDiv').show();
						this.resize();	
					}));
					
				}	
				// Build if setState was called
				if (this.config.stateSet == "yes"){
					$("#" + this.appDiv.id + "myTable tr:contains('"+ this.config.speciesRow +"')").addClass("selected");		
					// check if species details was visible for setState
					if (this.config.detailsVis == "inline-block"){
						$.each(this.items, lang.hitch(this,function(i,v){
							if (v.Display_Name == this.config.speciesRow){
								this.atRow = this.items[i];
								return false;
							}	
						}));
						this.updateSpeciesDetails();
					}	
					// Update dropdown menu selections from previous session
					$("#" + this.appDiv.id + "ch-TAXON").val(this.config.filter[1].value).trigger("chosen:updated");
					$("#" + this.appDiv.id + "ch-MAX_habavail_up60").val(this.config.filter[2].value).trigger("chosen:updated");
					$("#" + this.appDiv.id + "ch-fut_rpatch_ratio_cls").val(this.config.filter[3].value).trigger("chosen:updated");
					$("#" + this.appDiv.id + "ch-Cons_spp").val(this.config.filter[4].value).trigger("chosen:updated");
					if (this.config.filter[0].value.length > 0){
						$("#" + this.appDiv.id + "ch-Associations").val(this.config.filter[0].value).trigger("chosen:updated");
					}	
					if (this.config.filter[0].value.length > 0 || this.config.filter[1].value.length > 0 || this.config.filter[2].value.length > 0 || this.config.filter[3].value.length > 0 || this.config.filter[4].value.length > 0){
						this.filterItems();
					}
					this.config.stateSet = "no";
					$('#' + this.appDiv.id + 'rMapCb').prop( "checked", true ); 
					$('#' + this.appDiv.id + 'rMapCb').trigger("change");	
					// Update the tablesorter filter on Species Name and Taxon
					require(["jquery", "plugins/species/js/jquery.tablesorter.combined"],lang.hitch(this,function($) {
						$.tablesorter.setFilters( $('table'), this.config.tsFilters, true );
					}));	
				}
				else{
					if (this.config.filter[0].value.length > 0 || this.config.filter[1].value.length > 0 || this.config.filter[2].value.length > 0 || this.config.filter[3].value.length > 0 || this.config.filter[4].value.length > 0){
						this.filterItems();
					}	
				}	
			}, 
			// add values from items row to species details table
			updateSpeciesDetails: function(){
				$('#' + this.appDiv.id + 'spDetails .spd').each(lang.hitch(this,function (i, att){
					var id = att.id.split('-')[1]
					if (this.atRow[id] === undefined) {
					}else if(this.atRow[id] === null) {
						$('#' + att.id).html(' null')
					}else{
						$('#' + att.id).html(this.atRow[id])	
					}
				}));	
				$('#' + this.appDiv.id + 'spDetailsHeader').html('Selected Species Details <img id="' + this.appDiv.id + 'sdkOpen" class="sdkOpen" src="plugins/species/images/info.png" alt="Info icon">');
				$('#' + this.appDiv.id + 'spDetails').slideDown();
				this.config.detailsVis = "inline-block";
				$('#' + this.appDiv.id + 'spDetails').css('display', 'inline-block');
				//update row background color
				$('#' + this.appDiv.id + 'myTable tr').each(lang.hitch(this,function (i, row){
					if (row.id != ""){						
						$('#' + row.id).removeClass("selected");
					}	
				}))
				$("#" + this.appDiv.id + "myTable tr:contains('"+ this.config.speciesRow +"')").addClass("selected")
				$('#' + this.appDiv.id + 'sdkOpen').on('click',lang.hitch(this,function(){
					$('#' + this.appDiv.id + 'spDetailsKey').slideDown();
				}));
			},
			// Build legend from JSON request
			buildLegend: function(){
				// Refresh Legend div content and height and width
				var hmw = { height: '235px', minWidth: '150px' }	
				$('#' + this.appDiv.id + 'myLegendDiv').css(hmw);
				$('#' + this.appDiv.id + 'mySpeciesLegend').html('');
				$.getJSON( this.url +  "/legend?f=pjson&callback=?", lang.hitch(this,function( json ) {
					var speciesArray = [];
					//get legend pics
					$.each(json.layers, lang.hitch(this,function(i, v){
						if (v.layerName == this.config.sppcode){
							speciesArray.push(v)	
						}	
					}));
					// Set Title
					$('#' + this.appDiv.id + 'mySpeciesLegend').append("<div style='display:inline;text-decoration:underline;font-weight:bold;margin-top:5px;'>" + this.config.speciesRow + "</div><br>")
					// build legend items
					$.each(speciesArray[0].legend, lang.hitch(this,function(i, v){
						$('#' + this.appDiv.id + 'mySpeciesLegend').append("<p style='display:inline;'>" + v.label + "</p><img style='margin-bottom:-5px; margin-left:5px;' src='data:image/png;base64," + v.imageData + "' alt='Legend color'><br>")		
					})) 
					// Set legend div height and width
					var h = $('#' + this.appDiv.id + 'mySpeciesLegend').height() + 60;
					var w = $('#' + this.appDiv.id + 'mySpeciesLegend').width() + 30;
					var hw = { height: h + 'px', width: w + 'px' }	
					$('#' + this.appDiv.id + 'myLegendDiv').css(hw);
				})); 	
			},
			noneSelected: function(){
				// Uncheck the view species Suitable Habitat checkbox and trigger change to clear visible layers and hide legend
				$('#' + this.appDiv.id + 'rMapCb').prop( "checked", false ); 
				$('#' + this.appDiv.id + 'rMapCb').trigger("change");
				// Hide species details box, update header text, and clear any selected row  
				$('#' + this.appDiv.id + 'spDetails').slideUp();
				$('#' + this.appDiv.id + 'rmText').html('Show Suitable Habitat On Selection');
				this.config.detailsVis = "none";
				$('#' + this.appDiv.id + 'spDetailsHeader').html('&#8592; Click Rows for Species Details')
				$("#" + this.appDiv.id + "myTable tr.trclick").each(lang.hitch(this,function (i, row){
					$(row).removeClass("selected");
				}));	
			}	
		});
	});						   