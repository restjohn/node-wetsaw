const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const Confabulous = require('confabulous');
const wetsaw = require('./wetsaw');

const parseXsltParam = function(pair) {
  if (!pair) {
    throw 'invalid xslt-param';
  }
  const sep = pair.indexOf(':');
  if (sep < 0) {
    throw 'invalid xslt-param: ' + pair;
  }
  const name = pair.substring(0, sep);
  let value = pair.substring(sep + 1);
  if (value.startsWith('env.')) {
    value = process.env[value.substring(4)];
  }
  return { key: name, val: value };
};

const parseBBox = function(arg) {
  argParts = arg.split(/\s/);
  if (argParts.length != 4) {
    throw 'invalid --bbox: ' + arg + '; expected 4 numeric values';
  }
  return argParts.map(parseFloat);
};

const commandLineOptions = [
  { name: 'help', type: Boolean, description: 'display this help message' },
  { name: 'bbox', type: parseBBox, typeLabel: '"<string>"', description: 'bounding box quoted string of space-separated numeric values; "<west> <south> <east> <north>"' },
  { name: 'zoom-min', type: parseInt, description: 'XYZ tile map minimum zoom level', typeLabel: '<int>' },
  { name: 'zoom-max', type: parseInt, description: 'XYZ tile map maximum zoom level', typeLabel: '<int>' },
  { name: 'style', description: 'path to the Mapnik XML style document' },
  { name: 'xslt', description: 'path to an XML Stylesheet Language Transform (XSLT) document to transform the Mapnik XML style document' },
  { name: 'xslt-param', type: parseXsltParam, typeLabel: '"<name>:<value>"', description: 'parameter for style-xslt with name and value separated by a colon (no whitespace); use environment variables by prefixing the parameter value with "env."', multiple: true },
  { name: 'gpkg', description: 'path to the GeoPackage file to create or update; defaults to the basename of the Mapnik style file' },
  { name: 'table', description: 'name of the tile table to create in the GeoPackage; defaults to the basename of the GeoPackage file without the .gpkg extension' },
  { name: 'table-label', description: 'human-readable short name of the tile table; the contents table \'identifier\' column' },
  { name: 'table-desc', description: 'human-readable description of the tile table; the contents table \'description\' column' },
  { name: 'scale', type: parseFloat, typeLabel: '<float>', description: 'scale to apply to the tile images; the output tile size will be the scale * 256', defaultValue: 1.0 }
];

const argsLoader = function(postProcessors) {
  const emitter = new (require('events').EventEmitter)();
  return function(confabulous, cb) {
    setImmediate(function() {
      const args = commandLineArgs(commandLineOptions, { camelCase: true });
      const async = require('async');
      async.seq.apply(async, postProcessors)(args, cb);
    });
    return emitter;
  };
};

const validateConfig = function(config) {
  const errors = [];
  if (!config.bbox) {
    errors.push('missing bbox');
  }
  if (!config.zoomMin) {
    errors.push('missing min zoom');
  }
  if (!config.zoomMax) {
    errors.push('missing max zoom');
  }
  return errors;
};

new Confabulous()
  .add(config => Confabulous.loaders.env([
    Confabulous.processors.envToCamelCaseProp({ prefix: 'WETSAW_', filter: /^WETSAW_/ }),
    function(config, callback) {
      if (config.bbox) {
        config.bbox = parseBBox(config.bbox);
      }
      if (config.zoomMin) {
        config.zoomMin = parseInt(config.zoomMin);
      }
      if (config.zoomMax) {
        config.zoomMax = parseInt(config.zoomMax);
      }
      if (config.scale) {
        config.scale = parseFloat(config.scale);
      }
      if (config.xsltParam) {
        if (config.xsltParam.startsWith('[')) {
          config.xsltParam = JSON.parse(config.xsltParam).map(parseXsltParam);
        }
        else {
          config.xsltParam = [parseXsltParam(config.xsltParam)];
        }
      }
      callback(null, config);
    }
  ]))
  .add(config => argsLoader())
  .end((err, config) => {
    if (err) {
      throw err;
    }
    const paramsUsage = { header: 'Parameters:', optionList: commandLineOptions };
    const validationErrors = validateConfig(config);

    if (config.help) {
      console.log(commandLineUsage([paramsUsage]));
      process.exit(0);
    }
    if (validationErrors.length > 0) {
      console.log(commandLineUsage([
        {
          header: 'Invalid parameters:',
          content: validationErrors.join("\n")
        },
        paramsUsage
      ]));
      process.exit(1);
    }
    wetsaw(config).then(
      task => console.log('wetsaw complete: ' + task.gpkgPath),
      err => { throw err; });
  });

