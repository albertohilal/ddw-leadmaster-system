/**
 * Gestor de Conexiones WhatsApp Multicliente
 * Maneja múltiples sesiones WhatsApp simultáneas
 */

const EventEmitter = require('events');
const VenomBotAdapter = require('../adapters/VenomBotAdapter');
const logger = require('../../../core/logger');
const config = require('../../../core/config');

class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    
    // Adaptador principal (venom-bot)
    this.adapter = new VenomBotAdapter();
    
    // Mapa de conexiones: sessionId -> connectionData
    this.connections = new Map();
    
    // Estado global del manager
    this.isInitialized = false;
    
    // Configuración
    this.config = {
      maxSessions: config.whatsapp.maxSessions || 10,
      sessionTimeout: config.whatsapp.sessionTimeout || 300000, // 5 minutos
      reconnectAttempts: config.whatsapp.reconnectAttempts || 3,
      reconnectDelay: config.whatsapp.reconnectDelay || 30000, // 30 segundos
      sessionsPath: config.whatsapp.sessionsPath || './tokens'
    };

    this._setupAdapterListeners();
    this._startCleanupTimer();
  }

  /**
   * Inicializar el gestor de conexiones
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('⚠️ ConnectionManager ya está inicializado');
      return;
    }

    logger.info('🚀 ConnectionManager: Inicializando gestor de conexiones...');
    
    try {
      // Validar configuración
      this._validateConfig();
      
      // Marcar como inicializado
      this.isInitialized = true;
      
      logger.info('✅ ConnectionManager: Gestor inicializado correctamente');
      
      this.emit('initialized');
      
    } catch (error) {
      logger.error('❌ ConnectionManager: Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Crear una nueva sesión WhatsApp
   * @param {string} sessionId - ID único de la sesión (ej: 'haby', 'marketing', 'soporte')
   * @param {Object} options - Opciones de configuración
   * @returns {Promise<Object>} Información de la conexión creada
   */
  async createSession(sessionId, options = {}) {
    try {
      logger.info(`🔌 ConnectionManager: Creando sesión ${sessionId}`);

      // Validaciones previas
      this._ensureInitialized();
      this._validateSessionId(sessionId);
      this._checkSessionLimit();
      
      if (this.connections.has(sessionId)) {
        throw new Error(`Sesión ${sessionId} ya existe`);
      }

      // Crear datos de conexión
      const connectionData = {
        sessionId,
        status: 'creating',
        createdAt: new Date(),
        lastActivity: new Date(),
        reconnectAttempts: 0,
        metadata: {
          userAgent: options.userAgent || 'DDW-LeadMaster-Bot',
          description: options.description || `Sesión ${sessionId}`,
          tags: options.tags || [],
          ...options.metadata
        },
        client: null,
        qrCode: null,
        events: new EventEmitter()
      };

      // Registrar conexión
      this.connections.set(sessionId, connectionData);

      try {
        // Crear instancia en el adaptador
        const instanceData = await this.adapter.createInstance(sessionId, {
          ...options,
          // Configuraciones específicas por sesión
          session: sessionId,
          folderNameToken: `${this.config.sessionsPath}/${sessionId}`,
          headless: options.headless !== undefined ? options.headless : config.server.env === 'production'
        });

        // Actualizar datos de conexión
        connectionData.client = instanceData.client;
        connectionData.status = 'connected';
        connectionData.lastActivity = new Date();

        logger.info(`✅ ConnectionManager: Sesión ${sessionId} creada exitosamente`);

        // Emitir evento
        this.emit('sessionCreated', {
          sessionId,
          status: 'connected',
          timestamp: new Date(),
          metadata: connectionData.metadata
        });

        return {
          sessionId,
          status: 'connected',
          metadata: connectionData.metadata,
          createdAt: connectionData.createdAt
        };

      } catch (adapterError) {
        // Limpiar conexión fallida
        this.connections.delete(sessionId);
        throw adapterError;
      }

    } catch (error) {
      logger.error(`❌ ConnectionManager: Error creando sesión ${sessionId}:`, error);
      
      this.emit('sessionError', {
        sessionId,
        error: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Obtener información de una sesión
   * @param {string} sessionId 
   * @returns {Object|null} Datos de la sesión
   */
  getSession(sessionId) {
    const connection = this.connections.get(sessionId);
    if (!connection) {
      return null;
    }

    const instanceData = this.adapter.getInstance(sessionId);

    return {
      sessionId,
      status: connection.status,
      createdAt: connection.createdAt,
      lastActivity: connection.lastActivity,
      reconnectAttempts: connection.reconnectAttempts,
      metadata: connection.metadata,
      qrCode: instanceData?.qrCode || null,
      hasClient: !!connection.client
    };
  }

  /**
   * Obtener estado de una sesión
   * @param {string} sessionId 
   * @returns {string} Estado actual
   */
  getSessionStatus(sessionId) {
    const connection = this.connections.get(sessionId);
    if (!connection) {
      return 'not_found';
    }
    return connection.status;
  }

  /**
   * Listar todas las sesiones activas
   * @returns {Array} Lista de sesiones
   */
  listSessions() {
    return Array.from(this.connections.entries()).map(([sessionId, connection]) => ({
      sessionId,
      status: connection.status,
      createdAt: connection.createdAt,
      lastActivity: connection.lastActivity,
      reconnectAttempts: connection.reconnectAttempts,
      metadata: connection.metadata,
      hasClient: !!connection.client
    }));
  }

  /**
   * Obtener estadísticas generales
   * @returns {Object} Estadísticas del manager
   */
  getStats() {
    const sessions = this.listSessions();
    
    return {
      totalSessions: sessions.length,
      maxSessions: this.config.maxSessions,
      connectedSessions: sessions.filter(s => s.status === 'connected').length,
      disconnectedSessions: sessions.filter(s => s.status === 'disconnected').length,
      errorSessions: sessions.filter(s => s.status === 'error').length,
      qrPendingSessions: sessions.filter(s => s.status === 'qr_ready').length,
      uptime: this.isInitialized ? Date.now() - this._startTime : 0
    };
  }

  /**
   * Cerrar una sesión específica
   * @param {string} sessionId 
   * @returns {Promise<boolean>} True si se cerró exitosamente
   */
  async closeSession(sessionId) {
    try {
      logger.info(`🛑 ConnectionManager: Cerrando sesión ${sessionId}`);

      const connection = this.connections.get(sessionId);
      if (!connection) {
        logger.warn(`⚠️ ConnectionManager: Sesión ${sessionId} no encontrada`);
        return false;
      }

      // Actualizar estado
      connection.status = 'closing';

      // Cerrar en el adaptador
      await this.adapter.closeInstance(sessionId);

      // Remover conexión
      this.connections.delete(sessionId);

      logger.info(`✅ ConnectionManager: Sesión ${sessionId} cerrada`);

      this.emit('sessionClosed', {
        sessionId,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`❌ ConnectionManager: Error cerrando sesión ${sessionId}:`, error);
      
      // Marcar como error pero no eliminar por si se puede recuperar
      const connection = this.connections.get(sessionId);
      if (connection) {
        connection.status = 'error';
      }
      
      throw error;
    }
  }

  /**
   * Enviar mensaje desde una sesión específica
   * @param {string} sessionId 
   * @param {string} number 
   * @param {string} message 
   * @param {Object} options 
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendMessage(sessionId, number, message, options = {}) {
    try {
      // Validar sesión
      const connection = this.connections.get(sessionId);
      if (!connection) {
        throw new Error(`Sesión ${sessionId} no encontrada`);
      }

      if (connection.status !== 'connected') {
        throw new Error(`Sesión ${sessionId} no está conectada (estado: ${connection.status})`);
      }

      // Actualizar actividad
      connection.lastActivity = new Date();

      // Enviar a través del adaptador
      const result = await this.adapter.sendMessage(sessionId, number, message);

      // Emitir evento
      this.emit('messageSent', {
        sessionId,
        to: number,
        message,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      logger.error(`❌ ConnectionManager: Error enviando mensaje desde ${sessionId}:`, error);
      
      this.emit('messageError', {
        sessionId,
        to: number,
        error: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Obtener código QR de una sesión
   * @param {string} sessionId 
   * @returns {Object|null} Datos del QR
   */
  getQRCode(sessionId) {
    const instanceData = this.adapter.getInstance(sessionId);
    return instanceData?.qrCode || null;
  }

  /**
   * Reconectar una sesión
   * @param {string} sessionId 
   * @returns {Promise<boolean>} True si se reconectó
   */
  async reconnectSession(sessionId) {
    try {
      logger.info(`🔄 ConnectionManager: Reconectando sesión ${sessionId}`);

      const connection = this.connections.get(sessionId);
      if (!connection) {
        throw new Error(`Sesión ${sessionId} no encontrada`);
      }

      // Validar límite de intentos
      if (connection.reconnectAttempts >= this.config.reconnectAttempts) {
        throw new Error(`Máximo de intentos de reconexión alcanzado para ${sessionId}`);
      }

      connection.reconnectAttempts++;
      connection.status = 'reconnecting';

      // Cerrar instancia actual si existe
      try {
        await this.adapter.closeInstance(sessionId);
      } catch (closeError) {
        logger.warn(`⚠️ Error cerrando instancia anterior de ${sessionId}:`, closeError.message);
      }

      // Esperar antes de reconectar
      await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay));

      // Crear nueva instancia
      const instanceData = await this.adapter.createInstance(sessionId, connection.metadata);

      // Actualizar conexión
      connection.client = instanceData.client;
      connection.status = 'connected';
      connection.lastActivity = new Date();

      logger.info(`✅ ConnectionManager: Sesión ${sessionId} reconectada (intento ${connection.reconnectAttempts})`);

      this.emit('sessionReconnected', {
        sessionId,
        attempts: connection.reconnectAttempts,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`❌ ConnectionManager: Error reconectando sesión ${sessionId}:`, error);
      
      const connection = this.connections.get(sessionId);
      if (connection) {
        connection.status = 'error';
      }
      
      this.emit('sessionReconnectFailed', {
        sessionId,
        error: error.message,
        attempts: connection?.reconnectAttempts || 0,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Cerrar todas las sesiones
   */
  async closeAllSessions() {
    logger.info('🛑 ConnectionManager: Cerrando todas las sesiones...');
    
    const sessionIds = Array.from(this.connections.keys());
    const closePromises = sessionIds.map(sessionId => 
      this.closeSession(sessionId).catch(error => 
        logger.error(`Error cerrando sesión ${sessionId}:`, error)
      )
    );

    await Promise.all(closePromises);
    
    logger.info('✅ ConnectionManager: Todas las sesiones cerradas');
  }

  /**
   * Destruir el gestor (cleanup completo)
   */
  async destroy() {
    logger.info('🧹 ConnectionManager: Iniciando destrucción...');
    
    // Cerrar todas las sesiones
    await this.closeAllSessions();
    
    // Destruir adaptador
    await this.adapter.destroy();
    
    // Limpiar timers
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }
    
    // Remover listeners
    this.removeAllListeners();
    
    // Marcar como no inicializado
    this.isInitialized = false;
    
    logger.info('✅ ConnectionManager: Destrucción completada');
  }

  // ==========================================
  // MÉTODOS PRIVADOS
  // ==========================================

  /**
   * Configurar listeners del adaptador
   * @private
   */
  _setupAdapterListeners() {
    this.adapter.on('qrCode', (data) => {
      this.emit('qrCode', data);
      
      const connection = this.connections.get(data.sessionId);
      if (connection) {
        connection.qrCode = data;
        connection.status = 'qr_ready';
        connection.lastActivity = new Date();
      }
    });

    this.adapter.on('instanceConnected', (data) => {
      this.emit('sessionConnected', data);
      
      const connection = this.connections.get(data.sessionId);
      if (connection) {
        connection.status = 'connected';
        connection.lastActivity = new Date();
        connection.reconnectAttempts = 0; // Reset intentos al conectar
      }
    });

    this.adapter.on('instanceError', (data) => {
      this.emit('sessionError', data);
      
      const connection = this.connections.get(data.sessionId);
      if (connection) {
        connection.status = 'error';
      }
    });

    this.adapter.on('messageReceived', (data) => {
      this.emit('messageReceived', data);
      
      const connection = this.connections.get(data.sessionId);
      if (connection) {
        connection.lastActivity = new Date();
      }
    });

    this.adapter.on('stateChange', (data) => {
      this.emit('stateChange', data);
      
      const connection = this.connections.get(data.sessionId);
      if (connection) {
        connection.lastActivity = new Date();
      }
    });
  }

  /**
   * Timer de limpieza automática
   * @private
   */
  _startCleanupTimer() {
    this._startTime = Date.now();
    
    this._cleanupTimer = setInterval(() => {
      this._performCleanup();
    }, 60000); // Cada minuto
  }

  /**
   * Realizar limpieza de sesiones inactivas
   * @private
   */
  _performCleanup() {
    const now = Date.now();
    const sessionsToCleanup = [];

    for (const [sessionId, connection] of this.connections) {
      const inactiveTime = now - connection.lastActivity.getTime();
      
      if (inactiveTime > this.config.sessionTimeout && connection.status === 'error') {
        sessionsToCleanup.push(sessionId);
      }
    }

    if (sessionsToCleanup.length > 0) {
      logger.info(`🧹 ConnectionManager: Limpiando ${sessionsToCleanup.length} sesiones inactivas`);
      
      sessionsToCleanup.forEach(sessionId => {
        this.closeSession(sessionId).catch(error => 
          logger.error(`Error limpiando sesión ${sessionId}:`, error)
        );
      });
    }
  }

  /**
   * Validaciones
   * @private
   */
  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('ConnectionManager no está inicializado');
    }
  }

  _validateSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('SessionId debe ser un string no vacío');
    }
    
    if (sessionId.length > 50) {
      throw new Error('SessionId no puede tener más de 50 caracteres');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      throw new Error('SessionId solo puede contener letras, números, guiones y guiones bajos');
    }
  }

  _checkSessionLimit() {
    if (this.connections.size >= this.config.maxSessions) {
      throw new Error(`Límite máximo de sesiones alcanzado (${this.config.maxSessions})`);
    }
  }

  _validateConfig() {
    if (!this.config.sessionsPath) {
      throw new Error('Configuración: sessionsPath es requerido');
    }
    
    if (this.config.maxSessions <= 0) {
      throw new Error('Configuración: maxSessions debe ser mayor a 0');
    }
  }
}

module.exports = ConnectionManager;