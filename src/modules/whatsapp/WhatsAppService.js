/**
 * Servicio Principal de WhatsApp
 * Fachada que coordina todos los módulos del sistema WhatsApp multicliente
 */

const EventEmitter = require('events');
const ConnectionManager = require('./connection/ConnectionManager');
const SessionStore = require('./connection/SessionStore');
const QRCodeHandler = require('./connection/QRCodeHandler');
const MessageSender = require('./sender/MessageSender');
const MessageListener = require('./listener/MessageListener');

const logger = require('../../core/logger');
const config = require('../../core/config');

class WhatsAppService extends EventEmitter {
  constructor(database) {
    super();
    
    this.database = database;
    
    // Módulos principales
    this.connectionManager = null;
    this.sessionStore = null;
    this.qrHandler = null;
    this.messageSender = null;
    this.messageListener = null;
    
    // Estado del servicio
    this.isInitialized = false;
    this.isRunning = false;
    
    // Configuración
    this.config = {
      autoStartListening: config.whatsapp.responderActivo || false,
      defaultSessionOptions: {
        aiEnabled: config.features?.aiResponses || false,
        saveMessages: true,
        saveConversations: true,
        autoResponse: config.whatsapp.responderActivo || false
      }
    };
    
    // Estadísticas
    this.stats = {
      startedAt: null,
      totalSessionsCreated: 0,
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      totalQRsGenerated: 0,
      totalErrors: 0
    };
  }

