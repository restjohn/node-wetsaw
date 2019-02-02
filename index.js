const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');

const commandLineOptions = [
  { name: 'help', type: Boolean, description: 'display this help message' },
  { name: 'bbox', type: parseFloat, typeLabel: '<float>', multiple: true, description: 'bounding box in longitude/latitude values separated by spaces, <west> <south> <east> <north>' },
  { name: 'zmin', type: parseInt, description: 'XYZ tile map minimum zoom level', typeLabel: '<int>' },
  { name: 'zmax', type: parseInt, description: 'XYZ tile map maximum zoom level', typeLabel: '<int>' },
  { name: 'style', description: 'path to the Mapnik XML style document' },
  { name: 'gpkg', description: 'path to the GeoPackage file to create or update', defaultValue: 'tiles.gpkg' },
  { name: 'table', description: 'name of the tile table create in the GeoPackage; defaults to the basename of the GeoPackage file without the .gpkg extension' },
  { name: 'scale', type: parseFloat, typeLabel: '<float>', description: 'scale to apply to the tile images; the output tile size will be the scale * 256', defaultValue: 1.0 }
];

const args = commandLineArgs(commandLineOptions, { camelCase: true });
const { help, bbox, zmin: minZoom, zmax: maxZoom, style, gpkg, table, scale } = args;

if (help || !(bbox && Number.isInteger(minZoom) && Number.isInteger(maxZoom))) {
  console.log(commandLineUsage([{ header: 'Usage:', optionList: commandLineOptions }]));
  process.exit(0);
}

const MetaTile = require('./meta-tile');
const fs = require('fs');
const path = require('path');
const mapnik = require('mapnik');
// const mkdirp = require('mkdirp');
const mapnikPool = require('mapnik-pool')(mapnik);
const mapTiles = require('global-mercator');
const gpkgUtil = require('@ngageoint/geopackage');
const untildify = require('untildify');

/**
 * Create a GeoPackage `BoundingBox` object from the given coordinates.
 * @param {number} west
 * @param {number} south
 * @param {number} east
 * @param {number} north
 */
function gpkgBBoxForSWNE(west, south, east, north) {
  return new gpkgUtil.BoundingBox(west, east, south, north);
}

const stylePath = path.resolve(untildify(style));
const styleDir = path.dirname(stylePath);
const gpkgPath = path.resolve(untildify(gpkg)) + (/\.gpkg$/.test(gpkg) ? '' : '.gpkg');
const tableName = table || path.basename(gpkgPath).slice(0, -5);

const matrixSetBounds = gpkgBBoxForSWNE(...mapTiles.tileToBBoxMeters([0, 0, 0]));
const bboxMeters = mapTiles.bboxToMeters(bbox);
const contentsBounds = gpkgBBoxForSWNE(...bboxMeters);
const tileSize = 256 * scale;
const metaTileSize = 8 * tileSize;

mapnik.register_default_fonts();
mapnik.register_default_input_plugins();

const allMetaTiles = function* () {
  let zoom = maxZoom + 1;
  while (zoom-- > minZoom) {
    yield* MetaTile.metaTilesIntersectingBBox(...bbox, zoom);
  }
};

/**
 *
 * @param {MetaTile} metaTile the meta-tile to cut
 * @param {mapnik.Image} metaImage Mapnik `Image` of a meta-tile
 * @param {geopackageApi.GeoPackage} geoPackage the GeoPackage target for the XYZ tiles
 */
const cutXYZTiles = function(metaTile, metaImage, geoPackage) {
  for (let tile of metaTile.xyzTiles()) {
    const [x, y] = tile;
    const px = (x - metaTile.x) * tileSize;
    const py = (y - metaTile.y) * tileSize;
    metaImage.view(px, py, tileSize, tileSize).encode('png', function(err, buffer) {
      if (err) {
        throw err;
      }
      console.log('adding tile ' + [x, y, metaTile.zoom]);
      const tileDao = geoPackage.getTileDao(tableName);
      if (tileDao.queryForTile(x, y, metaTile.zoom)) {
        console.log(tableName + ' already contains tile ' + [x, y, metaTile.zoom]);
      }
      else {
        geoPackage.addTile(buffer, tableName, metaTile.zoom, y, x);
      }
    });
  }
};

// resolve relative resource references in mapnik stylesheet
process.chdir(styleDir);
const mapPool = mapnikPool.fromString(fs.readFileSync(stylePath, 'utf-8'), { size: metaTileSize, bufferSize: 0 });
mapPool.acquireMap = function() {
  return new Promise(function(resolve, reject) {
    mapPool.acquire(function(err, map) {
      if (err) {
        reject(err);
      }
      else {
        resolve(map);
      }
    });
  });
}.bind(mapPool);

gpkgUtil.create(gpkgPath)
.then(gpkg => gpkg, err => {
  console.log('error opening geopackage: ' + err);
  throw err;
})
.then(gpkg => {
  if (gpkg.hasTileTable(tableName)) {
    return gpkg;
  }
  return gpkgUtil.createStandardWebMercatorTileTable(gpkg, tableName, contentsBounds, 3857, matrixSetBounds, 3857, minZoom, maxZoom, tileSize)
  .catch(err => {
    throw err;
  })
  .then(_ => gpkg);
})
.then(gpkg => {
  for (let metaTile of allMetaTiles()) {
    mapPool.acquireMap()
    .then(function(map) {
      map.zoomToBox(metaTile.bboxMeters());
      const im = new mapnik.Image(metaTileSize, metaTileSize);
      return new Promise(function(resolve, reject) {
        map.render(im, {scale: scale, variables: {zoom: metaTile.zoom}}, function(err, im) {
          mapPool.release(map);
          if (err) {
            reject(err);
          }
          else {
            resolve(im);
          }
        });
      })
    })
    .catch(err => {
      throw err;
    })
    .then(mapnikImage => {
      return cutXYZTiles(metaTile, mapnikImage, gpkg);
    });
  }
});
