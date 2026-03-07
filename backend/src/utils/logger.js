const winston = require('winston');
const config = require('../config/config');

const { combine, timestamp, printf, colorize, align, splat } = winston.format;

const logger = winston.createLogger({
  level: config.logLevel || 'info',
  format: combine(
    colorize({ all: true }),
    timestamp({
      format: 'YYYY-MM-DD hh:mm:ss.SSS A',
    }),
    align(),
    splat(),
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [new winston.transports.Console()],
});

// Create a stream object for morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
