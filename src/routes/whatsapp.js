/**
 * Rutas REST API para el sistema WhatsApp
 * Endpoints completos para gestión multicliente de sesiones y mensajería
 */

const express = require('express');

const logger = require('../core/logger');
const { validateSessionId, validatePhoneNumber, validateMessage } = require('../middleware/validation');
const { rateLimitBySession } = require('../middleware/rateLimiter');

/**
 * Inicializar rutas WhatsApp con el servicio
 * @param {WhatsAppService} whatsAppService - Instancia del servicio principal
 * @returns {Router} Router configurado
 */
function initializeWhatsAppRoutes(whatsAppService) {
  
  // Crear un nuevo router para cada inicialización
  const router = express.Router();
  
  // Middleware para verificar que el servicio esté disponible
  router.use((req, res, next) => {
    if (!whatsAppService || !whatsAppService.isInitialized) {
      return res.status(503).json({
        error: 'WhatsApp service not available',
        message: 'El servicio WhatsApp no está inicializado',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!whatsAppService.isRunning) {
      return res.status(503).json({
        error: 'WhatsApp service not running',
        message: 'El servicio WhatsApp está detenido',
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  });

  // ==========================================
  // RUTAS DE ESTADO Y SALUD
  // ==========================================

  /**
   * GET /whatsapp/health
   * Verificar estado de salud del servicio
   */
  router.get('/health', async (req, res) => {
    try {
      const healthCheck = whatsAppService.getHealthCheck();
      
      const statusCode = healthCheck.status === 'running' ? 200 : 503;
      
      res.status(statusCode).json({
        success: healthCheck.status === 'running',
        data: healthCheck
      });
      
    } catch (error) {
      logger.error('❌ Error en health check:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  });

  /**
   * GET /whatsapp/stats
   * Obtener estadísticas completas del sistema
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = whatsAppService.getStats();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: error.message
      });
    }
  });

  // ==========================================
  // RUTAS DE GESTIÓN DE SESIONES
  // ==========================================

  /**
   * GET /whatsapp/sessions
   * Listar todas las sesiones activas
   */
  router.get('/sessions', async (req, res) => {
    try {
      const sessions = whatsAppService.listSessions();
      
      res.json({
        success: true,
        data: {
          sessions,
          count: sessions.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error listando sesiones:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list sessions',
        message: error.message
      });
    }
  });

  /**
   * POST /whatsapp/sessions
   * Crear nueva sesión WhatsApp
   */
  router.post('/sessions', validateSessionId, async (req, res) => {
    try {
      const { sessionId, options = {} } = req.body;
      
      // Verificar si la sesión ya existe
      const existingSession = whatsAppService.getSession(sessionId);
      if (existingSession) {
        return res.status(409).json({
          success: false,
          error: 'Session already exists',
          message: `La sesión ${sessionId} ya existe`,
          data: {
            sessionId,
            status: existingSession.connection.status
          }
        });
      }

      const session = await whatsAppService.createSession(sessionId, options);
      
      logger.info(`✅ Sesión ${sessionId} creada vía API`);
      
      res.status(201).json({
        success: true,
        message: 'Sesión creada exitosamente',
        data: session,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error creando sesión:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create session',
        message: error.message
      });
    }
  });

  /**
   * GET /whatsapp/sessions/:sessionId
   * Obtener información detallada de una sesión
   */
  router.get('/sessions/:sessionId', validateSessionId, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = whatsAppService.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `La sesión ${sessionId} no existe`
        });
      }
      
      res.json({
        success: true,
        data: session,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error(`❌ Error obteniendo sesión ${req.params.sessionId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session',
        message: error.message
      });
    }
  });

  /**
   * DELETE /whatsapp/sessions/:sessionId
   * Cerrar y eliminar una sesión
   */
  router.delete('/sessions/:sessionId', validateSessionId, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = whatsAppService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `La sesión ${sessionId} no existe`
        });
      }

      await whatsAppService.closeSession(sessionId);
      
      logger.info(`✅ Sesión ${sessionId} cerrada vía API`);
      
      res.json({
        success: true,
        message: 'Sesión cerrada exitosamente',
        data: { sessionId },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error(`❌ Error cerrando sesión ${req.params.sessionId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to close session',
        message: error.message
      });
    }
  });

  // ==========================================
  // RUTAS DE CÓDIGOS QR
  // ==========================================

  /**
   * GET /whatsapp/sessions/:sessionId/qr
   * Obtener código QR de una sesión
   */
  router.get('/sessions/:sessionId/qr', validateSessionId, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { format = 'dataURL' } = req.query;
      
      // Verificar que la sesión existe
      const session = whatsAppService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `La sesión ${sessionId} no existe`
        });
      }

      const qrCode = whatsAppService.getQRCode(sessionId, format);
      
      if (!qrCode || !qrCode.code) {
        return res.status(404).json({
          success: false,
          error: 'QR code not available',
          message: 'No hay código QR disponible para esta sesión',
          data: {
            sessionId,
            status: session.connection.status,
            needsAuth: session.connection.status === 'disconnected'
          }
        });
      }
      
      // Para formatos de imagen, enviar como respuesta directa
      if (format === 'png' || format === 'buffer') {
        res.setHeader('Content-Type', 'image/png');
        res.send(qrCode.code);
        return;
      }
      
      res.json({
        success: true,
        data: {
          sessionId,
          qrCode: qrCode.code,
          format,
          timestamp: qrCode.timestamp,
          expiresAt: qrCode.expiresAt,
          attempts: qrCode.attempts
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error(`❌ Error obteniendo QR para ${req.params.sessionId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get QR code',
        message: error.message
      });
    }
  });

  // ==========================================
  // RUTAS DE MENSAJERÍA
  // ==========================================

  /**
   * POST /whatsapp/sessions/:sessionId/messages
   * Enviar mensaje (con cola)
   */
  router.post('/sessions/:sessionId/messages', 
    validateSessionId,
    validatePhoneNumber,
    validateMessage,
    rateLimitBySession,
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { to, message, options = {} } = req.body;
        
        // Verificar que la sesión existe y está conectada
        const session = whatsAppService.getSession(sessionId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session not found',
            message: `La sesión ${sessionId} no existe`
          });
        }

        if (session.connection.status !== 'connected') {
          return res.status(400).json({
            success: false,
            error: 'Session not connected',
            message: `La sesión ${sessionId} no está conectada`,
            data: {
              sessionId,
              status: session.connection.status,
              hasQR: session.qrCode.available
            }
          });
        }

        const result = await whatsAppService.sendMessage(sessionId, to, message, options);
        
        logger.info(`📤 Mensaje enviado vía API: ${sessionId} -> ${to}`);
        
        res.status(201).json({
          success: true,
          message: 'Mensaje agregado a la cola exitosamente',
          data: {
            messageId: result.messageId,
            sessionId,
            to,
            queuePosition: result.queuePosition,
            estimatedSendTime: result.estimatedSendTime
          },
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error(`❌ Error enviando mensaje desde ${req.params.sessionId}:`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to send message',
          message: error.message
        });
      }
    }
  );

  /**
   * POST /whatsapp/sessions/:sessionId/messages/immediate
   * Enviar mensaje inmediato (sin cola)
   */
  router.post('/sessions/:sessionId/messages/immediate',
    validateSessionId,
    validatePhoneNumber,
    validateMessage,
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { to, message, options = {} } = req.body;
        
        // Verificar que la sesión existe y está conectada
        const session = whatsAppService.getSession(sessionId);
        if (!session) {
          return res.status(404).json({
            success: false,
            error: 'Session not found',
            message: `La sesión ${sessionId} no existe`
          });
        }

        if (session.connection.status !== 'connected') {
          return res.status(400).json({
            success: false,
            error: 'Session not connected',
            message: `La sesión ${sessionId} no está conectada`,
            data: {
              sessionId,
              status: session.connection.status
            }
          });
        }

        const result = await whatsAppService.sendImmediateMessage(sessionId, to, message, options);
        
        logger.info(`⚡ Mensaje inmediato enviado vía API: ${sessionId} -> ${to}`);
        
        res.status(201).json({
          success: true,
          message: 'Mensaje enviado inmediatamente',
          data: {
            sessionId,
            to,
            messageId: result.messageId,
            sentAt: result.sentAt,
            immediate: true
          },
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error(`❌ Error enviando mensaje inmediato desde ${req.params.sessionId}:`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to send immediate message',
          message: error.message
        });
      }
    }
  );

  /**
   * GET /whatsapp/sessions/:sessionId/queue
   * Obtener estado de la cola de mensajes
   */
  router.get('/sessions/:sessionId/queue', validateSessionId, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = whatsAppService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          message: `La sesión ${sessionId} no existe`
        });
      }

      res.json({
        success: true,
        data: {
          sessionId,
          queue: session.messageQueue
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error(`❌ Error obteniendo cola de ${req.params.sessionId}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get queue status',
        message: error.message
      });
    }
  });

  // ==========================================
  // RUTAS DE ADMINISTRACIÓN
  // ==========================================

  /**
   * POST /whatsapp/start
   * Iniciar el servicio WhatsApp
   */
  router.post('/start', async (req, res) => {
    try {
      if (whatsAppService.isRunning) {
        return res.status(400).json({
          success: false,
          error: 'Service already running',
          message: 'El servicio WhatsApp ya está ejecutándose'
        });
      }

      await whatsAppService.start();
      
      res.json({
        success: true,
        message: 'Servicio WhatsApp iniciado exitosamente',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error iniciando servicio WhatsApp:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start service',
        message: error.message
      });
    }
  });

  /**
   * POST /whatsapp/stop
   * Detener el servicio WhatsApp
   */
  router.post('/stop', async (req, res) => {
    try {
      if (!whatsAppService.isRunning) {
        return res.status(400).json({
          success: false,
          error: 'Service not running',
          message: 'El servicio WhatsApp no está ejecutándose'
        });
      }

      await whatsAppService.stop();
      
      res.json({
        success: true,
        message: 'Servicio WhatsApp detenido exitosamente',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Error deteniendo servicio WhatsApp:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop service',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = initializeWhatsAppRoutes;