/**
 * Adaptador para Venom Bot
 * Abstrae la funcionalidad de venom-bot para el sistema unificado
 */

const { create } = require('venom-bot');
const EventEmitter = require('events');
const logger = require('../../../core/logger');
const config = require('../../../core/config');

class VenomBotAdapter extends EventEmitter {
  constructor() {
    super();
    this.instances = new Map(); // sessionId -> { client, status, metadata }
    this.defaultOptions = this._getDefaultOptions();
  }

  /**
   * Crear una nueva instancia de WhatsApp
   * @param {string} sessionId - ID único de la sesión
   * @param {Object} options - Opciones personalizadas
   * @returns {Promise<Object>} Información de la conexión creada
   */
  async createInstance(sessionId, options = {}) {
    try {
      logger.info(`🚀 VenomBotAdapter: Creando instancia para sesión ${sessionId}`);

      if (this.instances.has(sessionId)) {
        throw new Error(`Sesión ${sessionId} ya existe`);
      }

      const instanceData = {
        client: null,
        status: 'initializing',
        qrCode: null,
        lastActivity: new Date(),
        attempts: 0,
        metadata: {
          sessionId,
          createdAt: new Date(),
          ...options
        }
      };

      this.instances.set(sessionId, instanceData);

      // Configuración combinada
      const venomOptions = this._buildVenomConfig(sessionId, options);

      // Crear instancia de Venom
      const client = await create(venomOptions);

      // Actualizar datos de la instancia
      instanceData.client = client;
      instanceData.status = 'connected';
      instanceData.lastActivity = new Date();

      logger.info(`✅ VenomBotAdapter: Instancia ${sessionId} creada exitosamente`);
      
      // Configurar eventos de la instancia
      this._setupInstanceEvents(sessionId, client);

      // Emitir evento de conexión exitosa
      this.emit('instanceConnected', {
        sessionId,
        status: 'connected',
        timestamp: new Date()
      });

      return {
        sessionId,
        client,
        status: 'connected',
        metadata: instanceData.metadata
      };

    } catch (error) {
      logger.error(`❌ VenomBotAdapter: Error creando instancia ${sessionId}:`, error);
      
      // Limpiar instancia fallida
      if (this.instances.has(sessionId)) {
        this.instances.delete(sessionId);
      }

      this.emit('instanceError', {
        sessionId,
        error: error.message,
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Obtener instancia existente
   * @param {string} sessionId 
   * @returns {Object|null} Datos de la instancia
   */
  getInstance(sessionId) {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return null;
    }

    return {
      sessionId,
      client: instance.client,
      status: instance.status,
      qrCode: instance.qrCode,
      lastActivity: instance.lastActivity,
      attempts: instance.attempts,
      metadata: instance.metadata
    };
  }

  /**
   * Obtener estado de una instancia
   * @param {string} sessionId 
   * @returns {string} Estado actual
   */
  getInstanceStatus(sessionId) {
    const instance = this.instances.get(sessionId);
    return instance ? instance.status : 'not_found';
  }

  /**
   * Cerrar instancia
   * @param {string} sessionId 
   */
  async closeInstance(sessionId) {
    try {
      logger.info(`🛑 VenomBotAdapter: Cerrando instancia ${sessionId}`);

      const instance = this.instances.get(sessionId);
      if (!instance) {
        logger.warn(`⚠️ VenomBotAdapter: Instancia ${sessionId} no encontrada`);
        return false;
      }

      // Cerrar cliente si existe
      if (instance.client) {
        try {
          await instance.client.close();
        } catch (error) {
          logger.warn(`⚠️ VenomBotAdapter: Error cerrando cliente ${sessionId}:`, error.message);
        }
      }

      // Remover de instancias
      this.instances.delete(sessionId);

      logger.info(`✅ VenomBotAdapter: Instancia ${sessionId} cerrada`);

      this.emit('instanceClosed', {
        sessionId,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`❌ VenomBotAdapter: Error cerrando instancia ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Listar todas las instancias
   * @returns {Array} Lista de instancias con su estado
   */
  listInstances() {
    return Array.from(this.instances.entries()).map(([sessionId, instance]) => ({
      sessionId,
      status: instance.status,
      lastActivity: instance.lastActivity,
      attempts: instance.attempts,
      hasClient: !!instance.client
    }));
  }

  /**
   * Enviar mensaje
   * @param {string} sessionId 
   * @param {string} number 
   * @param {string} message 
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendMessage(sessionId, number, message) {
    try {
      const instance = this.instances.get(sessionId);
      if (!instance || !instance.client) {
        throw new Error(`Instancia ${sessionId} no disponible`);
      }

      if (instance.status !== 'connected') {
        throw new Error(`Instancia ${sessionId} no está conectada (estado: ${instance.status})`);
      }

      // Formatear número
      const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;

      // Enviar mensaje
      const result = await instance.client.sendText(formattedNumber, message);

      // Actualizar actividad
      instance.lastActivity = new Date();

      logger.info(`📤 VenomBotAdapter: Mensaje enviado desde ${sessionId} a ${formattedNumber}`);

      return {
        success: true,
        sessionId,
        to: formattedNumber,
        message,
        result,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`❌ VenomBotAdapter: Error enviando mensaje desde ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Construir configuración para Venom
   * @private
   */
  _buildVenomConfig(sessionId, options) {
    const baseConfig = { ...this.defaultOptions };
    
    // Configurar sesión
    baseConfig.session = sessionId;

    // Callbacks para eventos
    baseConfig.catchQR = (base64Qr, asciiQR, attempts, urlCode) => {
      this._handleQRCode(sessionId, base64Qr, asciiQR, attempts, urlCode);
    };

    baseConfig.statusFind = (statusSession, sessionName) => {
      this._handleStatusFind(sessionId, statusSession);
    };

    // Mergear opciones personalizadas
    return { ...baseConfig, ...options };
  }

  /**
   * Configurar eventos de la instancia del cliente
   * @private
   */
  _setupInstanceEvents(sessionId, client) {
    // Mensaje recibido
    client.onMessage((message) => {
      this.emit('messageReceived', {
        sessionId,
        message,
        timestamp: new Date()
      });
    });

    // Estado de la conexión
    client.onStateChange((state) => {
      this._updateInstanceStatus(sessionId, state);
      this.emit('stateChange', {
        sessionId,
        state,
        timestamp: new Date()
      });
    });

    // Batería
    client.onBatteryChange((battery) => {
      this.emit('batteryChange', {
        sessionId,
        battery,
        timestamp: new Date()
      });
    });
  }

  /**
   * Manejar código QR
   * @private
   */
  _handleQRCode(sessionId, base64Qr, asciiQR, attempts, urlCode) {
    logger.info(`📱 VenomBotAdapter: QR Code para ${sessionId} (intento ${attempts})`);
    
    const instance = this.instances.get(sessionId);
    if (instance) {
      instance.qrCode = {
        base64: base64Qr,
        ascii: asciiQR,
        url: urlCode,
        attempts,
        timestamp: new Date()
      };
      instance.attempts = attempts;
      instance.status = 'qr_ready';
    }

    this.emit('qrCode', {
      sessionId,
      base64: base64Qr,
      ascii: asciiQR,
      url: urlCode,
      attempts,
      timestamp: new Date()
    });
  }

  /**
   * Manejar búsqueda de estado
   * @private
   */
  _handleStatusFind(sessionId, statusSession) {
    logger.info(`🔍 VenomBotAdapter: Estado para ${sessionId}: ${statusSession}`);
    
    this._updateInstanceStatus(sessionId, statusSession);

    this.emit('statusFind', {
      sessionId,
      status: statusSession,
      timestamp: new Date()
    });
  }

  /**
   * Actualizar estado de instancia
   * @private
   */
  _updateInstanceStatus(sessionId, status) {
    const instance = this.instances.get(sessionId);
    if (instance) {
      instance.status = status;
      instance.lastActivity = new Date();
    }
  }

  /**
   * Configuración por defecto de Venom
   * @private
   */
  _getDefaultOptions() {
    return {
      headless: config.server.env === 'production',
      useChrome: true,
      executablePath: '/usr/bin/google-chrome-stable',
      disableSpins: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: config.server.env === 'production'
      },
      // Timeouts
      timeout: 60000,
      autoClose: 60000,
      // Directorio de sesiones
      browserWSEndpoint: undefined,
      createPathFileToken: true
    };
  }

  /**
   * Cleanup al destruir el adaptador
   */
  async destroy() {
    logger.info('🧹 VenomBotAdapter: Cerrando todas las instancias...');
    
    const closePromises = Array.from(this.instances.keys()).map(sessionId => 
      this.closeInstance(sessionId).catch(error => 
        logger.error(`Error cerrando instancia ${sessionId}:`, error)
      )
    );

    await Promise.all(closePromises);
    
    this.removeAllListeners();
    
    logger.info('✅ VenomBotAdapter: Cleanup completado');
  }
}

module.exports = VenomBotAdapter;