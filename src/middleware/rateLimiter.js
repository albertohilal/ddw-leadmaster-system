/**
 * Rate Limiter Middleware
 */

const rateLimit = require('express-rate-limit');
const config = require('../core/config');

// Rate limiter general para API
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: config.rateLimit.windowMs / 1000
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: 900
  }
});

// Rate limiter para WhatsApp
const whatsappLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: config.whatsapp.maxMessagesPerMinute,
  message: {
    error: 'Too many messages sent, please slow down.',
    retryAfter: 60
  }
});

// Rate limiter por sesión para WhatsApp
const rateLimitBySession = (req, res, next) => {
  const sessionId = req.params.sessionId;
  
  if (!sessionId) {
    return next();
  }
  
  // Crear un rate limiter específico para esta sesión
  const sessionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: config.whatsapp.maxMessagesPerMinute,
    keyGenerator: (req) => {
      return `whatsapp:${req.params.sessionId}:${req.ip}`;
    },
    message: {
      success: false,
      error: 'Rate limit exceeded for session',
      message: `Demasiados mensajes para la sesión ${sessionId}. Límite: ${config.whatsapp.maxMessagesPerMinute} por minuto.`,
      retryAfter: 60,
      sessionId
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  return sessionLimiter(req, res, next);
};

module.exports = {
  apiLimiter,
  authLimiter,
  whatsappLimiter,
  rateLimitBySession
};
