/**
 * Escucha de Mensajes WhatsApp
 * Sistema de escucha con integración a base de datos, IA y manejo multicliente
 */

const EventEmitter = require('events');
const logger = require('../../../core/logger');
const config = require('../../../core/config');

class MessageListener extends EventEmitter {
  constructor(connectionManager, database) {
    super();
    
    this.connectionManager = connectionManager;
    this.database = database;
    
    // Listeners activos por sesión: sessionId -> listenerData
    this.activeListeners = new Map();
    
    // Cache de usuarios para optimizar consultas
    this.usersCache = new Map();
    
    // Configuración
    this.config = {
      // Filtros de mensajes
      ignoreBroadcast: process.env.IGNORE_BROADCAST === 'true',
      ignoreGroups: process.env.IGNORE_GROUPS === 'true',
      ignoreStatus: process.env.IGNORE_STATUS === 'true',
      
      // IA y respuestas automáticas
      aiEnabled: process.env.BOT_RESPONDER_ACTIVO === 'true',
      aiMaxHistory: parseInt(process.env.AI_MAX_HISTORY) || 10,
      
      // Base de datos
      saveMessages: process.env.SAVE_MESSAGES !== 'false',
      saveConversations: process.env.SAVE_CONVERSATIONS !== 'false',
      
      // Rate limiting para respuestas
      responseDelay: parseInt(process.env.RESPONSE_DELAY) || 2000,
      maxResponsesPerMinute: parseInt(process.env.MAX_RESPONSES_PER_MINUTE) || 30,
      
      // Cache
      userCacheExpiry: parseInt(process.env.USER_CACHE_EXPIRY) || 300000, // 5 minutos
      maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE) || 1000
    };

