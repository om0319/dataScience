$(function() {
    // REMARK: jQuery calls this function when the html page finishes loading

    // ********************simple error handling*******************************************
    // REMARK: This error handling is not part of the book tutorial. 
    // It is a preventive measure to intervene in case someone tries to open the index.html file in
    // the browser without an active server

    function onerror(err) {
        var div = $('.err'), p = window.location.protocol, usingHttp = p==='http:' || p==='https:';
		
        $('[data-http='+usingHttp+']', div)
                .removeClass('hide')               // show the http or non-http error message
                .find('em').text(err || '(none)'); // fill in any error detail in the <em> placeholder
        $('main h1').after(div.removeClass('hide')); // put the err message below the top level <h1>
    }

    // load CSV data and when it finishes, invoke function main to initialize the app
    try {
        d3.csv('medicines.csv', function(xhr, data) {
            if (!data) return onerror(xhr.statusText);
            main(data);
        }); 
    } catch (err) { onerror(err.message); }
   // ********************End simple error handling*******************************************
   
    var tableTemplate = $([
        "<table class='table table-hover table-condensed table-striped'>",
        "  <caption></caption>",      
        "  <thead><tr/></thead>",
        "  <tbody></tbody>",
        "</table>"
    ].join('\n'));
	
    CreateTable = function(data,variablesInTable,title){
        var table = tableTemplate.clone();
        var ths = variablesInTable.map(function(v) { return $("<th>").text(v) });
        $('caption', table).text(title);
        $('thead tr', table).append(ths);
        data.forEach(function(row) {
            var tr = $("<tr>").appendTo($('tbody', table));
            variablesInTable.forEach(function(varName) {
                // example:  varName = 'value.stockAvg' 
                //           -> keys = [ 'value', 'stockAvg' ]
                //           -> val = row['value']['stockAvg']    
                var val = row, keys = varName.split('.'); 
                keys.forEach(function(key) { val = val[key] });
                tr.append($("<td>").text(val));
            });
        });
        return table;
    }

    main = function(inputdata){ 
        //Our  data: normally this is fetched from a server but in this case we read it from a local .csv file
        var medicineData = inputdata ;
	
        // Convert date to correct format
        // This way crossfilter will recognise the date variable 
        var dateFormat = d3.time.format("%d/%m/%Y");
        medicineData.forEach(function (d) {
            d.Day = dateFormat.parse(d.Date);     
        })
	
        //We put the variables we shall show in the table in an Array, that way we can loop through them when creating the table code.
        var variablesInTable = ['MedName','StockIn','StockOut','Stock','Date','LightSen']
        // only show a sample of the data
        var sample = medicineData.slice(0,5);
        //Create the table
        var inputTable = $("#inputtable");
        inputTable
                .empty()
                .append(CreateTable(sample,variablesInTable,"The input table"));
	
        //************************************************
        //  Adding Crossfilter.js
        //************************************************

        //Initialize a Crossfilter instance
        CrossfilterInstance = crossfilter(medicineData);
	
        // Let's create our first dimension: the medicine name dimension 
        var medNameDim = CrossfilterInstance.dimension(function(d) {return d.MedName;});
	
        //    FILTERING DATA
	
        // We can now filter data 
        var dataFiltered= medNameDim.filter('Grazax 75 000 SQ-T')
        // and show the filtered data using our CreateTable function
        var filteredTable = $('#filteredtable');
        filteredTable
                .empty()
                .append(CreateTable(dataFiltered.top(5),variablesInTable,'Our First Filtered Table'));
//	let's register another dimension: the date dimension
        var DateDim = CrossfilterInstance.dimension(function(d) {return d.Day;});
//        Now we can sort on date instead of medicine name
        filteredTable
                .empty()
                .append(CreateTable(DateDim.bottom(5),variablesInTable,'Our First Filtered Table'));
        
        //   MAPREDUCE   
        //reduce count
        var countPerMed = medNameDim.group().reduceCount();
        variablesInTable = ["key","value"]
        filteredTable
                .empty()
                .append(CreateTable(countPerMed.top(Infinity),variablesInTable,'Reduced Table'));
	  
        // A Custom Reduce function require 3 components: an initiation, an add and a remove function
        // Initial reduce function, will set starting values of the p object
        var reduceInitAvg = function(p,v){
            return {count: 0, stockSum : 0, stockAvg:0};
        }
        //reduce function that is called when adding a record
        var reduceAddAvg = function(p,v){
            p.count += 1;
            p.stockSum  = p.stockSum  + Number(v.Stock);
            p.stockAvg = Math.round(p.stockSum  / p.count);
            return p;
        }
        //reduce function that is called when removing a record
        var reduceRemoveAvg = function(p,v){
            p.count -= 1;
            p.stockSum  = p.stockSum  -  Number(v.Stock);
            p.stockAvg = Math.round(p.stockSum  / p.count);
            return p;
        }
        //.reduce() takes the 3 functions(reduceInitAvg(),reduceAddAvg() and reduceRemoveAvg()) as input arguments
        dataFiltered = medNameDim.group().reduce(reduceAddAvg,reduceRemoveAvg,reduceInitAvg)
        //business as always: draw the result table
        variablesInTable = ["key","value.stockAvg"]
        filteredTable
                .empty()
                .append(CreateTable(dataFiltered.top(Infinity),variablesInTable,'Reduced Table'));
 
        medNameDim.filterAll()
		 
        //************************************************
        //  Adding DC.js
        //************************************************
	  
        //  Stock over time data
        var SummatedStockPerDay = DateDim.group().reduceSum(function(d){return d.Stock;})
        //  The Line Chart
        var minDate = DateDim.bottom(1)[0].Day;
        var maxDate = DateDim.top(1)[0].Day;
        var StockOverTimeLineChart = dc.lineChart("#StockOverTime");
	
        //  deliveries per day graph 
        StockOverTimeLineChart
                .width(null) // null means size to fit container
                .height(400)
                .dimension(DateDim)
                .group(SummatedStockPerDay)
                .x(d3.time.scale().domain([minDate,maxDate]))
                .xAxisLabel("Year 2015")
                .yAxisLabel("Stock")
                .margins({left: 60, right: 50, top: 50, bottom: 50})
		
        //   Average stock per medicine rowchart
        var AverageStockPerMedicineRowChart = dc.rowChart("#StockPerMedicine"); 
	 
        var AvgStockMedicine =  medNameDim.group().reduce(reduceAddAvg,reduceRemoveAvg,reduceInitAvg); 
        AverageStockPerMedicineRowChart
                .width(null) 
        // null means size to fit container
                .height(1200)
                .dimension(medNameDim)
                .group(AvgStockMedicine)
                .margins({top: 20, left: 10, right: 10, bottom: 20})
                .valueAccessor(function (p) {return p.value.stockAvg;}); 
	
        //light sensitivity Stock
        var lightSenDim = CrossfilterInstance.dimension(function(d) {return d.LightSen;}); 
        var SummatedStockLight =  lightSenDim.group().reduceSum(function(d) {return d.Stock;}); 
	
        var LightSensitiveStockPieChart = dc.pieChart("#LightSensitiveStock");
	
        LightSensitiveStockPieChart
                .width(null) // null means size to fit container
                .height(300)
                .dimension(lightSenDim)
                .radius(90)
                .group(SummatedStockLight)  
//	The resetFilters() function will reset our dc.js data and redraw the graphs
        resetFilters = function(){
            StockOverTimeLineChart.filterAll();
            LightSensitiveStockPieChart.filterAll();
            AverageStockPerMedicineRowChart.filterAll();
            dc.redrawAll();
        }
//        When an element with class btn-success is clicked (our reset button), resetFilters() is called. 
        $('.btn-success').click(resetFilters);

        //Render the graph
        dc.renderAll(); 
    }
})
