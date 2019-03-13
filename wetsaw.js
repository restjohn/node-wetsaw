
/**
 * @module wetsaw
 */

const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');

const MetaTile = require('./meta-tile');

const mapnik = require('mapnik');
const mapnikPool = require('mapnik-pool')(mapnik);
const mapTiles = require('global-mercator');
const gpkgUtil = require('@ngageoint/geopackage');
const untildify = require('untildify');
const xsltproc = require('xsltproc');

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

 /**
  * @class WetsawTask
  */
class Task {

  /**
   *
   * @param {module:wetsaw~WetsawConfig} config
   */
  constructor(config) {
    this.config = config;
    this.bbox = config.bbox;
    this.zoomMin = config.zoomMin;
    this.zoomMax = config.zoomMax;
    this.stylePath = path.resolve(untildify(config.style));
    const styleName = path.basename(this.stylePath).replace(/\.[^.]+$/, '').replace(/\W/g, '_').replace(/_{2,}/g, '_');
    this.styleDir = path.dirname(this.stylePath);
    this.xsltPath = config.xslt ? path.resolve(untildify(config.xslt)) : null;
    this.xsltParams = config.xsltParam;
    this.gpkgPath = path.resolve(untildify(config.gpkg || styleName + '.gpkg'));
    if (this.gpkgPath.slice(-5) != '.gpkg') {
      this.gpkgPath += '.gpkg';
    }
    this.gpkgDir = path.dirname(this.gpkgPath);
    this.tableName = config.table || styleName;
    this.matrixSetBounds = gpkgBBoxForSWNE(...mapTiles.tileToBBoxMeters([0, 0, 0]));
    const bboxMeters = mapTiles.bboxToMeters(config.bbox);
    this.contentsBounds = gpkgBBoxForSWNE(...bboxMeters);
    this.scale = config.scale || 1.0;
    this.tileSize = 256 * this.scale;
    this.metaTileSize = 8 * this.tileSize;
    this.pool = null;
  }

  applyMapnikStyleTransform() {
    if (!this.xsltPath) {
      return Promise.resolve(fs.readFileSync(this.stylePath, 'utf-8'));
    }
    return new Promise((resolve, reject) => {
      console.log('transforming mapnik style with stylesheet ' + this.xsltPath + '...');
      const transform = xsltproc.transform(this.xsltPath, this.stylePath, { stringparam: this.xsltParams });
      let result = Buffer.alloc(0);
      transform.stdout.on('data', function(data) {
        result = Buffer.concat([result, data]);
      });
      transform.stderr.on('data', function(data) {
        result = Buffer.concat([result, data]);
      });
      transform.on('exit', (code, signal) => {
        if (code === 0) {
          resolve(result.toString('utf-8'));
        }
        else {
          reject(result.toString('utf-8'));
        }
      });
    });
  }

  buildMapnikPool() {
    return this.applyMapnikStyleTransform().then(
      xformResult => {
        this.pool = mapnikPool.fromString(xformResult, { size: this.metaTileSize, bufferSize: 0 }, { base: this.styleDir });
        this.pool.acquireMap = function() {
          return new Promise((resolve, reject) => {
            this.acquire((err, map) => {
              if (err) {
                reject(err);
              }
              else {
                resolve(map);
              }
            });
          });
        }.bind(this.pool);
        return this.pool;
      },
      err => { throw err; });
  }

  addTileMatrixSetInGeoPackage() {
    if (this.gpkg.hasTileTable(this.tableName)) {
      const missingZoomLevels = {};
      for (let zoom = this.zoomMin; zoom <= this.zoomMax; zoom++) {
        missingZoomLevels[zoom] = null;
      }
      const tileDao = this.gpkg.getTileDao(this.tableName);
      tileDao.tileMatrices.forEach(matrix => {
        if (matrix.zoom_level in missingZoomLevels) {
          delete missingZoomLevels[matrix.zoom_level];
        }
      });
      for (let zoom in missingZoomLevels) {
        this.gpkg.createStandardWebMercatorTileMatrix(matrixSetBounds, tileDao.tileMatrixSet, zoom, zoom, this.tileSize);
      }
      return Promise.resolve(this.gpkg);
    }
    return gpkgUtil.createStandardWebMercatorTileTable(
      this.gpkg, this.tableName, this.contentsBounds, 3857,
      this.matrixSetBounds, 3857, this.zoomMin, this.zoomMax, this.tileSize)
      .then(_ => this.gpkg, err => { throw err });
  }

