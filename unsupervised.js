/* 
The purpose is to utilize the Sentinel 1 data to apply unsupervised
classification in the study area. The preprocessing of Sentinel is 
adapted from 
https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD

Shunan Feng
sfeng@icrc.org
*/
//-----------------------------------------------------------------//
//                         preparation                             //
//-----------------------------------------------------------------//
var roi = /* color: #98ff00 */ee.Geometry.Polygon(
    [[[20.093458496777316, 32.170913130590506],
      [20.066335999218722, 32.1337074302111],
      [20.052259766308566, 32.12527590395817],
      [20.027540528027316, 32.119169829576016],
      [20.03818353339841, 32.07670678315495],
      [20.038526856152316, 32.06361487896362],
      [20.044363342968722, 32.04964811542833],
      [20.102728211132785, 32.051976057411295],
      [20.137747132031222, 32.08194301997349],
      [20.143240296093722, 32.10230331145486],
      [20.13259729072263, 32.15318418312599],
      [20.115431153027316, 32.16800698216542]]]);
var roiLayer = ui.Map.Layer(roi, {color: 'FF0000'}, 'roi');
Map.layers().add(roiLayer);//display roi
Map.centerObject(roi, 8);

// load image
var imgVV = ee.ImageCollection('COPERNICUS/S1_GRD')
        .filterBounds(roi)
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
        .filter(ee.Filter.eq('instrumentMode', 'IW'))
        .select('VV')
        .map(function(image) {
          var edge = image.lt(-30.0);
          var maskedImage = image.mask().and(edge.not());
          return image.updateMask(maskedImage);
        });

var desc = imgVV.filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));
var asc = imgVV.filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));

var spring = ee.Filter.date('2019-03-01', '2019-04-20');
var lateSpring = ee.Filter.date('2019-04-21', '2019-06-10');
var summer = ee.Filter.date('2019-06-11', '2019-08-31');

var descChange = ee.Image.cat(
        desc.filter(spring).mean(),
        desc.filter(lateSpring).mean(),
        desc.filter(summer).mean())
        .clip(roi);

var ascChange = ee.Image.cat(
        asc.filter(spring).mean(),
        asc.filter(lateSpring).mean(),
        asc.filter(summer).mean())
        .clip(roi);

// Map.setCenter(5.2013, 47.3277, 12);
Map.addLayer(ascChange, {min: -25, max: 5}, 'Multi-T Mean ASC', true);
Map.addLayer(descChange, {min: -25, max: 5}, 'Multi-T Mean DESC', true);

// traning
var training = ascChange.sample({
    region: roi,
    scale: 10,
    numPixels: 5000
});

// //-----------------------------------------------------------------//
// //                         Classification                          //
// //-----------------------------------------------------------------//

// change the number of classes here, 5 means 5 classes
var clusterer = ee.Clusterer.wekaKMeans(5).train(training);

// // Cluster the input using the trained clusterer.
var classified = ascChange.cluster(clusterer);
Map.addLayer(classified.randomVisualizer(), {}, 'clusters');