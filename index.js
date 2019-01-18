const fs = require('fs');
const mapnik = require('mapnik');
const mkdirp = require('mkdirp');
const sharp = require('sharp');
const MetaTile = require('./meta-tile');
const mapnikPool = require('mapnik-pool')(mapnik);
const mapTiles = require('global-mercator');

mapnik.register_default_fonts();
mapnik.register_default_input_plugins();

// http://tools.geofabrik.de/calc/#type=geofabrik_standard&bbox=-76.6915,39.2346,-76.5235,39.3593&tab=1&grid=1&proj=EPSG:3857
const bboxIn = [-76.6915, 39.2346, -76.5235, 39.3593];
const minZoom = 12, maxZoom = 14;

// const bboxIn = [-76.7018, 39.0431, -75.8307, 39.62];
// const minZoom = 10, maxZoom = 10;

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
    console.log('writing tile ' + metaTile.zoom + '/' + x + '/' + y + ' from meta-pixels ' + JSON.stringify(region));
    mkdirp.sync('tiles/' + metaTile.zoom + '/' + x);
    metaTileInput.clone().extract(region).toFile('tiles/' + metaTile.zoom + '/' + x + '/' + y + '.png', function(err) {
      if (err) {
        console.log('error writing tile ' + tile + ': ' + err);
      }
    });
  }
};

mkdirp.sync('tiles');

const stylePath = '/Users/stjohnr/docker/geostack/openstreetmap-carto/openstreetmap-carto-local.xml';
// const stylePath = '/Users/stjohnr/sandbox/wetsaw/node-mapnik-sample-code/stylesheet.xml';
const mapPool = mapnikPool.fromString(fs.readFileSync(stylePath, 'utf-8'), { size: 2048, bufferSize: 0 });
metaTiles.zoomLevels.forEach(zoom => {
  console.log('='.repeat(32) + '\n zoom level ' + zoom + '\n' + '='.repeat(32));
  metaTiles[String(zoom)].forEach(tile => {
    console.log('meta-tile at zoom ' + tile.zoom + '; upper-left ' + [tile.x, tile.y] + '; bbox ' + tile.bboxMeters());
    mapPool.acquire(function(err, map) {
      if (err) {
        throw err;
      }
      new Promise(function(resolve, reject) {
        map.zoomToBox(tile.bboxMeters());
        const im = new mapnik.Image(2048, 2048);
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
        // uncomment to keep meta-tile pngs for posterity
        // im.saveSync('tiles/meta-' + tile.x + '-' + tile.y + '-' + tile.zoom + '.png', 'png');
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
    })
  });
});