  setContentsAttrs() {
    if (!this.tableLabel && !this.tableDesc) {
      return this.gpkg;
    }
    const contentsDao = this.gpkg.getContentsDao();
    const contents = contentsDao.queryForId(this.tableName);
    if (this.tableLabel) {
      contents.identifier = this.tableLabel;
    }
    if (this.tableDesc) {
      contents.description = this.tableDesc;
    }
    const result = contentsDao.update(contents);
    if (result.changes != 1) {
      console.log('warning: failed to set contents label/description; ' + result.changes + ' contents rows affected');
    }
    return this.gpkg;
  }

  prepareGeoPackage() {
    return gpkgUtil.create(this.gpkgPath)
      .then(gpkg => this.gpkg = gpkg, err => {
        console.log('error opening geopackage: ' + err);
        throw err;
      })
      .then(_ => this.addTileMatrixSetInGeoPackage())
      .then(_ => this.setContentsAttrs());
  }

  cutXYZTiles(metaTile, metaImage) {
    const tileDao = this.gpkg.getTileDao(this.tableName);
    const tilesRemaining = Array.from(metaTile.xyzTiles()).map(tile => new Promise((resolve, reject) => {
      const [x, y] = tile;
      const px = (x - metaTile.x) * this.tileSize;
      const py = (y - metaTile.y) * this.tileSize;
      metaImage.view(px, py, this.tileSize, this.tileSize).encode('png', (err, buffer) => {
        if (err) {
          return reject(err);
        }
        console.log('adding tile ' + [x, y, metaTile.zoom]);
        if (tileDao.queryForTile(x, y, metaTile.zoom)) {
          console.log('table ' + this.tableName + ' already contains tile ' + [x, y, metaTile.zoom]);
        }
        else {
          this.gpkg.addTile(buffer, this.tableName, metaTile.zoom, y, x);
        }
        resolve();
      });
    }));
    return Promise.all(tilesRemaining);
  }

  processMetaTile(metaTile) {
    return this.pool.acquireMap()
      .then(map => {
        map.zoomToBox(metaTile.bboxMeters());
        const im = new mapnik.Image(this.metaTileSize, this.metaTileSize);
        return new Promise((resolve, reject) => {
          map.render(im, {scale: this.scale, variables: {zoom: metaTile.zoom}}, (err, im) => {
            this.pool.release(map);
            if (err) {
              reject(err);
            }
            else {
              resolve(im);
            }
          });
        })
      })
      .then(mapnikImage => this.cutXYZTiles(metaTile, mapnikImage))
  }

  *allMetaTiles() {
    let zoom = this.zoomMax + 1;
    while (zoom-- > this.zoomMin) {
      yield* MetaTile.metaTilesIntersectingBBox(...this.bbox, zoom);
    }
  }

  generateTiles() {
    const metaTilePromises = function * () {
      const metaTiles = this.allMetaTiles();
      for (let metaTile of metaTiles) {
        yield this.processMetaTile(metaTile);
      }
    }.bind(this);
    return Promise.all(metaTilePromises()).then(
      _ => {
        return this;
      },
      err => {
        throw err;
      })
      .finally(() => {
        this.pool.destroy()
      });
  }
}

/**
 * Generate the tiles and GeoPackage for the given configuration.
 *
 * @param {module:wetsaw~WetsawConfig}
 */
module.exports = function(config) {
  mapnik.register_default_fonts();
  mapnik.register_default_input_plugins();
  const task = new Task(config);
  mkdirp.sync(task.gpkgDir);
  return task
    .buildMapnikPool()
    .then(_ => task.prepareGeoPackage())
    .then(_ => task.generateTiles());
};

/**
 * @typedef {object} WetsawConfig
 * @property {number[]} bbox `[west, south, east, north]`
 * @property {number} zoomMin minimum zoom level
 * @property {number} zoomMax maximum zoom level
 * @property {string} style path to the Mapnik XML style
 * @property {?string} gpkg path to the output GeoPackage
 * @property {?string} table name of the tile table to populate in the GeoPackage
 * @property {?string} tableLabel human-readable label for the tile table
 * @property {?string} tableDesc human-readable description of the tile table
 * @property {?number} scale tile image scale
 * @property {string} xslt path to an XSLT stylesheet to transform the Mapnik style
 * @property {string[]} xsltParam parameters to the XSLT stylesheet in the format <name>:<value>
 */
