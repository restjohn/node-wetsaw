
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

  it('yields the correct meta-tiles for a normal bounding box', function() {

    // (208, 384)
    const expected = {
      '10': [new MetaTile(208, 384, 10)],
      '11': [new MetaTile(424, 768, 11), new MetaTile(424, 776, 11)],
      '12': [new MetaTile(848, 1544, 12), new MetaTile(856, 1544, 12), new MetaTile(848, 1552, 12), new MetaTile(856, 1552, 12)]
    };

    const zoom10Tiles = Array.from(MetaTile.metaTilesIntersectingBBox(-105.3101, 39.5263, -104.6399, 40.0225, 10));
    const zoom11Tiles = Array.from(MetaTile.metaTilesIntersectingBBox(-105.3101, 39.5263, -104.6399, 40.0225, 11));
    const zoom12Tiles = Array.from(MetaTile.metaTilesIntersectingBBox(-105.3101, 39.5263, -104.6399, 40.0225, 12));

    expect(zoom10Tiles).to.deep.equal(expected['10']);
    expect(zoom11Tiles).to.deep.equal(expected['11']);
    expect(zoom12Tiles).to.deep.equal(expected['12']);
  });

  it('yields the correct meta-tiles for a bounding box crossing 180 or -180 longitude', function() {

    // same bounding box expressed using coordinates relative to 180 and -180
    const eastOverflow = Array.from(MetaTile.metaTilesIntersectingBBox(160.6275, 65.083, 199.3217, 74.8175, 8));
    const westUnderflow = Array.from(MetaTile.metaTilesIntersectingBBox(-199.3725, 65.083, -160.6783, 74.8175, 8));
    const expected = [
      new MetaTile(240, 40, 8), new MetaTile(248, 40, 8), new MetaTile(0, 40, 8), new MetaTile(8, 40, 8),
      new MetaTile(240, 48, 8), new MetaTile(248, 48, 8), new MetaTile(0, 48, 8), new MetaTile(8, 48, 8),
      new MetaTile(240, 56, 8), new MetaTile(248, 56, 8), new MetaTile(0, 56, 8), new MetaTile(8, 56, 8),
      new MetaTile(240, 64, 8), new MetaTile(248, 64, 8), new MetaTile(0, 64, 8), new MetaTile(8, 64, 8)
    ];

    expect(eastOverflow).to.have.deep.ordered.members(expected);
    expect(westUnderflow).to.have.deep.ordered.members(expected);
  });

  describe('bounding box validation', function() {

    it('throws an error if min x is greater than or equal to max x', function() {

      expect(function() {
        MetaTile.metaTilesIntersectingBBox(179, 0, -179, 1, 1);
      }).to.throw();

      expect(function() {
        MetaTile.metaTilesIntersectingBBox(170, 0, 170, 1, 1);
      }).to.throw();
    });

    it('throws an error if min y is greater than or equal to max y', function() {

      expect(function() {
        MetaTile.metaTilesIntersectingBBox(0, -38, 1, -39, 1);
      }).to.throw();

      expect(function() {
        MetaTile.metaTilesIntersectingBBox(0, 0, 1, 0, 1);
      }).to.throw();
    });

    it('throws an error if the zoom level is less than 3', function() {

      expect(function() {
        MetaTile.metaTilesIntersectingBBox(1, 1, 2, 2, 2);
      }).to.throw();
    });

    it('throws an error if the zoom level is not an integer', function() {

      expect(function() {
        MetaTile.metaTilesIntersectingBBox(1, 1, 2, 2, 3.1);
      }).to.throw();
    });

    it('accepts a bounding box crossing 180 longitude without error', function() {

      MetaTile.metaTilesIntersectingBBox(-181, 1, -179, 2, 4);
      MetaTile.metaTilesIntersectingBBox(179, 1, 181, 2, 4);
    });


  });
});