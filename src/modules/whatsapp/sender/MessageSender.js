/**
 * Envío de Mensajes WhatsApp
 * Sistema de envío con cola, rate limiting, retry logic y soporte multicliente
 */

const EventEmitter = require('events');
const logger = require('../../../core/logger');
const config = require('../../../core/config');

class MessageSender extends EventEmitter {
  constructor(connectionManager) {
    super();
    
    this.connectionManager = connectionManager;
    
    // Cola de mensajes por sesión: sessionId -> Queue
    this.messageQueues = new Map();
    
    // Rate limiting por sesión: sessionId -> RateLimiter
    this.rateLimiters = new Map();
    
    // Estado de procesamiento por sesión
    this.processingStatus = new Map();
    
    // Configuración
    this.config = {
      // Rate limiting
      maxMessagesPerMinute: config.whatsapp.maxMessagesPerMinute || 20,
      messageDelay: config.whatsapp.messageDelay || 3000,
      burstLimit: parseInt(process.env.WHATSAPP_BURST_LIMIT) || 5,
      
      // Retry logic
      maxRetries: parseInt(process.env.MESSAGE_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.MESSAGE_RETRY_DELAY) || 5000,
      retryMultiplier: parseFloat(process.env.MESSAGE_RETRY_MULTIPLIER) || 1.5,
      
      // Cola
      maxQueueSize: parseInt(process.env.MESSAGE_QUEUE_SIZE) || 1000,
      batchSize: parseInt(process.env.MESSAGE_BATCH_SIZE) || 10,
      
      // Timeouts
      sendTimeout: parseInt(process.env.MESSAGE_SEND_TIMEOUT) || 30000,
      queueTimeout: parseInt(process.env.MESSAGE_QUEUE_TIMEOUT) || 3600000 // 1 hora
    };

    this.isInitialized = false;
    this._setupProcessingTimers();
  }

