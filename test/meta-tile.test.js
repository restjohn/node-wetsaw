
const expect = require('chai').expect;
const MetaTile = require('../meta-tile');

describe('MetaTile', function() {

  describe("origin tile validation", function() {

    const invalidTiles = [
      [1, 0, 3],
      [0, 1, 3],
      [1, 1, 3],
      [9, 0, 3],
      [0, 9, 3],
      [9, 9, 3],
      [-8, -8, 3],
      [0, 0, -3],
      [0, 0, 1.1],
      [0.5, 0, 3],
      [8, 8, 2]
    ];

    invalidTiles.forEach(function(tile) {
      it('throws an error for invalid origin tile ' + tile, function() {
        expect(function() { new MetaTile(...tile) }).to.throw(null, null, tile.toString());
      });
    });

    it('does not throw an error for valid origin tile coordinates', function() {

      for (let zoom = 3; zoom < 10; zoom++) {
        for (let x = 0; x < 1 << zoom; x += 8) {
          for (let y = 0; y < 1 << zoom; y += 8) {
            new MetaTile(x, y, zoom);
          }
        }
      }
    });
  });

  it('provides useful toString()', function() {

    let meta = new MetaTile(8, 24, 9);

    expect(meta.toString()).to.eq('MetaTile(8, 24, 9)');
  });

  it('yields 64 xyz tiles', function() {

    for (let zoom = 3; zoom < 10; zoom++) {
      for (let x = 0; x < 1 << zoom; x += 8) {
        for (let y = 0; y < 1 << zoom; y += 8) {
          let meta = new MetaTile(x, y, zoom);
          let count = 0;
          for (let tile of meta.xyzTiles()) {
            count++;
          }
          expect(count, meta.toString()).to.eq(64);
        }
      }
    }
  });

  it('provides the correct bounding box for the meta-tile', function() {

    const meta = new MetaTile(256, 192, 9);
    const [xMin, yMin, xMax, yMax] = meta.bboxMeters();

    /*
    these expected coordinates come from manually drawing a bounding box
    using the GEOFABRIK tool around the appropriate tiles:
    http://tools.geofabrik.de/calc/#type=geofabrik_standard&bbox=0.000002,36.59789,5.625002,40.979899&tab=1&grid=1&proj=EPSG:3857
    it seems wrong to test by using the same method and library as MetaTile
    (i.e., global-mercator) to generate the expected values.
    */
    expect(xMin).to.be.closeTo(0, 0);
    expect(yMin).to.be.closeTo(4383205, 1);
    expect(xMax).to.be.closeTo(626173, 1);
    expect(yMax).to.be.closeTo(5009378, 1);
  });
});