  /**
   * Inicializar todo el sistema WhatsApp
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('⚠️ WhatsAppService ya está inicializado');
      return;
    }

    try {
      logger.info('🚀 WhatsAppService: Inicializando sistema WhatsApp completo...');
      
      // Validar dependencias
      if (!this.database) {
        throw new Error('Database es requerido para WhatsAppService');
      }

      // 1. Inicializar SessionStore
      logger.info('📂 Inicializando SessionStore...');
      this.sessionStore = new SessionStore();
      await this.sessionStore.initialize();

      // 2. Inicializar QRCodeHandler
      logger.info('📱 Inicializando QRCodeHandler...');
      this.qrHandler = new QRCodeHandler();
      await this.qrHandler.initialize();

      // 3. Inicializar ConnectionManager
      logger.info('🔌 Inicializando ConnectionManager...');
      this.connectionManager = new ConnectionManager();
      await this.connectionManager.initialize();

      // 4. Inicializar MessageSender
      logger.info('📤 Inicializando MessageSender...');
      this.messageSender = new MessageSender(this.connectionManager);
      await this.messageSender.initialize();

      // 5. Inicializar MessageListener
      logger.info('📨 Inicializando MessageListener...');
      this.messageListener = new MessageListener(this.connectionManager, this.database);
      await this.messageListener.initialize();

      // 6. Configurar eventos entre módulos
      this._setupModuleEvents();

      this.isInitialized = true;
      this.stats.startedAt = new Date();

      logger.info('✅ WhatsAppService: Sistema WhatsApp inicializado completamente');
      
      this.emit('initialized', {
        timestamp: new Date(),
        modules: ['SessionStore', 'QRCodeHandler', 'ConnectionManager', 'MessageSender', 'MessageListener']
      });

    } catch (error) {
      logger.error('❌ WhatsAppService: Error en inicialización:', error);
      
      // Cleanup parcial si hubo error
      await this._cleanupModules();
      
      throw error;
    }
  }

  /**
   * Iniciar el servicio (solo después de initialize)
   */
  async start() {
    try {
      this._ensureInitialized();
      
      if (this.isRunning) {
        logger.warn('⚠️ WhatsAppService ya está ejecutándose');
        return;
      }

      logger.info('▶️ WhatsAppService: Iniciando servicio...');

      this.isRunning = true;

      logger.info('✅ WhatsAppService: Servicio iniciado');

      this.emit('started', {
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('❌ WhatsAppService: Error iniciando servicio:', error);
      throw error;
    }
  }

  /**
   * Detener el servicio
   */
  async stop() {
    try {
      if (!this.isRunning) {
        logger.warn('⚠️ WhatsAppService no está ejecutándose');
        return;
      }

      logger.info('⏹️ WhatsAppService: Deteniendo servicio...');

      this.isRunning = false;

      // Detener listening en todas las sesiones
      if (this.messageListener) {
        const activeListeners = this.messageListener.getActiveListeners();
        for (const listener of activeListeners) {
          await this.messageListener.stopListening(listener.sessionId);
        }
      }

      // Cerrar todas las conexiones
      if (this.connectionManager) {
        await this.connectionManager.closeAllSessions();
      }

      logger.info('✅ WhatsAppService: Servicio detenido');

      this.emit('stopped', {
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('❌ WhatsAppService: Error deteniendo servicio:', error);
      throw error;
    }
  }

  /**
   * Destruir completamente el servicio
   */
  async destroy() {
    try {
      logger.info('🧹 WhatsAppService: Destruyendo servicio...');

      // Detener si está corriendo
      if (this.isRunning) {
        await this.stop();
      }

      // Destruir módulos
      await this._cleanupModules();

      this.isInitialized = false;

      // Limpiar listeners
      this.removeAllListeners();

      logger.info('✅ WhatsAppService: Servicio destruido');

    } catch (error) {
      logger.error('❌ WhatsAppService: Error destruyendo servicio:', error);
      throw error;
    }
  }

  // ==========================================
  // API PÚBLICA - GESTIÓN DE SESIONES
  // ==========================================

  /**
   * Crear nueva sesión WhatsApp
   * @param {string} sessionId - ID único de la sesión
   * @param {Object} options - Opciones de configuración
   * @returns {Promise<Object>} Información de la sesión creada
   */
  async createSession(sessionId, options = {}) {
    try {
      this._ensureInitialized();
      this._ensureRunning();

      logger.info(`🔧 WhatsAppService: Creando sesión ${sessionId}`);

      // 1. Crear en SessionStore
      await this.sessionStore.createSession(sessionId, options.metadata || {});

      // 2. Crear conexión
      const connection = await this.connectionManager.createSession(sessionId, options);

      // 3. Auto-iniciar listening si está configurado
      if (this.config.autoStartListening || options.autoStartListening) {
        const listenerOptions = { 
          ...this.config.defaultSessionOptions, 
          ...options.listenerOptions 
        };
        this.messageListener.startListening(sessionId, listenerOptions);
      }

      // Actualizar estadísticas
      this.stats.totalSessionsCreated++;

      logger.info(`✅ WhatsAppService: Sesión ${sessionId} creada exitosamente`);

      this.emit('sessionCreated', {
        sessionId,
        connection,
        timestamp: new Date()
      });

      return {
        sessionId,
        status: connection.status,
        metadata: connection.metadata,
        listeningActive: this.messageListener.getActiveListeners().some(l => l.sessionId === sessionId)
      };

    } catch (error) {
      logger.error(`❌ WhatsAppService: Error creando sesión ${sessionId}:`, error);
      this.stats.totalErrors++;
      throw error;
    }
  }

  /**
   * Obtener información de una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Object|null} Información completa de la sesión
   */
  getSession(sessionId) {
    try {
      this._ensureInitialized();

      // Datos del connection manager
      const connection = this.connectionManager.getSession(sessionId);
      if (!connection) {
        return null;
      }

      // Datos del session store
      const sessionData = this.sessionStore.getSession(sessionId);

      // Estado del listener
      const listeners = this.messageListener.getActiveListeners();
      const listener = listeners.find(l => l.sessionId === sessionId);

      // Estado de la cola de mensajes
      const queueStatus = this.messageSender.getQueueStatus(sessionId);

      // QR Code disponible
      const qrCode = this.qrHandler.getQRCode(sessionId);

      return {
        sessionId,
        
        // Conexión
        connection: {
          status: connection.status,
          createdAt: connection.createdAt,
          lastActivity: connection.lastActivity,
          reconnectAttempts: connection.reconnectAttempts,
          hasClient: connection.hasClient
        },
        
        // Datos persistentes
        sessionData: sessionData ? {
          createdAt: sessionData.createdAt,
          lastUsed: sessionData.lastUsed,
          metadata: sessionData.metadata,
          stats: sessionData.stats
        } : null,
        
        // Listener
        listener: listener ? {
          active: true,
          startedAt: listener.startedAt,
          messagesReceived: listener.messagesReceived,
          responsesGenerated: listener.responsesGenerated,
          lastActivity: listener.lastActivity,
          options: listener.options
        } : { active: false },
        
        // Cola de mensajes
        messageQueue: {
          size: queueStatus.queueSize,
          processing: queueStatus.processing,
          estimatedTimeToComplete: queueStatus.estimatedTimeToComplete
        },
        
        // QR Code
        qrCode: qrCode ? {
          available: true,
          attempts: qrCode.attempts,
          timestamp: qrCode.timestamp,
          expiresAt: qrCode.expiresAt
        } : { available: false }
      };

    } catch (error) {
      logger.error(`❌ WhatsAppService: Error obteniendo sesión ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Listar todas las sesiones
   * @returns {Array} Lista de sesiones con información básica
   */
  listSessions() {
    try {
      this._ensureInitialized();

      const connections = this.connectionManager.listSessions();
      const listeners = this.messageListener.getActiveListeners();

      return connections.map(connection => {
        const listener = listeners.find(l => l.sessionId === connection.sessionId);
        const sessionData = this.sessionStore.getSession(connection.sessionId);
        const hasQR = this.qrHandler.hasQRCode(connection.sessionId);
        const queueStatus = this.messageSender.getQueueStatus(connection.sessionId);

        return {
          sessionId: connection.sessionId,
          status: connection.status,
          createdAt: connection.createdAt,
          lastActivity: connection.lastActivity,
          hasQR,
          listeningActive: !!listener,
          messagesInQueue: queueStatus.queueSize,
          totalMessages: sessionData?.stats?.totalMessages || 0
        };
      });

    } catch (error) {
      logger.error('❌ WhatsAppService: Error listando sesiones:', error);
      return [];
    }
  }

  /**
   * Cerrar una sesión
   * @param {string} sessionId - ID de la sesión
   * @returns {Promise<boolean>} True si se cerró exitosamente
   */
  async closeSession(sessionId) {
    try {
      this._ensureInitialized();

      logger.info(`🛑 WhatsAppService: Cerrando sesión ${sessionId}`);

      // 1. Detener listening
      await this.messageListener.stopListening(sessionId);

      // 2. Limpiar cola de mensajes
      this.messageSender.clearQueue(sessionId);

      // 3. Limpiar QR code
      this.qrHandler.clearQRCode(sessionId);

      // 4. Cerrar conexión
      await this.connectionManager.closeSession(sessionId);

      // 5. Actualizar session store (no eliminar, solo marcar como cerrada)
      await this.sessionStore.updateSession(sessionId, { status: 'closed' });

      logger.info(`✅ WhatsAppService: Sesión ${sessionId} cerrada`);

      this.emit('sessionClosed', {
        sessionId,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`❌ WhatsAppService: Error cerrando sesión ${sessionId}:`, error);
      throw error;
    }
  }

  // ==========================================
  // API PÚBLICA - MENSAJERÍA
  // ==========================================

  /**
   * Enviar mensaje (con cola)
   * @param {string} sessionId - ID de la sesión
   * @param {string} to - Número destinatario
   * @param {string} message - Mensaje a enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} ID del mensaje en cola
   */
  async sendMessage(sessionId, to, message, options = {}) {
    try {
      this._ensureInitialized();
      this._ensureRunning();

      const result = await this.messageSender.sendMessage(sessionId, to, message, options);
      
      // Actualizar estadísticas
      this.stats.totalMessagesSent++;

      // Registrar actividad en session store
      if (this.sessionStore.hasSession(sessionId)) {
        await this.sessionStore.recordActivity(sessionId, 'message_sent', {
          to,
          messageId: result.messageId
        });
      }

      return result;

    } catch (error) {
      this.stats.totalErrors++;
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
      this._ensureRunning();

      const result = await this.messageSender.sendImmediateMessage(sessionId, to, message, options);
      
      // Actualizar estadísticas
      this.stats.totalMessagesSent++;

      // Registrar actividad en session store
      if (this.sessionStore.hasSession(sessionId)) {
        await this.sessionStore.recordActivity(sessionId, 'message_sent', {
          to,
          immediate: true
        });
      }

      return result;

    } catch (error) {
      this.stats.totalErrors++;
      throw error;
    }
  }

  // ==========================================
  // API PÚBLICA - QR CODES
  // ==========================================

  /**
   * Obtener código QR de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {string} format - Formato del QR ('dataURL', 'buffer', 'base64', 'ascii')
   * @returns {Object|null} Datos del QR
   */
  getQRCode(sessionId, format = 'dataURL') {
    try {
      this._ensureInitialized();
      return this.qrHandler.getQRCode(sessionId, format);
    } catch (error) {
      logger.error(`❌ WhatsAppService: Error obteniendo QR para ${sessionId}:`, error);
      return null;
    }
  }

  // ==========================================
  // API PÚBLICA - ESTADÍSTICAS Y ESTADO
  // ==========================================

  /**
   * Obtener estadísticas generales del servicio
   * @returns {Object} Estadísticas completas
   */
  getStats() {
    try {
      this._ensureInitialized();

      const connectionStats = this.connectionManager.getStats();
      const senderStats = this.messageSender.getStats();
      const listenerStats = this.messageListener.getStats();
      const qrStats = this.qrHandler.getStats();
      const sessionStats = this.sessionStore.getStats();

      return {
        service: {
          isInitialized: this.isInitialized,
          isRunning: this.isRunning,
          startedAt: this.stats.startedAt,
          uptime: this.stats.startedAt ? Date.now() - this.stats.startedAt.getTime() : 0,
          ...this.stats
        },
        connections: connectionStats,
        messaging: senderStats,
        listening: listenerStats,
        qrCodes: qrStats,
        sessions: sessionStats
      };

    } catch (error) {
      logger.error('❌ WhatsAppService: Error obteniendo estadísticas:', error);
      return { error: error.message };
    }
  }

  /**
   * Verificar salud del servicio
   * @returns {Object} Estado de salud
   */
  getHealthCheck() {
    try {
      const stats = this.getStats();
      
      return {
        status: this.isRunning ? 'running' : 'stopped',
        initialized: this.isInitialized,
        modules: {
          connectionManager: !!this.connectionManager,
          sessionStore: !!this.sessionStore,
          qrHandler: !!this.qrHandler,
          messageSender: !!this.messageSender,
          messageListener: !!this.messageListener
        },
        activeSessions: stats.connections?.connectedSessions || 0,
        totalQueuedMessages: stats.messaging?.totalQueuedMessages || 0,
        activeListeners: stats.listening?.activeListeners || 0,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date()
      };
    }
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
      throw new Error('WhatsAppService no está inicializado');
    }
  }

  /**
   * Asegurar que está ejecutándose
   * @private
   */
  _ensureRunning() {
    if (!this.isRunning) {
      throw new Error('WhatsAppService no está ejecutándose');
    }
  }

  /**
   * Configurar eventos entre módulos
   * @private
   */
  _setupModuleEvents() {
    // Eventos del ConnectionManager
    this.connectionManager.on('qrCode', (data) => {
      this.qrHandler.processQRCode(data.sessionId, data);
      this.stats.totalQRsGenerated++;
    });

    this.connectionManager.on('messageReceived', (data) => {
      this.stats.totalMessagesReceived++;
      
      // Registrar actividad en session store
      if (this.sessionStore.hasSession(data.sessionId)) {
        this.sessionStore.recordActivity(data.sessionId, 'message_received', {
          from: data.message.from
        });
      }
    });

    // Eventos del MessageListener
    this.messageListener.on('autoResponseSent', (data) => {
      this.stats.totalMessagesSent++;
    });

    // Reenviar eventos importantes
    this.connectionManager.on('sessionConnected', (data) => this.emit('sessionConnected', data));
    this.connectionManager.on('sessionError', (data) => this.emit('sessionError', data));
    this.qrHandler.on('qrGenerated', (data) => this.emit('qrGenerated', data));
    this.messageSender.on('messageSent', (data) => this.emit('messageSent', data));
    this.messageListener.on('messageProcessed', (data) => this.emit('messageProcessed', data));
  }

  /**
   * Cleanup de módulos
   * @private
   */
  async _cleanupModules() {
    const modules = [
      { name: 'MessageListener', instance: this.messageListener },
      { name: 'MessageSender', instance: this.messageSender },
      { name: 'ConnectionManager', instance: this.connectionManager },
      { name: 'QRCodeHandler', instance: this.qrHandler },
      { name: 'SessionStore', instance: this.sessionStore }
    ];

    for (const module of modules) {
      try {
        if (module.instance && typeof module.instance.destroy === 'function') {
          await module.instance.destroy();
          logger.debug(`✅ ${module.name} destruido`);
        }
      } catch (error) {
        logger.error(`❌ Error destruyendo ${module.name}:`, error);
      }
    }

    // Limpiar referencias
    this.messageListener = null;
    this.messageSender = null;
    this.connectionManager = null;
    this.qrHandler = null;
    this.sessionStore = null;
  }
}

module.exports = WhatsAppService;