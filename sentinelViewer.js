/*
This is to search for most recent sentinel 2 data (10 m resolution for optical bands)
and export to google drive
Shunan Feng
sfeng@icrc.org
*/
var roi = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[14.231704933620449, 13.336219671177922],
          [14.231704933620449, 13.004602290312237],
          [14.775528175807949, 13.004602290312237],
          [14.775528175807949, 13.336219671177922]]], null, false);


var roiLayer = ui.Map.Layer(roi, {color: 'white'}, 'roi');
Map.layers().add(roiLayer);//display roi
Map.centerObject(roi, 9);

// import sentinel
var s2 = ee.ImageCollection("COPERNICUS/S2_SR")
           .filterBounds(roi)
           .filterDate('2019-10-20', '2019-11-06')
           .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));

print(s2);
// Map.addLayer(s2, {bands: ['TCI_R', 'TCI_G', 'TCI_B']});

var meanS2 = s2.select(['TCI_R', 'TCI_G', 'TCI_B']).mean().clip(roi);
print(meanS2);
Map.addLayer(meanS2, {bands: ['TCI_R', 'TCI_G', 'TCI_B']});

Export.image.toDrive({
    image: meanS2,
    folder: 'folder', // the folder name in your google drive
    description: 'Chad',
    scale: 10, // unit in meters
    region: roi // If not specified, the region defaults to the viewport at the time of invocation
  });
