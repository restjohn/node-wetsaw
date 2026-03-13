const { createLogger, format, transports } = require('winston');

const wetsawFormat = format.printf(({ level, message, label, timestamp, stack }) => {
  return `${timestamp} [${label}] ${level.toUpperCase()} - ${message}` + (stack ? '\n' + stack : '');
});

const log = createLogger({
  level: (process.env['WETSAW_LOG_LEVEL'] || 'info').toLowerCase(),
  format: format.combine(
    format.label({ label: 'WETSAW' }),
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    wetsawFormat
  ),
  defaultMeta: { service: 'wetsaw' },
  transports: [
    new transports.Console()
  ]});

module.exports = log;