/* 
Practice with Image.
In this part will cover basic operations in GEE including clipping,
band math, differencing etc.

Shunan Feng
sfeng@icrc.org
*/

// load one scene of Landsat 8 TOA image covering Geneva
var image = ee.Image('LANDSAT/LC08/C01/T1_TOA/LC08_196028_20190917');
// add the layer of true color composite and display
Map.addLayer(image, {bands: ['B4', 'B3', 'B2']} ,'landsat 8');
// print the image property on the console
print(image, 'image property');

// import landsat annual greenest composite
var l8 = ee.Image("LANDSAT/LC8_L1T_ANNUAL_GREENEST_TOA/2017")
Map.addLayer(l8, {bands: ['B4', 'B3', 'B2']} ,'landsat annual');

/* 
load shapefile and filter Switzerland. The shapefile is in the format 
of FeatureCollection. The dataset is taken from 
https://developers.google.com/earth-engine/datasets/catalog/USDOS_LSIB_SIMPLE_2017
*/
var worldmap = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'); //
var country = ['Switzerland'];//CHANGE the NAME of country here!
var countryshape = worldmap.filter(ee.Filter.inList('country_na', country)); // filter country from name list
var roi = countryshape.geometry();// country 
var roiLayer = ui.Map.Layer(roi, {color: 'white'}, 'roi'); // roi property
Map.layers().add(roiLayer); //display roi
Map.centerObject(roi, 7); // set map center

// import landsat annual greenest composite
var l8clip = ee.Image("LANDSAT/LC8_L1T_ANNUAL_GREENEST_TOA/2017")
           .clip(roi); // clip by defined roi
print(l8clip);
Map.addLayer(l8clip, {bands: ['B4', 'B3', 'B2'], max: 0.4}, 'landsat annual clip');

// band math
// the simplest way
var ndvi = l8clip.normalizedDifference(['B5', 'B4']).rename('NDVI');

// // the hard way
// var nir = l8clip.select('B5');
// var red = l8clip.select('B4');
// var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');

// // more flexible way
// var ndvi = l8clip.expression(
//     '(NIR - RED) / (NIR + RED)', {
//       'NIR': l8clip.select('B5'),
//       'RED': l8clip.select('B4')
// });

Map.addLayer(ndvi.select('NDVI'), {min: -1, max: 1, palette: ['red', 'white', 'green']}, 'ndvi');

// mask low ndvi areas
var ndviHigh = ndvi.updateMask(ndvi.gte(0.5));
Map.addLayer(ndviHigh.select('NDVI'), {min: -1, max: 1, palette: ['red', 'white', 'green']}, 'ndviHigh');


var l8clip2016 = ee.Image("LANDSAT/LC8_L1T_ANNUAL_GREENEST_TOA/2016")
           .clip(roi); // clip by defined roi
var ndvi2016 = l8clip2016.normalizedDifference(['B5', 'B4']).rename('NDVI'),
    ndviDiff = ndvi.select('NDVI').subtract(ndvi2016.select('NDVI'));
Map.addLayer(ndviDiff.lt(-0.2), {}, 'ndvi difference');