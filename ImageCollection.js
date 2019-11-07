/* 
This part is the practice with ImageCollection regarding simple
filtering, mapping functions over a collection, cloud masking etc.

//
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

// load landsat 8 level 2 surface reflectance dataset
var imageCollection = ee.ImageCollection("LANDSAT/LC08/C01/T1_SR")
                        .filterBounds(roi)
                        .filterDate('2019-01-01', '2019-06-01');
print(imageCollection);


// // cloud/snow/water mask
// pixel_qa contains fmask information: 
// bit 0: fill, bit 1: clear, bit 2: water, 
// bit 3: cloud shadow, bit 4: snow/ice bit 5: cloud
// fmask for surfaceReflectance8
var fmaskL8sr = function(image) {
    var cloudShadowBitmask = 1 << 3;
    var cloudsBitMask = 1 << 5;
    var waterBitmask = 1 << 2;
    var snowBitmask = 1 << 4;
    // QA band pixel value
    var qa = image.select('pixel_qa');
    // set cloud and shadows to 0
    var mask = qa.bitwiseAnd(cloudShadowBitmask).eq(0)
        .and(qa.bitwiseAnd(cloudsBitMask).eq(0))
        .and(qa.bitwiseAnd(waterBitmask).eq(0))
        .and(qa.bitwiseAnd(snowBitmask).eq(0));
    return image.updateMask(mask);
};

// apply cloud mask
var l8 = imageCollection.map(fmaskL8sr);