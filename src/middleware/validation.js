/**
 * Middleware de validación para las rutas WhatsApp
 */

const logger = require('../core/logger');

/**
 * Validar sessionId en parámetros o body
 */
const validateSessionId = (req, res, next) => {
  const sessionId = req.params.sessionId || req.body.sessionId;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing sessionId',
      message: 'El sessionId es requerido'
    });
  }
  
  // Validar formato del sessionId
  if (typeof sessionId !== 'string' || sessionId.length < 3 || sessionId.length > 50) {
    return res.status(400).json({
      success: false,
      error: 'Invalid sessionId format',
      message: 'El sessionId debe ser una cadena de 3-50 caracteres'
    });
  }
  
  // Validar caracteres permitidos (alfanuméricos, guiones, guiones bajos)
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid sessionId characters',
      message: 'El sessionId solo puede contener letras, números, guiones y guiones bajos'
    });
  }
  
  next();
};

/**
 * Validar número de teléfono
 */
const validatePhoneNumber = (req, res, next) => {
  const { to } = req.body;
  
  if (!to) {
    return res.status(400).json({
      success: false,
      error: 'Missing phone number',
      message: 'El número de teléfono (to) es requerido'
    });
  }
  
  if (typeof to !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number type',
      message: 'El número de teléfono debe ser una cadena'
    });
  }
  
  // Limpiar y validar formato del número
  const cleanNumber = to.replace(/[^\d]/g, '');
  
  if (cleanNumber.length < 8 || cleanNumber.length > 15) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number length',
      message: 'El número de teléfono debe tener entre 8 y 15 dígitos'
    });
  }
  
  // Normalizar el número para procesamiento interno
  req.body.to = cleanNumber + '@c.us';
  
  next();
};

/**
 * Validar mensaje
 */
const validateMessage = (req, res, next) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Missing message',
      message: 'El mensaje es requerido'
    });
  }
  
  if (typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid message type',
      message: 'El mensaje debe ser una cadena de texto'
    });
  }
  
  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Empty message',
      message: 'El mensaje no puede estar vacío'
    });
  }
  
  if (message.length > 4096) {
    return res.status(400).json({
      success: false,
      error: 'Message too long',
      message: 'El mensaje no puede exceder 4096 caracteres'
    });
  }
  
  next();
};

/**
 * Validar parámetros de sesión opcionales
 */
const validateSessionOptions = (req, res, next) => {
  const { options } = req.body;
  
  if (options && typeof options !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid options type',
      message: 'Las opciones deben ser un objeto'
    });
  }
  
  if (options) {
    // Validar opciones específicas si están presentes
    const allowedOptions = [
      'autoStartListening',
      'aiEnabled',
      'saveMessages',
      'saveConversations',
      'autoResponse',
      'metadata',
      'listenerOptions'
    ];
    
    const invalidOptions = Object.keys(options).filter(key => !allowedOptions.includes(key));
    
    if (invalidOptions.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid options',
        message: `Opciones no válidas: ${invalidOptions.join(', ')}`,
        allowedOptions
      });
    }
    
    // Validar tipos de opciones booleanas
    const booleanOptions = ['autoStartListening', 'aiEnabled', 'saveMessages', 'saveConversations', 'autoResponse'];
    for (const opt of booleanOptions) {
      if (options[opt] !== undefined && typeof options[opt] !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Invalid option type',
          message: `La opción ${opt} debe ser booleana (true/false)`
        });
      }
    }
  }
  
  next();
};

/**
 * Validar formato de QR code
 */
const validateQRFormat = (req, res, next) => {
  const { format } = req.query;
  
  if (format) {
    const allowedFormats = ['dataURL', 'buffer', 'base64', 'ascii', 'png'];
    
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid QR format',
        message: `Formato no válido. Formatos permitidos: ${allowedFormats.join(', ')}`
      });
    }
  }
  
  next();
};

module.exports = {
  validateSessionId,
  validatePhoneNumber,
  validateMessage,
  validateSessionOptions,
  validateQRFormat
};