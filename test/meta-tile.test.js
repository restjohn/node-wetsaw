
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
});