    this.isInitialized = false;
    this._setupConnectionManagerListeners();
  }

  /**
   * Inicializar el listener
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('⚠️ MessageListener ya está inicializado');
      return;
    }

    try {
      logger.info('🚀 MessageListener: Inicializando sistema de escucha...');
      
      // Validar dependencias
      if (!this.connectionManager) {
        throw new Error('ConnectionManager es requerido');
      }
      
      if (!this.database) {
        throw new Error('Database es requerido');
      }

      this.isInitialized = true;
      
      logger.info('✅ MessageListener: Sistema inicializado');
      
      this.emit('initialized');
      
    } catch (error) {
      logger.error('❌ MessageListener: Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Iniciar escucha para una sesión específica
   * @param {string} sessionId - ID de la sesión
   * @param {Object} options - Opciones de configuración
   * @returns {boolean} True si se inició exitosamente
   */
  startListening(sessionId, options = {}) {
    try {
      this._ensureInitialized();

      if (this.activeListeners.has(sessionId)) {
        logger.warn(`⚠️ MessageListener: Ya hay un listener activo para sesión ${sessionId}`);
        return false;
      }

      logger.info(`🎧 MessageListener: Iniciando escucha para sesión ${sessionId}`);

      // Obtener sesión del connection manager
      const session = this.connectionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Sesión ${sessionId} no encontrada`);
      }

      // Configurar datos del listener
      const listenerData = {
        sessionId,
        startedAt: new Date(),
        messagesReceived: 0,
        responsesGenerated: 0,
        errors: 0,
        lastActivity: new Date(),
        options: {
          aiEnabled: options.aiEnabled !== undefined ? options.aiEnabled : this.config.aiEnabled,
          saveMessages: options.saveMessages !== undefined ? options.saveMessages : this.config.saveMessages,
          autoResponse: options.autoResponse !== undefined ? options.autoResponse : true,
          ...options
        }
      };

      this.activeListeners.set(sessionId, listenerData);

      // Configurar listener de mensajes en el adaptador
      this._setupSessionListener(sessionId);

      logger.info(`✅ MessageListener: Escucha iniciada para sesión ${sessionId}`);

      this.emit('listeningStarted', {
        sessionId,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`❌ MessageListener: Error iniciando escucha para ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Detener escucha para una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {boolean} True si se detuvo exitosamente
   */
  stopListening(sessionId) {
    try {
      const listenerData = this.activeListeners.get(sessionId);
      if (!listenerData) {
        logger.warn(`⚠️ MessageListener: No hay listener activo para sesión ${sessionId}`);
        return false;
      }

      logger.info(`🛑 MessageListener: Deteniendo escucha para sesión ${sessionId}`);

      // Remover listener
      this.activeListeners.delete(sessionId);

      // Limpiar cache de usuarios para esta sesión
      this._clearSessionCache(sessionId);

      logger.info(`✅ MessageListener: Escucha detenida para sesión ${sessionId}`);

      this.emit('listeningStopped', {
        sessionId,
        stats: {
          duration: Date.now() - listenerData.startedAt.getTime(),
          messagesReceived: listenerData.messagesReceived,
          responsesGenerated: listenerData.responsesGenerated,
          errors: listenerData.errors
        },
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`❌ MessageListener: Error deteniendo escucha para ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Obtener estado de listeners activos
   * @returns {Array} Lista de listeners activos
   */
  getActiveListeners() {
    this._ensureInitialized();
    
    return Array.from(this.activeListeners.entries()).map(([sessionId, data]) => ({
      sessionId,
      startedAt: data.startedAt,
      messagesReceived: data.messagesReceived,
      responsesGenerated: data.responsesGenerated,
      errors: data.errors,
      lastActivity: data.lastActivity,
      duration: Date.now() - data.startedAt.getTime(),
      options: data.options
    }));
  }

  /**
   * Obtener estadísticas generales
   * @returns {Object} Estadísticas del listener
   */
  getStats() {
    this._ensureInitialized();
    
    const listeners = this.getActiveListeners();
    
    return {
      activeListeners: listeners.length,
      totalMessagesReceived: listeners.reduce((sum, l) => sum + l.messagesReceived, 0),
      totalResponsesGenerated: listeners.reduce((sum, l) => sum + l.responsesGenerated, 0),
      totalErrors: listeners.reduce((sum, l) => sum + l.errors, 0),
      cacheSize: this.usersCache.size,
      averageResponseTime: this._calculateAverageResponseTime(),
      config: this.config
    };
  }

  /**
   * Destruir el listener
   */
  async destroy() {
    logger.info('🧹 MessageListener: Destruyendo sistema de escucha...');
    
    // Detener todos los listeners
    const sessionIds = Array.from(this.activeListeners.keys());
    for (const sessionId of sessionIds) {
      this.stopListening(sessionId);
    }
    
    // Limpiar cache
    this.usersCache.clear();
    
    // Remover listeners
    this.removeAllListeners();
    
    this.isInitialized = false;
    
    logger.info('✅ MessageListener: Destrucción completada');
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
      throw new Error('MessageListener no está inicializado');
    }
  }

  /**
   * Configurar listeners del connection manager
   * @private
   */
  _setupConnectionManagerListeners() {
    // Escuchar cuando se recibe un mensaje
    this.connectionManager.on('messageReceived', (data) => {
      this._handleIncomingMessage(data);
    });

    // Escuchar cuando se conecta una sesión
    this.connectionManager.on('sessionConnected', (data) => {
      // Auto-iniciar listening si la sesión estaba activa
      const listenerData = this.activeListeners.get(data.sessionId);
      if (listenerData) {
        this._setupSessionListener(data.sessionId);
      }
    });

    // Escuchar cuando se cierra una sesión
    this.connectionManager.on('sessionClosed', (data) => {
      this.stopListening(data.sessionId);
    });
  }

  /**
   * Configurar listener para una sesión específica
   * @private
   */
  _setupSessionListener(sessionId) {
    // El ConnectionManager ya emite eventos 'messageReceived'
    // que son capturados por _setupConnectionManagerListeners
    logger.debug(`🔗 MessageListener: Listener configurado para sesión ${sessionId}`);
  }

  /**
   * Manejar mensaje entrante
   * @private
   */
  async _handleIncomingMessage(data) {
    try {
      const { sessionId, message } = data;

      // Verificar si hay listener activo para esta sesión
      const listenerData = this.activeListeners.get(sessionId);
      if (!listenerData) {
        return; // No hay listener activo
      }

      // Actualizar estadísticas
      listenerData.messagesReceived++;
      listenerData.lastActivity = new Date();

      // Filtrar mensajes según configuración
      if (!this._shouldProcessMessage(message)) {
        logger.debug(`📱 MessageListener: Mensaje filtrado de ${sessionId}`);
        return;
      }

      // Extraer información del mensaje
      const messageInfo = this._parseMessage(message);
      
      logger.info(`📨 MessageListener: Mensaje recibido en ${sessionId} de ${messageInfo.from}`);

      // Procesar mensaje
      await this._processMessage(sessionId, messageInfo, listenerData);

    } catch (error) {
      logger.error('❌ MessageListener: Error procesando mensaje:', error);
      
      const listenerData = this.activeListeners.get(data.sessionId);
      if (listenerData) {
        listenerData.errors++;
      }
    }
  }

  /**
   * Verificar si se debe procesar el mensaje
   * @private
   */
  _shouldProcessMessage(message) {
    // Filtrar broadcasts
    if (this.config.ignoreBroadcast && message.broadcast) {
      return false;
    }

    // Filtrar grupos
    if (this.config.ignoreGroups && message.isGroupMsg) {
      return false;
    }

    // Filtrar estados (stories)
    if (this.config.ignoreStatus && message.chatId && message.chatId.includes('status@broadcast')) {
      return false;
    }

    // Solo procesar mensajes de texto por ahora
    if (message.type !== 'chat') {
      return false;
    }

    return true;
  }

  /**
   * Parsear información del mensaje
   * @private
   */
  _parseMessage(message) {
    return {
      id: message.id,
      from: message.from,
      to: message.to,
      text: message.body || message.content || '',
      timestamp: new Date(message.timestamp * 1000),
      type: message.type || 'text',
      isGroup: message.isGroupMsg || false,
      chatId: message.chatId,
      // Extraer número de teléfono limpio
      phoneNumber: this._extractPhoneNumber(message.from),
      // Metadata adicional
      metadata: {
        deviceType: message.deviceType,
        isForwarded: message.isForwarded,
        quotedMsg: message.quotedMsgId,
        mentionedJidList: message.mentionedJidList
      }
    };
  }

  /**
   * Procesar mensaje completo
   * @private
   */
  async _processMessage(sessionId, messageInfo, listenerData) {
    try {
      // 1. Guardar mensaje en base de datos
      if (listenerData.options.saveMessages) {
        await this._saveMessageToDB(sessionId, messageInfo);
      }

      // 2. Obtener o crear usuario
      const user = await this._getOrCreateUser(messageInfo.phoneNumber, messageInfo);

      // 3. Guardar conversación para IA
      if (listenerData.options.saveConversations) {
        await this._saveConversationToDB(messageInfo.phoneNumber, 'user', messageInfo.text);
      }

      // 4. Generar respuesta automática si está habilitado
      if (listenerData.options.autoResponse && listenerData.options.aiEnabled) {
        await this._generateAutoResponse(sessionId, messageInfo, user, listenerData);
      }

      // 5. Emitir evento para procesamiento adicional
      this.emit('messageProcessed', {
        sessionId,
        messageInfo,
        user,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error(`❌ MessageListener: Error procesando mensaje de ${messageInfo.from}:`, error);
      throw error;
    }
  }

  /**
   * Guardar mensaje en base de datos
   * @private
   */
  async _saveMessageToDB(sessionId, messageInfo) {
    try {
      const query = `
        INSERT INTO ll_mensajes (telefono, mensaje, fecha, fuente)
        VALUES (?, ?, ?, 'whatsapp')
      `;
      
      await this.database.query(query, [
        messageInfo.phoneNumber,
        messageInfo.text,
        messageInfo.timestamp
      ]);

      logger.debug(`💾 MessageListener: Mensaje guardado en BD para ${messageInfo.phoneNumber}`);

    } catch (error) {
      logger.error('❌ Error guardando mensaje en BD:', error);
      throw error;
    }
  }

  /**
   * Obtener o crear usuario de WhatsApp
   * @private
   */
  async _getOrCreateUser(phoneNumber, messageInfo) {
    try {
      // Verificar cache primero
      const cacheKey = `user_${phoneNumber}`;
      const cachedUser = this.usersCache.get(cacheKey);
      
      if (cachedUser && (Date.now() - cachedUser.cachedAt) < this.config.userCacheExpiry) {
        return cachedUser.data;
      }

      // Buscar en base de datos
      let query = 'SELECT * FROM ll_usuarios_wa WHERE telefono = ?';
      let results = await this.database.query(query, [phoneNumber]);

      let user;
      
      if (results.length === 0) {
        // Crear nuevo usuario
        query = `
          INSERT INTO ll_usuarios_wa (telefono, nombre, ultima_interaccion, fuente)
          VALUES (?, ?, ?, 'whatsapp')
        `;
        
        await this.database.query(query, [
          phoneNumber,
          messageInfo.metadata.pushname || null,
          new Date(),
        ]);

        user = {
          telefono: phoneNumber,
          nombre: messageInfo.metadata.pushname || null,
          rubro_id: null,
          ultima_interaccion: new Date(),
          fuente: 'whatsapp'
        };

        logger.info(`👤 MessageListener: Nuevo usuario creado: ${phoneNumber}`);

      } else {
        // Actualizar última interacción
        user = results[0];
        
        query = 'UPDATE ll_usuarios_wa SET ultima_interaccion = ? WHERE telefono = ?';
        await this.database.query(query, [new Date(), phoneNumber]);
        
        user.ultima_interaccion = new Date();
      }

      // Guardar en cache
      this._cacheUser(cacheKey, user);

      return user;

    } catch (error) {
      logger.error(`❌ Error obteniendo/creando usuario ${phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Guardar conversación para IA
   * @private
   */
  async _saveConversationToDB(phoneNumber, role, message) {
    try {
      const query = `
        INSERT INTO ll_ia_conversaciones (telefono, rol, mensaje)
        VALUES (?, ?, ?)
      `;
      
      await this.database.query(query, [phoneNumber, role, message]);

      logger.debug(`🤖 MessageListener: Conversación IA guardada para ${phoneNumber} (${role})`);

    } catch (error) {
      logger.error('❌ Error guardando conversación IA:', error);
      throw error;
    }
  }

  /**
   * Generar respuesta automática con IA
   * @private
   */
  async _generateAutoResponse(sessionId, messageInfo, user, listenerData) {
    try {
      // Verificar rate limiting
      if (!this._checkResponseRateLimit(sessionId)) {
        logger.debug(`⏳ Rate limit activo para respuestas en ${sessionId}`);
        return;
      }

      // Obtener historial de conversación
      const conversationHistory = await this._getConversationHistory(messageInfo.phoneNumber);

      // TODO: Integrar con módulo de IA (ChatGPT/OpenAI)
      // Por ahora, respuesta simple de prueba
      const response = await this._generateSimpleResponse(messageInfo.text, conversationHistory);

      if (response) {
        // Esperar delay antes de responder
        await new Promise(resolve => setTimeout(resolve, this.config.responseDelay));

        // Enviar respuesta
        await this.connectionManager.sendMessage(sessionId, messageInfo.from, response);

        // Guardar respuesta en conversación
        await this._saveConversationToDB(messageInfo.phoneNumber, 'assistant', response);

        // Actualizar estadísticas
        listenerData.responsesGenerated++;

        logger.info(`🤖 MessageListener: Respuesta automática enviada a ${messageInfo.phoneNumber}`);

        this.emit('autoResponseSent', {
          sessionId,
          to: messageInfo.phoneNumber,
          message: response,
          timestamp: new Date()
        });
      }

    } catch (error) {
      logger.error(`❌ Error generando respuesta automática para ${messageInfo.phoneNumber}:`, error);
    }
  }

  /**
   * Obtener historial de conversación
   * @private
   */
  async _getConversationHistory(phoneNumber) {
    try {
      const query = `
        SELECT rol, mensaje, created_at
        FROM ll_ia_conversaciones
        WHERE telefono = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;
      
      const results = await this.database.query(query, [phoneNumber, this.config.aiMaxHistory]);
      
      return results.reverse(); // Ordenar cronológicamente

    } catch (error) {
      logger.error(`❌ Error obteniendo historial para ${phoneNumber}:`, error);
      return [];
    }
  }

  /**
   * Generar respuesta simple (placeholder para IA)
   * @private
   */
  async _generateSimpleResponse(message, history) {
    // Respuestas automáticas básicas por ahora
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hola') || lowerMessage.includes('buenos')) {
      return '¡Hola! Gracias por contactarnos. ¿En qué podemos ayudarte?';
    }
    
    if (lowerMessage.includes('precio') || lowerMessage.includes('costo')) {
      return 'Te enviaremos información sobre nuestros precios. ¿Podrías contarnos más sobre lo que necesitas?';
    }
    
    if (lowerMessage.includes('info') || lowerMessage.includes('información')) {
      return 'Por supuesto, estaremos encantados de brindarte más información. ¿Sobre qué servicio específico te interesa saber?';
    }

    // Si no hay respuesta automática, no responder
    return null;
  }

  /**
   * Verificar rate limit para respuestas
   * @private
   */
  _checkResponseRateLimit(sessionId) {
    // Implementación simple - se puede mejorar con Redis o cache más sofisticado
    return true; // Por ahora siempre permitir
  }

  /**
   * Extraer número de teléfono limpio
   * @private
   */
  _extractPhoneNumber(fromJid) {
    // Remover @c.us y otros sufijos de WhatsApp
    const cleaned = fromJid.replace('@c.us', '').replace('@g.us', '');
    
    // Formatear para Argentina si es necesario
    if (cleaned.length === 10 && !cleaned.startsWith('54')) {
      return '54' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Guardar usuario en cache
   * @private
   */
  _cacheUser(key, userData) {
    // Verificar límite de cache
    if (this.usersCache.size >= this.config.maxCacheSize) {
      // Remover el usuario más antiguo
      const firstKey = this.usersCache.keys().next().value;
      this.usersCache.delete(firstKey);
    }

    this.usersCache.set(key, {
      data: userData,
      cachedAt: Date.now()
    });
  }

  /**
   * Limpiar cache de una sesión
   * @private
   */
  _clearSessionCache(sessionId) {
    // Por ahora el cache es global, se puede particularizar por sesión si es necesario
    logger.debug(`🧹 Cache mantenido para sesión ${sessionId}`);
  }

  /**
   * Calcular tiempo promedio de respuesta
   * @private
   */
  _calculateAverageResponseTime() {
    // Placeholder - se puede implementar con métricas reales
    return 0;
  }
}

module.exports = MessageListener;