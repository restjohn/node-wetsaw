const fs = require('fs');
const mapnik = require('mapnik');
const mapTiles = require('global-mercator');
const tilebelt = require('tilebelt');

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

const bboxIn = [178, 0, -179, 2];
const minZoom = 13, maxZoom = 13;
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
    console.log('bbox: ' + bbox);
    const [normXMin, normYMin, normXMax, normYMax] = bbox;
    const ulTile = mapTiles.lngLatToGoogle([normXMin, normYMax], zoom);
    const lrTile = mapTiles.lngLatToGoogle([normXMax, normYMin], zoom);
    console.log('upper left: ' + ulTile + ' lower right: ' + lrTile);
    /*
    This bitwise operation computes the left-most and upper-most 256-pixel, XYZ tile
    of the 8x8 meta-tile.  This works because ANDing the XYZ tile coordinate with -8
    (32-bit two's complement 11111111111111111111111111111000) forces the last 3 bits
    in the tile coordinate to 0, which produces the greatest multiple of 8 less than
    the given XYZ coordinate, which would be the left/upper-most XYZ coordinate of
    the 8x8 meta-tile containing the XYZ tile.
     */
    const ulMetaTile = [ulTile[0] & -8, ulTile[1] & -8];
    const lrMetaTile = [lrTile[0] & -8, lrTile[1] & -8];
    console.log('ul meta: ' + ulMetaTile + ' lr meta: ' + lrMetaTile);
    for (let x = ulMetaTile[0]; x <= lrMetaTile[0]; x += 8) {
      for (let y = ulMetaTile[1]; y <= lrMetaTile[1]; y += 8) {
        const ulBbox = mapTiles.googleToBBox([x, y, zoom]);
        const lrBbox = mapTiles.googleToBBox([x + 7, y + 7, zoom]);
        const metaBbox = [ulBbox[0], lrBbox[1], lrBbox[2], ulBbox[3]];
        console.log('ul box: ' + ulBbox + ' lr box: ' + lrBbox);
        zoomMetaTiles.push({ "zoom": zoom, "bbox": metaBbox, "uppperLeftXYZ": [x, y] });
      }
    }
  });
}

metaTiles.zoomLevels.forEach(zoom => {
  console.log('='.repeat(32) + '\n zoom level ' + zoom + '\n' + '='.repeat(32));
  metaTiles[String(zoom)].forEach(tile => {
    console.log('meta-tile at zoom ' + tile.zoom + '; upper-left ' + tile.uppperLeftXYZ + '; bbox ' + tile.bbox);
  });
});
