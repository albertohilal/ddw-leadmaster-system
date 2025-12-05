/**
 * Middleware de manejo de errores
 */

const logger = require('../core/logger');

/**
 * Error Handler Global
 */
function errorHandler(err, req, res, next) {
  // Log del error
  logger.error(`Error en ${req.method} ${req.path}:`, err);

  // Status code
  const statusCode = err.statusCode || err.status || 500;

  // Respuesta
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: statusCode,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err.details
      })
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
