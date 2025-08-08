const winston = require('winston');
const config = require('../config');

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'envfly-backend' },
  transports: [
    new winston.transports.File({ 
      filename: config.logging.file.error, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: config.logging.file.combined 
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger; 