  /**
   * Inicializar el sender
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('⚠️ MessageSender ya está inicializado');
      return;
    }

    try {
      logger.info('🚀 MessageSender: Inicializando sistema de envío...');
      
      this.isInitialized = true;
      
      logger.info('✅ MessageSender: Sistema inicializado');
      
      this.emit('initialized');
      
    } catch (error) {
      logger.error('❌ MessageSender: Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Enviar mensaje (añadir a cola)
   * @param {string} sessionId - ID de la sesión
   * @param {string} to - Número destinatario
   * @param {string} message - Mensaje a enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} ID del mensaje en cola
   */
  async sendMessage(sessionId, to, message, options = {}) {
    try {
      this._ensureInitialized();
      this._validateInputs(sessionId, to, message);

      // Generar ID único para el mensaje
      const messageId = this._generateMessageId();
      
      // Formatear número
      const formattedTo = this._formatPhoneNumber(to);

      // Crear objeto de mensaje
      const messageObj = {
        id: messageId,
        sessionId,
        to: formattedTo,
        originalTo: to,
        message,
        type: options.type || 'text',
        priority: options.priority || 'normal',
        metadata: options.metadata || {},
        
        // Control de envío
        attempts: 0,
        maxRetries: options.maxRetries || this.config.maxRetries,
        status: 'queued',
        
        // Timestamps
        queuedAt: new Date(),
        scheduledFor: options.scheduledFor ? new Date(options.scheduledFor) : null,
        expiresAt: new Date(Date.now() + this.config.queueTimeout),
        
        // Configuración específica
        config: {
          delay: options.delay || this.config.messageDelay,
          timeout: options.timeout || this.config.sendTimeout,
          skipRateLimit: options.skipRateLimit || false
        }
      };

      // Validar sesión existe
      if (!this.connectionManager.getSession(sessionId)) {
        throw new Error(`Sesión ${sessionId} no encontrada`);
      }

      // Obtener o crear cola para la sesión
      const queue = this._getOrCreateQueue(sessionId);
      
      // Validar límite de cola
      if (queue.length >= this.config.maxQueueSize) {
        throw new Error(`Cola de mensajes llena para sesión ${sessionId} (${this.config.maxQueueSize} max)`);
      }

      // Añadir mensaje a la cola según prioridad
      if (messageObj.priority === 'high') {
        queue.unshift(messageObj); // Al inicio para alta prioridad
      } else {
        queue.push(messageObj); // Al final para prioridad normal
      }

      logger.info(`📤 MessageSender: Mensaje ${messageId} añadido a cola de ${sessionId} (posición ${queue.length})`);

      // Emitir evento
      this.emit('messageQueued', {
        messageId,
        sessionId,
        to: formattedTo,
        queuePosition: queue.length,
        timestamp: new Date()
      });

      // Iniciar procesamiento si no está activo
      if (!this.processingStatus.get(sessionId)?.active) {
        this._startProcessing(sessionId);
      }

      return {
        messageId,
        status: 'queued',
        queuePosition: queue.length,
        estimatedSendTime: this._estimateSendTime(sessionId, queue.length)
      };

    } catch (error) {
      logger.error(`❌ MessageSender: Error añadiendo mensaje a cola:`, error);
      
      this.emit('messageError', {
        sessionId,
        to,
        error: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Enviar mensaje inmediato (sin cola)
   * @param {string} sessionId - ID de la sesión
   * @param {string} to - Número destinatario
   * @param {string} message - Mensaje a enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendImmediateMessage(sessionId, to, message, options = {}) {
    try {
      this._ensureInitialized();
      this._validateInputs(sessionId, to, message);

      logger.info(`⚡ MessageSender: Envío inmediato desde ${sessionId} a ${to}`);

      // Formatear número
      const formattedTo = this._formatPhoneNumber(to);

      // Verificar rate limit si no se debe saltear
      if (!options.skipRateLimit && !this._checkRateLimit(sessionId)) {
        throw new Error(`Rate limit excedido para sesión ${sessionId}`);
      }

      // Enviar a través del connection manager
      const result = await this.connectionManager.sendMessage(sessionId, formattedTo, message, options);

      // Actualizar rate limiter
      if (!options.skipRateLimit) {
        this._recordSentMessage(sessionId);
      }

      logger.info(`✅ MessageSender: Mensaje inmediato enviado desde ${sessionId} a ${formattedTo}`);

      this.emit('messageSent', {
        sessionId,
        to: formattedTo,
        message,
        immediate: true,
        timestamp: new Date()
      });

      return {
        success: true,
        sessionId,
        to: formattedTo,
        message,
        immediate: true,
        result,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`❌ MessageSender: Error en envío inmediato desde ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener estado de la cola de una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Object} Estado de la cola
   */
  getQueueStatus(sessionId) {
    this._ensureInitialized();
    
    const queue = this.messageQueues.get(sessionId) || [];
    const processing = this.processingStatus.get(sessionId) || { active: false };
    const rateLimiter = this.rateLimiters.get(sessionId) || { count: 0, resetAt: new Date() };

    return {
      sessionId,
      queueSize: queue.length,
      processing: processing.active,
      currentMessage: processing.currentMessage || null,
      rateLimit: {
        current: rateLimiter.count,
        max: this.config.maxMessagesPerMinute,
        resetAt: rateLimiter.resetAt,
        timeToReset: Math.max(0, rateLimiter.resetAt - Date.now())
      },
      estimatedTimeToComplete: this._estimateCompletionTime(sessionId),
      pendingMessages: queue.map(msg => ({
        id: msg.id,
        to: msg.to,
        priority: msg.priority,
        queuedAt: msg.queuedAt,
        attempts: msg.attempts,
        status: msg.status
      }))
    };
  }

  /**
   * Pausar procesamiento de una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {boolean} True si se pausó exitosamente
   */
  pauseSession(sessionId) {
    try {
      const processing = this.processingStatus.get(sessionId);
      if (!processing) {
        return false;
      }

      processing.paused = true;
      
      logger.info(`⏸️ MessageSender: Sesión ${sessionId} pausada`);
      
      this.emit('sessionPaused', {
        sessionId,
        timestamp: new Date()
      });

      return true;
      
    } catch (error) {
      logger.error(`❌ MessageSender: Error pausando sesión ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Reanudar procesamiento de una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {boolean} True si se reanudó exitosamente
   */
  resumeSession(sessionId) {
    try {
      const processing = this.processingStatus.get(sessionId);
      if (!processing) {
        return false;
      }

      processing.paused = false;
      
      // Reanudar procesamiento
      if (!processing.active) {
        this._startProcessing(sessionId);
      }
      
      logger.info(`▶️ MessageSender: Sesión ${sessionId} reanudada`);
      
      this.emit('sessionResumed', {
        sessionId,
        timestamp: new Date()
      });

      return true;
      
    } catch (error) {
      logger.error(`❌ MessageSender: Error reanudando sesión ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Limpiar cola de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {string} filter - Filtro ('all', 'failed', 'pending')
   * @returns {number} Número de mensajes eliminados
   */
  clearQueue(sessionId, filter = 'all') {
    try {
      const queue = this.messageQueues.get(sessionId);
      if (!queue) {
        return 0;
      }

      let removed = 0;

      switch (filter) {
        case 'all':
          removed = queue.length;
          queue.length = 0; // Limpiar array
          break;

        case 'failed':
          for (let i = queue.length - 1; i >= 0; i--) {
            if (queue[i].status === 'failed') {
              queue.splice(i, 1);
              removed++;
            }
          }
          break;

        case 'pending':
          for (let i = queue.length - 1; i >= 0; i--) {
            if (queue[i].status === 'queued' || queue[i].status === 'pending') {
              queue.splice(i, 1);
              removed++;
            }
          }
          break;

        default:
          throw new Error(`Filtro de limpieza no válido: ${filter}`);
      }

      logger.info(`🧹 MessageSender: ${removed} mensajes eliminados de cola ${sessionId} (filtro: ${filter})`);
      
      this.emit('queueCleared', {
        sessionId,
        filter,
        messagesRemoved: removed,
        timestamp: new Date()
      });

      return removed;

    } catch (error) {
      logger.error(`❌ MessageSender: Error limpiando cola ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas generales
   * @returns {Object} Estadísticas del sender
   */
  getStats() {
    this._ensureInitialized();
    
    const sessions = Array.from(this.messageQueues.keys());
    const totalQueued = Array.from(this.messageQueues.values()).reduce((sum, queue) => sum + queue.length, 0);
    const activeSessions = Array.from(this.processingStatus.values()).filter(p => p.active).length;

    return {
      totalSessions: sessions.length,
      activeSessions,
      totalQueuedMessages: totalQueued,
      averageQueueSize: sessions.length > 0 ? Math.round(totalQueued / sessions.length) : 0,
      config: {
        maxMessagesPerMinute: this.config.maxMessagesPerMinute,
        messageDelay: this.config.messageDelay,
        maxQueueSize: this.config.maxQueueSize,
        maxRetries: this.config.maxRetries
      }
    };
  }

  /**
   * Destruir el sender
   */
  async destroy() {
    logger.info('🧹 MessageSender: Destruyendo sistema de envío...');
    
    // Pausar todas las sesiones
    for (const sessionId of this.processingStatus.keys()) {
      this.pauseSession(sessionId);
    }
    
    // Limpiar timers
    if (this._processingTimer) {
      clearInterval(this._processingTimer);
    }
    
    // Limpiar datos
    this.messageQueues.clear();
    this.rateLimiters.clear();
    this.processingStatus.clear();
    
    // Remover listeners
    this.removeAllListeners();
    
    this.isInitialized = false;
    
    logger.info('✅ MessageSender: Destrucción completada');
  }

  // ==========================================
  // MÉTODOS PRIVADOS
  // ==========================================

  /**
   * Asegurar que está inicializado
   * @private
   */
  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('MessageSender no está inicializado');
    }
  }

  /**
   * Validar inputs de envío
   * @private
   */
  _validateInputs(sessionId, to, message) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('SessionId es requerido y debe ser string');
    }
    
    if (!to || typeof to !== 'string') {
      throw new Error('Destinatario es requerido y debe ser string');
    }
    
    if (!message || typeof message !== 'string') {
      throw new Error('Mensaje es requerido y debe ser string');
    }

    if (message.length > 4096) {
      throw new Error('Mensaje muy largo (máximo 4096 caracteres)');
    }
  }

  /**
   * Formatear número de teléfono
   * @private
   */
  _formatPhoneNumber(number) {
    // Limpiar número
    let cleaned = number.replace(/[^\d]/g, '');
    
    // Agregar código de país si no tiene
    if (!cleaned.startsWith('54') && cleaned.length === 10) {
      cleaned = '54' + cleaned;
    }
    
    // Agregar @c.us si no lo tiene
    if (!cleaned.includes('@c.us')) {
      cleaned = cleaned + '@c.us';
    }
    
    return cleaned;
  }

  /**
   * Generar ID único de mensaje
   * @private
   */
  _generateMessageId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `msg_${timestamp}_${random}`;
  }

  /**
   * Obtener o crear cola para sesión
   * @private
   */
  _getOrCreateQueue(sessionId) {
    if (!this.messageQueues.has(sessionId)) {
      this.messageQueues.set(sessionId, []);
    }
    return this.messageQueues.get(sessionId);
  }

  /**
   * Verificar rate limit
   * @private
   */
  _checkRateLimit(sessionId) {
    const rateLimiter = this.rateLimiters.get(sessionId);
    if (!rateLimiter) {
      return true; // No hay límite establecido aún
    }

    const now = Date.now();
    
    // Reset si ha pasado el minuto
    if (now >= rateLimiter.resetAt) {
      rateLimiter.count = 0;
      rateLimiter.resetAt = now + 60000; // Próximo minuto
      return true;
    }

    // Verificar límite
    return rateLimiter.count < this.config.maxMessagesPerMinute;
  }

  /**
   * Registrar mensaje enviado para rate limiting
   * @private
   */
  _recordSentMessage(sessionId) {
    if (!this.rateLimiters.has(sessionId)) {
      this.rateLimiters.set(sessionId, {
        count: 0,
        resetAt: Date.now() + 60000
      });
    }

    const rateLimiter = this.rateLimiters.get(sessionId);
    rateLimiter.count++;
  }

  /**
   * Estimar tiempo de envío
   * @private
   */
  _estimateSendTime(sessionId, queuePosition) {
    const delay = this.config.messageDelay;
    const estimatedMs = queuePosition * delay;
    return new Date(Date.now() + estimatedMs);
  }

  /**
   * Estimar tiempo de completar cola
   * @private
   */
  _estimateCompletionTime(sessionId) {
    const queue = this.messageQueues.get(sessionId);
    if (!queue || queue.length === 0) {
      return 0;
    }

    const averageDelay = this.config.messageDelay;
    const estimatedMs = queue.length * averageDelay;
    
    return estimatedMs;
  }

  /**
   * Iniciar procesamiento de una sesión
   * @private
   */
  _startProcessing(sessionId) {
    if (!this.processingStatus.has(sessionId)) {
      this.processingStatus.set(sessionId, {
        active: false,
        paused: false,
        currentMessage: null,
        lastProcessedAt: null
      });
    }

    const status = this.processingStatus.get(sessionId);
    if (status.active || status.paused) {
      return; // Ya está procesando o pausado
    }

    status.active = true;
    
    logger.info(`🔄 MessageSender: Iniciando procesamiento para sesión ${sessionId}`);
    
    // Procesar mensajes en background
    this._processQueue(sessionId);
  }

  /**
   * Procesar cola de mensajes
   * @private
   */
  async _processQueue(sessionId) {
    const queue = this.messageQueues.get(sessionId);
    const status = this.processingStatus.get(sessionId);

    if (!queue || !status || status.paused) {
      status.active = false;
      return;
    }

    while (queue.length > 0 && !status.paused) {
      const message = queue[0]; // Tomar primer mensaje
      status.currentMessage = message;

      try {
        // Verificar si el mensaje no ha expirado
        if (new Date() > message.expiresAt) {
          logger.warn(`⏰ MessageSender: Mensaje ${message.id} expirado, saltando`);
          queue.shift(); // Remover de la cola
          continue;
        }

        // Verificar rate limit
        if (!message.config.skipRateLimit && !this._checkRateLimit(sessionId)) {
          logger.info(`⏳ MessageSender: Rate limit alcanzado para ${sessionId}, esperando...`);
          await this._waitForRateLimit(sessionId);
          continue;
        }

        // Intentar enviar mensaje
        await this._sendQueuedMessage(sessionId, message);
        
        // Remover mensaje exitoso de la cola
        queue.shift();
        
        // Esperar delay entre mensajes
        if (message.config.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, message.config.delay));
        }

      } catch (error) {
        logger.error(`❌ MessageSender: Error procesando mensaje ${message.id}:`, error);
        
        // Manejar retry
        message.attempts++;
        message.status = 'failed';
        message.lastError = error.message;
        message.lastAttemptAt = new Date();

        if (message.attempts >= message.maxRetries) {
          logger.error(`❌ MessageSender: Mensaje ${message.id} falló definitivamente después de ${message.attempts} intentos`);
          
          // Remover mensaje fallido permanentemente
          queue.shift();
          
          this.emit('messageFailed', {
            messageId: message.id,
            sessionId: message.sessionId,
            to: message.to,
            attempts: message.attempts,
            error: error.message,
            timestamp: new Date()
          });
        } else {
          // Calcular delay para retry
          const retryDelay = message.config.delay * Math.pow(this.config.retryMultiplier, message.attempts - 1);
          
          logger.info(`🔄 MessageSender: Reintentando mensaje ${message.id} en ${retryDelay}ms (intento ${message.attempts}/${message.maxRetries})`);
          
          // Esperar antes del próximo intento
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // Finalizar procesamiento
    status.active = false;
    status.currentMessage = null;
    status.lastProcessedAt = new Date();

    logger.info(`✅ MessageSender: Procesamiento completado para sesión ${sessionId}`);
  }

  /**
   * Enviar mensaje desde cola
   * @private
   */
  async _sendQueuedMessage(sessionId, message) {
    try {
      logger.info(`📤 MessageSender: Enviando mensaje ${message.id} desde ${sessionId} a ${message.to}`);

      message.status = 'sending';
      message.sendingAt = new Date();

      // Enviar a través del connection manager con timeout
      const result = await Promise.race([
        this.connectionManager.sendMessage(sessionId, message.to, message.message),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout enviando mensaje')), message.config.timeout)
        )
      ]);

      // Actualizar estado del mensaje
      message.status = 'sent';
      message.sentAt = new Date();
      message.result = result;

      // Actualizar rate limiter
      if (!message.config.skipRateLimit) {
        this._recordSentMessage(sessionId);
      }

      logger.info(`✅ MessageSender: Mensaje ${message.id} enviado exitosamente`);

      this.emit('messageSent', {
        messageId: message.id,
        sessionId: message.sessionId,
        to: message.to,
        attempts: message.attempts + 1,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      message.status = 'error';
      message.errorAt = new Date();
      throw error;
    }
  }

  /**
   * Esperar hasta que el rate limit se resetee
   * @private
   */
  async _waitForRateLimit(sessionId) {
    const rateLimiter = this.rateLimiters.get(sessionId);
    if (!rateLimiter) {
      return;
    }

    const waitTime = Math.max(0, rateLimiter.resetAt - Date.now());
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Configurar timers de procesamiento
   * @private
   */
  _setupProcessingTimers() {
    // Timer para limpiar mensajes expirados cada 5 minutos
    this._processingTimer = setInterval(() => {
      this._cleanupExpiredMessages();
    }, 300000);
  }

  /**
   * Limpiar mensajes expirados
   * @private
   */
  _cleanupExpiredMessages() {
    const now = new Date();
    let totalCleaned = 0;

    for (const [sessionId, queue] of this.messageQueues) {
      const before = queue.length;
      
      // Filtrar mensajes no expirados
      const filtered = queue.filter(message => now <= message.expiresAt);
      
      // Actualizar cola
      queue.length = 0;
      queue.push(...filtered);
      
      const cleaned = before - filtered.length;
      totalCleaned += cleaned;

      if (cleaned > 0) {
        logger.info(`🧹 MessageSender: ${cleaned} mensajes expirados eliminados de cola ${sessionId}`);
      }
    }

    if (totalCleaned > 0) {
      this.emit('messagesExpired', {
        totalCleaned,
        timestamp: new Date()
      });
    }
  }
}

module.exports = MessageSender;