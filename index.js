const fs = require('fs');
const mapnik = require('mapnik');
const sharp = require('sharp');
const MetaTile = require('./meta-tile');

mapnik.register_default_fonts();
mapnik.register_default_input_plugins();

// const bboxIn = [178, 0, -179, 2];
// const bboxIn = [-180, 40.94, -174.37, 66.52];
// const bboxIn = [-180, 40.94, -174.37, 66.51];
const bboxIn = [-135.55, 66.28, -134.49, 66.72];
const minZoom = 3, maxZoom = 3;
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

/**
 *
 * @param {MetaTile} metaTile
 * @param {sharp} sharpPipeline
 */
const cutXYZTiles = function(metaTile, pngBuffer) {
  const metaTileInput = sharp(pngBuffer);
  for (let tile of metaTile.xyzTiles()) {
    const [x, y] = tile;
    const px = (x - metaTile.x) * 256;
    const py = (y - metaTile.y) * 256;
    const region = { left: px, top: py, width: 256, height: 256 };
    metaTileInput.clone().extract(region).toFile('map.' + metaTile.zoom + '-' + x + '-' + y + '.png', function(err) {
      if (err) {
        console.log('error writing tile ' + tile + ': ' + err);
      }
    });
  }
};

const map = new mapnik.Map(2048, 2048);
new Promise(function(resolve, reject) {
  map.load('./node-mapnik-sample-code/stylesheet.xml', (err, map) => {
    if (err) {
      reject(err);
    }
    else {
      resolve(map);
    }
  });
})
.then(function(map) {
  metaTiles.zoomLevels.forEach(zoom => {
    console.log('='.repeat(32) + '\n zoom level ' + zoom + '\n' + '='.repeat(32));
    metaTiles[String(zoom)].forEach(tile => {
      console.log('meta-tile at zoom ' + tile.zoom + '; upper-left ' + [tile.x, tile.y] + '; bbox ' + tile.bboxMeters());
      map.zoomToBox(tile.bboxMeters());
      const im = new mapnik.Image(2048, 2048);
      new Promise(function(resolve, reject) {
        map.render(im, {}, function(err, im) {
          if (err) {
            reject(err);
          }
          else {
            resolve(im);
          }
        });
      })
      .catch(function(err) {
        throw err;
      })
      .then(function(im) {
        return new Promise(function(resolve, reject) {
          im.encode('png', function(err, buffer) {
            if (err) {
              reject(err);
            }
            else {
              resolve(buffer);
            }
          });
        });
      })
      .catch(function(err) {
        throw err;
      })
      .then(function(pngBuffer) {
        return cutXYZTiles(tile, pngBuffer);
      });
    });
  });
});

