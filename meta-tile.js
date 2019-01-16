
const mapTiles = require('global-mercator');


/**
 * A [meta-tile]{@link https://wiki.openstreetmap.org/wiki/Meta_tiles} is a
 * composite of [XYZ]{https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames}
 * map tiles.  Meta-tiles allow more spatial context for a
 * rendering agent, like Mapnik, to properly space map elements such as labels
 * and markers without collisions or too much clutter.  Meta-tile also reduce
 * the number of tiles that are actually stored in a cache.
 *
 * This class assumes a meta-tile contains 8x8 standard, 256-pixel XYZ map
 * tiles.
 */
class MetaTile {

  /**
   * Calculate the upper-left XYZ tile of the 8x8 meta-tile that contains the
   * given XYZ tile.
   *
   * @param {number} x integral XYZ tile x coordinate
   * @param {number} y integral XYZ tile y coordinate
   * @param {number} zoom integral XYZ zoom level
   * @returns {number[]} tile coordinates in an array: [x, y, z]
   */
  static metaOriginXYZForXYZ(x, y, zoom) {
    /*
    This bitwise operation computes the left-most and upper-most 256-pixel, XYZ
    tile of the 8x8 meta-tile.  This works because ANDing the XYZ tile
    coordinate with -8 (32-bit two's complement
    11111111111111111111111111111000) forces the last 3 bits in the tile
    coordinate to 0, which produces the greatest multiple of 8 less than
    the given XYZ coordinate, which would be the left/upper-most XYZ coordinate
    of the 8x8 meta-tile containing the XYZ tile.
    */
    return [x & -8, y & -8, zoom];
  }

  /**
   * Create the {@link MetaTile} object that contains the given XYZ tile.
   *
   * @param {number} x integral XYZ tile x coordinate
   * @param {number} y integral XYZ tile y coordinate
   * @param {number} zoom integral XYZ zoom level
   * @returns {MetaTile}
   */
  static metaTileForXYZ(x, y, zoom) {
    return new MetaTile(...metaOriginXYZForXYZ(zoom, x, y))
  }

  /**
   * Return a Generator that yields {@link MetaTile} instances that intersect
   * the bounding box defined by the given coordinates at the given zoom level.
   *
   * @param {number} west western longitude of the bounding box
   * @param {number} south southern latitude of the bounding box
   * @param {number} east eastern longitude of the bounding box
   * @param {number} north northern latitude of the bounding box
   * @param {number} zoom integral XYZ zoom level
   * @yields {MetaTile}
   */
  static * metaTilesIntersectingBbox(west, south, east, north, zoom) {
    const ulTile = mapTiles.lngLatToGoogle([west, north], zoom);
    const lrTile = mapTiles.lngLatToGoogle([east, south], zoom);
    const ulMetaTile = MetaTile.metaOriginXYZForXYZ(...ulTile);
    const lrMetaTile = MetaTile.metaOriginXYZForXYZ(...lrTile);
    for (let y = ulMetaTile[1]; y <= lrMetaTile[1]; y += 8) {
      for (let x = ulMetaTile[0]; x <= lrMetaTile[0]; x += 8) {
        yield new MetaTile(x, y, zoom);
      }
    }
  }

  /**
   * Create an instance of MetaTile.
   *
   * @param {number} zoom integral XYZ zoom level of the tile
   * @param {number} upperLeftX the X coordinate of the upper left XYZ tile defining the meta-tile
   * @param {number} upperLeftY the Y coordinate of the upper left XYZ tile defining the meta-tile
   */
  constructor(upperLeftX, upperLeftY, zoom) {
    if (upperLeftX < 0 || upperLeftY < 0 ||
      zoom < 0 || !Number.isInteger(zoom) || zoom < 3 ||
      // multiples of 8 have no bits set below the 4th bit (2^8)
      upperLeftX >> 3 << 3 != upperLeftX ||
      upperLeftY >> 3 << 3 != upperLeftY) {
      throw Error('invalid meta-tile origin ' + [upperLeftX, upperLeftY, zoom]);
    }
    this.x = upperLeftX;
    this.y = upperLeftY;
    this.zoom = zoom;
  }

  toString() {
    return 'MetaTile(' + this.x + ', ' + this.y + ', ' + this.zoom + ')';
  }

  /**
   * Return the bounding box in EPSG:3857 coordinates (meters at the equator).
   *
   * @returns {number[]} [west, south, east, north]
   */
  bboxMeters() {
    const ulBbox = mapTiles.googleToBBoxMeters([this.x, this.y, this.zoom]);
    const lrBbox = mapTiles.googleToBBoxMeters([this.x + 7, this.y + 7, this.zoom]);
    return [ulBbox[0], lrBbox[1], lrBbox[2], ulBbox[3]];
  }

  /**
   * Return a Generator that yields the XYZ tiles this meta-tile contains.
   *
   * @yields {number[]} arrays of integral XYZ tiles coordinates: [x, y, z]
   */
  * xyzTiles() {
    for (let y = this.y; y < this.y + 8; y++) {
      for (let x = this.x; x < this.x + 8; x++) {
        yield [x, y, this.zoom];
      }
    }
  }
}

module.exports = MetaTile;