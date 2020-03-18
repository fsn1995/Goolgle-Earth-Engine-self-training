/*
This is to test the performance of different classifier provided by GEE.
Random Forest is the default setting, you may find the scripts for SVM and 
CART at the end, commented.

reference: https://developers.google.com/earth-engine/classification

Note: if the page freezes please comment the batch export part or try it with a 
better computer. 

Shunan Feng
sfeng@icrc.org/fsn.1995@gmail.com
*/

//--------------------------------------------------------------------------//
//                               preparation                                //
//--------------------------------------------------------------------------//
var worldmap = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'); //
var country = ['Iraq'];//CHANGE the NAME of country here!
var countryshape = worldmap.filter(ee.Filter.inList('country_na', country)); // filter country from name list
var roi = countryshape.geometry();// country 
var roiLayer = ui.Map.Layer(roi, {color: 'white'}, 'roi'); // roi property
Map.layers().add(roiLayer); //display roi
Map.centerObject(roi, 7); // set map center

var region = 
    /* color: #009999 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[42.89092757280548, 34.50224391573348],
          [42.89092757280548, 32.32913693569585],
          [45.34087874468048, 32.32913693569585],
          [45.34087874468048, 34.50224391573348]]], null, false);

// study time range
var year_start = 1984; 
var year_end = 2018;
var month_start = 1;
var month_end = 12;

var date_start = ee.Date.fromYMD(year_start, 1, 1);
var date_end = ee.Date.fromYMD(year_end, 12, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var months = ee.List.sequence(month_start, month_end);// time range of months
//--------------------------------------------------------------------------//
//                               GlobCover 2009                             //
//--------------------------------------------------------------------------//
// load ESA LUCC
var lucc = ee.Image('ESA/GLOBCOVER_L4_200901_200912_V2_3')
             .select('landcover').clip(roi);
Map.addLayer(lucc, {}, 'LandcoverESA2009');
var lucc_pixelArea = ee.Image.pixelArea().addBands(lucc);
var lucc_group = lucc_pixelArea.reduceRegion({
    reducer: ee.Reducer.sum().group({
        groupField: 1,
        groupName: 'landcover_class_value'
    }),
    geometry: roi,
    scale: 300,// meters
    bestEffort: true,
});
var lucc_names = ee.Dictionary.fromLists(
    ee.List(lucc.get('landcover_class_values')).map(ee.String),
    lucc.get('landcover_class_names')
);
print('lucc_names',lucc_names);
var lucc_palette = ee.Dictionary.fromLists(
    ee.List(lucc.get('landcover_class_values')).map(ee.String),
    lucc.get('landcover_class_palette')
);       

// Chart functions
function createFeature(roi_class_stats) {
    roi_class_stats = ee.Dictionary(roi_class_stats);
    var class_number = roi_class_stats.get('landcover_class_value');
    var result = {
        lucc_class_number: class_number,
        lucc_class_name: lucc_names.get(class_number),
        lucc_class_palette: lucc_palette.get(class_number),
        area_m2: roi_class_stats.get('sum')
    };
    return ee.Feature(null, result);
}
function createPieChartSliceDictionary(perc) {
    return ee.List(perc.aggregate_array("lucc_class_palette"))
             .map(function(p) { return {'color': p}; }).getInfo();
}
// pie chart of lucc summary
var roi_stats = ee.List(lucc_group.get('groups'));
var lucc_Pie = ee.FeatureCollection(roi_stats.map(createFeature));
var lucc_Piechart = ui.Chart.feature.byFeature({
    features: lucc_Pie,
    xProperty: 'lucc_class_name',
    yProperties: ['area_m2', 'lucc_class_number']
})
.setChartType('PieChart')
.setOptions({
    title: 'Land Cover Summary Chart',
    slices: createPieChartSliceDictionary(lucc_Pie),
    sliceVisibilityThreshold: 0
});
print('LUCC percentage', lucc_Piechart);  

//--------------------------------------------------------------------------//
//                               load landsat                               //
//--------------------------------------------------------------------------//

// load landsat image
var L4 = ee.ImageCollection("LANDSAT/LT04/C01/T1")
           .filterDate(date_start, date_end)
           .filterBounds(roi);
var L5 = ee.ImageCollection("LANDSAT/LT05/C01/T1")
           .filterDate(date_start, '1998-12-31')
           .filterBounds(roi);
var L7 = ee.ImageCollection("LANDSAT/LE07/C01/T1")
           .filterDate(date_start, '2012-12-31') // to exclude L7 when L8 is available
           .filterBounds(roi);
var L8 = ee.ImageCollection("LANDSAT/LC08/C01/T1")
           .filterDate(date_start, date_end)
           .filterBounds(roi);                                    
var landsatRaw = L4.merge(L5).merge(L7).merge(L8);

// convert to TOA and do a simple annual simple composite
var landsatAnnual = ee.ImageCollection.fromImages(
    years.map(function(y) {
        var landsatFilt = landsatRaw.filter(ee.Filter.calendarRange(y, y, 'year'));
        var comp = ee.Algorithms.Landsat.simpleComposite({
            collection: landsatFilt,
            percentile: 75,
            cloudScoreRange: 5
        });
        return comp.set('year', y)
                   .set('month', 1)
                   .set('system:time_start', ee.Date.fromYMD(y, 1, 1));
    }).flatten()
);
var landsat8 = landsatAnnual.filterDate('2013-01-01', date_end)
                            .select(
                                ['B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
                                ['B1', 'B2', 'B3', 'B4', 'B5', 'B7']
                            );

var landsat = landsatAnnual.filterDate(date_start, '2012-12-31')
                           .select(
                               ['B1', 'B2', 'B3', 'B4', 'B5', 'B7']
                           )         
                           .merge(landsat8);      
                           
//--------------------------------------------------------------------------//
//                          training and validation                         //
//--------------------------------------------------------------------------//                           
var label = 'landcover';
var bands = ['B1', 'B2', 'B3', 'B4', 'B5', 'B7'];

var imgRef = ee.Algorithms.Landsat.simpleComposite({
    collection: landsatRaw.filterDate('2009-01-01', '2009-12-31'),
    percentile: 75,
    cloudScoreRange: 5,
    asFloat: true
}).select(bands);

var img = ee.Algorithms.Landsat.simpleComposite({
    collection: landsatRaw.filterDate('2009-01-01', '2009-12-31'),
    percentile: 75,
    cloudScoreRange: 5,
    asFloat: true
}).select(bands);

var training = lucc.addBands(imgRef).sample({
    region: region,
    // scale: 30,
    // seed: 0,
    numPixels: 5000
});

// Make a Random Forest classifier and train it.
var classifier = ee.Classifier.smileRandomForest(10)
    .train({
        features: training,
        classProperty: label,
        inputProperties: bands
    });
// var classifier = ee.Classifier.svm({
//     kernelType: 'RBF',
//     gamma: 0.5,
//     cost: 10
// });

// var trained = classifier.train(training, 'landcover', bands);

var classified = img.classify(classifier);



// Get a confusion matrix representing resubstitution accuracy.
var trainAccuracy = classifier.confusionMatrix();
print('Resubstitution error matrix: ', trainAccuracy);
print('Training overall accuracy: ', trainAccuracy.accuracy());

// Sample the input img with a different random seed to get validation data.
var validation = lucc.addBands(imgRef).sample({
    region: region,
    // scale: 30,
    seed: 1,
    numPixels: 500
    // Filter the result to get rid of any null pixels.
  }).filter(ee.Filter.neq('B1', null));

// Classify the validation data.
var validated = validation.classify(classifier);

// Get a confusion matrix representing expected accuracy.
var testAccuracy = validated.errorMatrix('landcover', 'classification');
print('Validation error matrix: ', testAccuracy);
print('Validation overall accuracy: ', testAccuracy.accuracy());


// Display the input and the classification.
// var color = ee.List(lucc.get('landcover_class_palette'));
var color = [
    'aaefef', 'ffff63', 'dcef63', 'cdcd64', 
    '006300', '009f00', 'aac700', '003b00', 
    '286300', '788300', '8d9f00', 'bd9500', 
    '956300', 'ffb431', 'ffebae', '00785a', 
    '009578', '00dc83', 'c31300', 'fff5d6', 
    '0046c7', 'ffffff', '743411'
];

Map.addLayer(img.clip(roi), {bands: ['B3', 'B2', 'B1'], max: 0.4}, 'landsat');
Map.addLayer(classified.clip(roi), {min: 11, max: 230, palette: color}, 'classification');
// print(lucc_palette, 'lucc palette')

//--------------------------------------------------------------------------//
//                               30yr mapping                               //
//--------------------------------------------------------------------------//

var addClass = function(image) {
    return image.addBands(image.classify(classifier));
};

var classified30 = landsat.map(addClass).select('classification');
print(classified30);
//--------------------------------------------------------------------------//
//                                Exporting                                 // 
//--------------------------------------------------------------------------//
// auto export is done here. However the web page may freeze as it's more than 
// 30 export tasks. Just be patient and try it on a powerful computer.
var batch = require('users/fitoprincipe/geetools:batch');
batch.Download.ImageCollection.toDrive(classified30, 'classiyIraq', {
    scale: 30,
    region: roi
});

// Export.image.toDrive({
//     image: classified.select('classification').clip(roi),
//     folder: 'iraq',
//     description: 'luccIraq30yr',
//     scale: 120,
//     region: roi // If not specified, the region defaults to the viewport at the time of invocation
//   });

// Export.image.toAsset({
//   image: classified.select('classification').clip(roi),
//   description: 'luccIraq30yr',
//   assetId: 'luccIraq',
//   scale: 120,
//   region: roi
// });

// Export.video.toDrive({
//     collection: classified30.select('classified'),
//     description: 'classified30',
//     dimensions: 720,
//     framesPerSecond: 12,
//     region: roi,
//     folder: 'iraq'
//   });

// Export.video.toDrive({
//     collection: landsat.select(['B3', 'B2', 'B1']),
//     description: 'landsatIraq',
//     dimensions: 720,
//     framesPerSecond: 12,
//     region: roi,
//     folder: 'iraq'
//   });


// //------------------------------------------------------//
// //                    random forest
// //------------------------------------------------------//
// var training = lucc.addBands(imgRef).sample({
//     region: region,
//     // scale: 30,
//     seed: 0,
//     numPixels: 5000
// });

// // Make a Random Forest classifier and train it.
// var classifier = ee.Classifier.randomForest(10)
//     .train(training, 'landcover');

// var classified = img.classify(classifier);

//------------------------------------------------------//
//                    CART
//------------------------------------------------------//
// var training = lucc.addBands(imgRef).sample({
//     region: region,
//     scale: 30,
//     numPixels: 5000
// });

// var classifier = ee.Classifier.cart().train({
//     features: training,
//     classProperty: label,
// });

// var classified = img.classify(classifier);
