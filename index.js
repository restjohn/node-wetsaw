const fs = require('fs');
const mapnik = require('mapnik');
const mapTiles = require('global-mercator');
const MetaTile = require('./meta-tiles');

mapnik.register_default_fonts();
mapnik.register_default_input_plugins();

// let map = new mapnik.Map(2048, 2048);
// map.load('./node-mapnik-sample-code/stylesheet.xml', (err, map) => {

//   if (err) {
//     throw err;
//   }

//   let tileUL = [8, 8, 5];
//   let tileLR = [15, 15, 5];
//   let bboxUL = mapTiles.googleToBBoxMeters(tileUL);
//   let bboxLR = mapTiles.googleToBBoxMeters(tileLR);
//   let bbox = [bboxUL[0], bboxLR[1], bboxLR[2], bboxUL[3]];
//   console.log("bbox UL: " + bboxUL + "\nbbox LR: " + bboxLR);
//   console.log("bbox: " + bbox);

//   // map.resize(2048, 2048);
//   map.zoomToBox(bbox);
//   var im = new mapnik.Image(2048, 2048);
//   map.render(im, {}, function(err, im) {
//     if (err) {
//       throw err;
//     }
//     im.encode('png', function(err, buffer) {
//       if (err) {
//         throw err;
//       }
//       fs.writeFile('example/map.png', buffer, function(err) {
//         if (err) {
//           throw err;
//         }
//       });
//     });
//   });
// });

// const bboxIn = [178, 0, -179, 2];
// const bboxIn = [-180, 40.94, -174.37, 66.52];
// const bboxIn = [-180, 40.94, -174.37, 66.51];
const bboxIn = [-135.55, 66.28, -134.49, 66.72];
const minZoom = 6, maxZoom = 6;
const metaTiles = { zoomLevels: [], bbox: bboxIn };
const [xMin, yMin, xMax, yMax] = bboxIn;
if (yMin >= yMax) {
  throw 'invalid bounding box: ' + bboxIn;
}
const bboxNormalized = []
if (xMax > xMin) {
  bboxNormalized.push(bboxIn);
}
else if (xMin > xMax) {
  bboxNormalized.push([xMin, yMin, 180, yMax]);
  bboxNormalized.push([-180, yMin, xMax, yMax]);
}
let zoom = maxZoom + 1;
while (zoom-- > minZoom) {
  metaTiles.zoomLevels.push(zoom);
  const zoomKey = String(zoom);
  const zoomMetaTiles = metaTiles[zoomKey] = metaTiles[zoomKey] || [];
  bboxNormalized.forEach(bbox => {
    for (let mt of MetaTile.metaTilesIntersectingBbox(...bbox, zoom)) {
      zoomMetaTiles.push(mt);
    }
  });
}

metaTiles.zoomLevels.forEach(zoom => {
  console.log('='.repeat(32) + '\n zoom level ' + zoom + '\n' + '='.repeat(32));
  metaTiles[String(zoom)].forEach(tile => {
    console.log('meta-tile at zoom ' + tile.zoom + '; upper-left ' + [tile.x, tile.y] + '; bbox ' + tile.bboxMeters());
  });
});
