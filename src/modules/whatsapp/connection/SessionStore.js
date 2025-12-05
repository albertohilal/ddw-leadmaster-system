/**
 * Almacenamiento y Gestión de Sesiones WhatsApp
 * Maneja persistencia, metadata y validación de sesiones multicliente
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const logger = require('../../../core/logger');
const config = require('../../../core/config');

class SessionStore extends EventEmitter {
  constructor() {
    super();
    
    this.sessionsPath = config.whatsapp.sessionsPath || './tokens';
    this.metadataPath = path.join(this.sessionsPath, '_metadata');
    
    // Cache en memoria de las sesiones
    this.sessionsCache = new Map();
    
    // Estado del store
    this.isInitialized = false;
  }

  /**
   * Inicializar el store
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('⚠️ SessionStore ya está inicializado');
      return;
    }

    try {
      logger.info('🚀 SessionStore: Inicializando almacén de sesiones...');
      
      // Crear directorios necesarios
      await this._ensureDirectories();
      
      // Cargar sesiones existentes
      await this._loadExistingSessions();
      
      // Validar integridad
      await this._validateSessions();
      
      this.isInitialized = true;
      
      logger.info(`✅ SessionStore: Inicializado con ${this.sessionsCache.size} sesiones`);
      
      this.emit('initialized', {
        sessionsCount: this.sessionsCache.size,
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error('❌ SessionStore: Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Crear una nueva sesión
   * @param {string} sessionId - ID de la sesión
   * @param {Object} metadata - Metadatos de la sesión
   * @returns {Promise<Object>} Información de la sesión creada
   */
  async createSession(sessionId, metadata = {}) {
    try {
      this._ensureInitialized();
      this._validateSessionId(sessionId);

      if (this.sessionsCache.has(sessionId)) {
        throw new Error(`Sesión ${sessionId} ya existe`);
      }

      logger.info(`📝 SessionStore: Creando sesión ${sessionId}`);

      const sessionData = {
        sessionId,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        status: 'created',
        metadata: {
          description: `Sesión ${sessionId}`,
          tags: [],
          userAgent: 'DDW-LeadMaster-Bot',
          ...metadata
        },
        stats: {
          totalMessages: 0,
          totalMessagesSent: 0,
          totalMessagesReceived: 0,
          lastMessageAt: null,
          connectionAttempts: 0,
          successfulConnections: 0
        },
        paths: {
          sessionDir: path.join(this.sessionsPath, sessionId),
          metadataFile: path.join(this.metadataPath, `${sessionId}.json`)
        }
      };

      // Crear directorio de sesión
      await this._ensureSessionDirectory(sessionId);

      // Guardar en cache y disco
      this.sessionsCache.set(sessionId, sessionData);
      await this._saveSessionMetadata(sessionId, sessionData);

      logger.info(`✅ SessionStore: Sesión ${sessionId} creada`);

      this.emit('sessionCreated', {
        sessionId,
        metadata: sessionData.metadata,
        timestamp: new Date()
      });

      return sessionData;

    } catch (error) {
      logger.error(`❌ SessionStore: Error creando sesión ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Obtener datos de una sesión
   * @param {string} sessionId 
   * @returns {Object|null} Datos de la sesión
   */
  getSession(sessionId) {
    this._ensureInitialized();
    
    const sessionData = this.sessionsCache.get(sessionId);
    if (!sessionData) {
      return null;
    }

    // Clonar para evitar mutaciones
    return JSON.parse(JSON.stringify(sessionData));
  }

  /**
   * Verificar si existe una sesión
   * @param {string} sessionId 
   * @returns {boolean} True si existe
   */
  hasSession(sessionId) {
    this._ensureInitialized();
    return this.sessionsCache.has(sessionId);
  }

  /**
   * Listar todas las sesiones
   * @returns {Array} Lista de sesiones
   */
  listSessions() {
    this._ensureInitialized();
    
    return Array.from(this.sessionsCache.values()).map(session => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      status: session.status,
      metadata: session.metadata,
      stats: session.stats
    }));
  }

  /**
   * Actualizar sesión
   * @param {string} sessionId 
   * @param {Object} updates - Datos a actualizar
   * @returns {Promise<Object>} Sesión actualizada
   */
  async updateSession(sessionId, updates = {}) {
    try {
      this._ensureInitialized();
      
      const sessionData = this.sessionsCache.get(sessionId);
      if (!sessionData) {
        throw new Error(`Sesión ${sessionId} no encontrada`);
      }

      // Actualizar datos
      if (updates.status) sessionData.status = updates.status;
      if (updates.metadata) {
        sessionData.metadata = { ...sessionData.metadata, ...updates.metadata };
      }
      if (updates.stats) {
        sessionData.stats = { ...sessionData.stats, ...updates.stats };
      }
      
      sessionData.lastUsed = new Date().toISOString();

      // Guardar en disco
      await this._saveSessionMetadata(sessionId, sessionData);

      logger.debug(`📝 SessionStore: Sesión ${sessionId} actualizada`);

      this.emit('sessionUpdated', {
        sessionId,
        updates,
        timestamp: new Date()
      });

      return this.getSession(sessionId);

    } catch (error) {
      logger.error(`❌ SessionStore: Error actualizando sesión ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Marcar actividad en sesión
   * @param {string} sessionId 
   * @param {string} activityType - Tipo de actividad ('message_sent', 'message_received', 'connection', etc.)
   * @param {Object} data - Datos adicionales
   */
  async recordActivity(sessionId, activityType, data = {}) {
    try {
      const sessionData = this.sessionsCache.get(sessionId);
      if (!sessionData) {
        logger.warn(`⚠️ SessionStore: Sesión ${sessionId} no encontrada para actividad ${activityType}`);
        return;
      }

      const now = new Date().toISOString();
      sessionData.lastUsed = now;

      // Actualizar estadísticas según tipo de actividad
      switch (activityType) {
        case 'message_sent':
          sessionData.stats.totalMessages++;
          sessionData.stats.totalMessagesSent++;
          sessionData.stats.lastMessageAt = now;
          break;
          
        case 'message_received':
          sessionData.stats.totalMessages++;
          sessionData.stats.totalMessagesReceived++;
          sessionData.stats.lastMessageAt = now;
          break;
          
        case 'connection_attempt':
          sessionData.stats.connectionAttempts++;
          break;
          
        case 'connection_success':
          sessionData.stats.successfulConnections++;
          sessionData.status = 'connected';
          break;
          
        case 'disconnection':
          sessionData.status = 'disconnected';
          break;
          
        case 'error':
          sessionData.status = 'error';
          break;
      }

      // Guardar cada cierto número de actividades para no sobrecargar disco
      if (sessionData.stats.totalMessages % 10 === 0 || activityType.includes('connection')) {
        await this._saveSessionMetadata(sessionId, sessionData);
      }

      this.emit('activityRecorded', {
        sessionId,
        activityType,
        data,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error(`❌ SessionStore: Error registrando actividad ${activityType} para ${sessionId}:`, error);
    }
  }

  /**
   * Eliminar sesión
   * @param {string} sessionId 
   * @param {boolean} deleteFiles - Si eliminar archivos de disco
   * @returns {Promise<boolean>} True si se eliminó
   */
  async deleteSession(sessionId, deleteFiles = false) {
    try {
      this._ensureInitialized();
      
      const sessionData = this.sessionsCache.get(sessionId);
      if (!sessionData) {
        logger.warn(`⚠️ SessionStore: Sesión ${sessionId} no encontrada para eliminar`);
        return false;
      }

      logger.info(`🗑️ SessionStore: Eliminando sesión ${sessionId} (deleteFiles: ${deleteFiles})`);

      // Remover de cache
      this.sessionsCache.delete(sessionId);

      if (deleteFiles) {
        try {
          // Eliminar directorio de sesión
          await this._deleteSessionDirectory(sessionId);
          
          // Eliminar archivo de metadata
          await this._deleteSessionMetadata(sessionId);
          
        } catch (fileError) {
          logger.warn(`⚠️ SessionStore: Error eliminando archivos de ${sessionId}:`, fileError.message);
        }
      }

      logger.info(`✅ SessionStore: Sesión ${sessionId} eliminada`);

      this.emit('sessionDeleted', {
        sessionId,
        deleteFiles,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`❌ SessionStore: Error eliminando sesión ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Limpiar sesiones inactivas
   * @param {number} maxInactiveHours - Horas de inactividad máxima
   * @returns {Promise<Array>} Lista de sesiones eliminadas
   */
  async cleanupInactiveSessions(maxInactiveHours = 24) {
    try {
      this._ensureInitialized();
      
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - maxInactiveHours);
      
      const sessionsToDelete = [];
      
      for (const [sessionId, sessionData] of this.sessionsCache) {
        const lastUsed = new Date(sessionData.lastUsed);
        
        if (lastUsed < cutoffTime && sessionData.status !== 'connected') {
          sessionsToDelete.push(sessionId);
        }
      }

      logger.info(`🧹 SessionStore: Limpiando ${sessionsToDelete.length} sesiones inactivas (>${maxInactiveHours}h)`);

      const deletedSessions = [];
      for (const sessionId of sessionsToDelete) {
        try {
          await this.deleteSession(sessionId, true);
          deletedSessions.push(sessionId);
        } catch (error) {
          logger.error(`Error eliminando sesión inactiva ${sessionId}:`, error.message);
        }
      }

      this.emit('cleanupCompleted', {
        sessionsDeleted: deletedSessions,
        maxInactiveHours,
        timestamp: new Date()
      });

      return deletedSessions;

    } catch (error) {
      logger.error('❌ SessionStore: Error en cleanup de sesiones:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas generales
   * @returns {Object} Estadísticas del store
   */
  getStats() {
    this._ensureInitialized();
    
    const sessions = this.listSessions();
    const now = new Date();
    
    return {
      totalSessions: sessions.length,
      connectedSessions: sessions.filter(s => s.status === 'connected').length,
      disconnectedSessions: sessions.filter(s => s.status === 'disconnected').length,
      errorSessions: sessions.filter(s => s.status === 'error').length,
      totalMessages: sessions.reduce((sum, s) => sum + s.stats.totalMessages, 0),
      totalMessagesSent: sessions.reduce((sum, s) => sum + s.stats.totalMessagesSent, 0),
      totalMessagesReceived: sessions.reduce((sum, s) => sum + s.stats.totalMessagesReceived, 0),
      averageMessagesPerSession: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + s.stats.totalMessages, 0) / sessions.length) 
        : 0,
      oldestSession: sessions.reduce((oldest, s) => {
        return !oldest || new Date(s.createdAt) < new Date(oldest.createdAt) ? s : oldest;
      }, null),
      newestSession: sessions.reduce((newest, s) => {
        return !newest || new Date(s.createdAt) > new Date(newest.createdAt) ? s : newest;
      }, null)
    };
  }

  /**
   * Destruir el store
   */
  async destroy() {
    logger.info('🧹 SessionStore: Destruyendo almacén de sesiones...');
    
    // Guardar todas las sesiones pendientes
    const savePromises = Array.from(this.sessionsCache.entries()).map(([sessionId, sessionData]) => 
      this._saveSessionMetadata(sessionId, sessionData).catch(error => 
        logger.error(`Error guardando sesión ${sessionId}:`, error)
      )
    );
    
    await Promise.all(savePromises);
    
    // Limpiar cache
    this.sessionsCache.clear();
    
    // Remover listeners
    this.removeAllListeners();
    
    this.isInitialized = false;
    
    logger.info('✅ SessionStore: Destrucción completada');
  }

  // ==========================================
  // MÉTODOS PRIVADOS
  // ==========================================

  /**
   * Asegurar que el store está inicializado
   * @private
   */
  _ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('SessionStore no está inicializado');
    }
  }

  /**
   * Validar ID de sesión
   * @private
   */
  _validateSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('SessionId debe ser un string no vacío');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      throw new Error('SessionId solo puede contener letras, números, guiones y guiones bajos');
    }
  }

  /**
   * Asegurar directorios necesarios
   * @private
   */
  async _ensureDirectories() {
    await fs.mkdir(this.sessionsPath, { recursive: true });
    await fs.mkdir(this.metadataPath, { recursive: true });
  }

  /**
   * Asegurar directorio de sesión específica
   * @private
   */
  async _ensureSessionDirectory(sessionId) {
    const sessionDir = path.join(this.sessionsPath, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
  }

  /**
   * Cargar sesiones existentes desde disco
   * @private
   */
  async _loadExistingSessions() {
    try {
      const metadataFiles = await fs.readdir(this.metadataPath);
      const jsonFiles = metadataFiles.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const sessionId = path.basename(file, '.json');
          const filePath = path.join(this.metadataPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const sessionData = JSON.parse(content);
          
          this.sessionsCache.set(sessionId, sessionData);
          
        } catch (error) {
          logger.warn(`⚠️ SessionStore: Error cargando sesión desde ${file}:`, error.message);
        }
      }

    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('❌ SessionStore: Error cargando sesiones existentes:', error);
      }
    }
  }

  /**
   * Validar integridad de sesiones cargadas
   * @private
   */
  async _validateSessions() {
    const invalidSessions = [];

    for (const [sessionId, sessionData] of this.sessionsCache) {
      try {
        // Validar estructura básica
        if (!sessionData.sessionId || !sessionData.createdAt) {
          throw new Error('Estructura de sesión inválida');
        }

        // Validar que el directorio de sesión existe
        const sessionDir = path.join(this.sessionsPath, sessionId);
        await fs.access(sessionDir);

      } catch (error) {
        logger.warn(`⚠️ SessionStore: Sesión ${sessionId} inválida: ${error.message}`);
        invalidSessions.push(sessionId);
      }
    }

    // Remover sesiones inválidas
    for (const sessionId of invalidSessions) {
      this.sessionsCache.delete(sessionId);
    }

    if (invalidSessions.length > 0) {
      logger.info(`🧹 SessionStore: Removidas ${invalidSessions.length} sesiones inválidas`);
    }
  }

  /**
   * Guardar metadata de sesión en disco
   * @private
   */
  async _saveSessionMetadata(sessionId, sessionData) {
    const filePath = path.join(this.metadataPath, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf8');
  }

  /**
   * Eliminar archivo de metadata
   * @private
   */
  async _deleteSessionMetadata(sessionId) {
    const filePath = path.join(this.metadataPath, `${sessionId}.json`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Eliminar directorio completo de sesión
   * @private
   */
  async _deleteSessionDirectory(sessionId) {
    const sessionDir = path.join(this.sessionsPath, sessionId);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

module.exports = SessionStore;