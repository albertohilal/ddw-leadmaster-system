/**
 * Manejador de Códigos QR para WhatsApp
 * Gestiona generación, almacenamiento y distribución de códigos QR
 */

const QRCode = require('qrcode');
const EventEmitter = require('events');
const logger = require('../../../core/logger');
const config = require('../../../core/config');

class QRCodeHandler extends EventEmitter {
  constructor() {
    super();
    
    // Cache de códigos QR por sesión: sessionId -> qrData
    this.qrCache = new Map();
    
    // Configuración
    this.config = {
      // Configuraciones de QR visual
      qrOptions: {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',    // Color del QR
          light: '#FFFFFF'    // Color del fondo
        },
        errorCorrectionLevel: 'M'
      },
      
      // Timeouts
      qrTimeout: parseInt(process.env.QR_TIMEOUT) || 120000, // 2 minutos
      maxAttempts: parseInt(process.env.QR_MAX_ATTEMPTS) || 5,
      
      // Limpieza automática
      cleanupInterval: parseInt(process.env.QR_CLEANUP_INTERVAL) || 300000, // 5 minutos
      maxAge: parseInt(process.env.QR_MAX_AGE) || 600000 // 10 minutos
    };

    this.isInitialized = false;
    this._setupCleanupTimer();
  }

  /**
   * Inicializar el manejador
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('⚠️ QRCodeHandler ya está inicializado');
      return;
    }

    try {
      logger.info('🚀 QRCodeHandler: Inicializando manejador de códigos QR...');
      
      this.isInitialized = true;
      
      logger.info('✅ QRCodeHandler: Manejador inicializado');
      
      this.emit('initialized');
      
    } catch (error) {
      logger.error('❌ QRCodeHandler: Error en inicialización:', error);
      throw error;
    }
  }

  /**
   * Procesar nuevo código QR
   * @param {string} sessionId - ID de la sesión
   * @param {Object} qrData - Datos del QR desde venom-bot
   * @returns {Promise<Object>} Datos procesados del QR
   */
  async processQRCode(sessionId, qrData) {
    try {
      this._ensureInitialized();
      
      logger.info(`📱 QRCodeHandler: Procesando QR para sesión ${sessionId} (intento ${qrData.attempts})`);

      // Validar datos de entrada
      if (!qrData.base64 && !qrData.url) {
        throw new Error('QR data debe contener base64 o url');
      }

      // Usar URL o base64 para el código QR
      const qrString = qrData.url || qrData.base64;

      // Generar imagen QR en diferentes formatos
      const qrImages = await this._generateQRImages(qrString);

      // Crear objeto completo de QR
      const processedQR = {
        sessionId,
        attempts: qrData.attempts,
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + this.config.qrTimeout),
        
        // Datos originales
        original: {
          base64: qrData.base64,
          ascii: qrData.ascii,
          url: qrData.url
        },
        
        // Imágenes generadas
        images: qrImages,
        
        // Estado
        status: 'active',
        scanned: false
      };

      // Almacenar en cache
      this.qrCache.set(sessionId, processedQR);

      logger.info(`✅ QRCodeHandler: QR procesado para sesión ${sessionId}`);

      // Emitir evento
      this.emit('qrGenerated', {
        sessionId,
        attempts: qrData.attempts,
        timestamp: processedQR.timestamp,
        expiresAt: processedQR.expiresAt
      });

      return processedQR;

    } catch (error) {
      logger.error(`❌ QRCodeHandler: Error procesando QR para ${sessionId}:`, error);
      
      this.emit('qrError', {
        sessionId,
        error: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }

  /**
   * Obtener código QR de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {string} format - Formato deseado ('dataURL', 'buffer', 'base64', 'ascii', 'original')
   * @returns {Object|null} Datos del QR en el formato solicitado
   */
  getQRCode(sessionId, format = 'dataURL') {
    try {
      this._ensureInitialized();
      
      const qrData = this.qrCache.get(sessionId);
      if (!qrData) {
        return null;
      }

      // Verificar si no ha expirado
      if (new Date() > qrData.expiresAt) {
        logger.warn(`⚠️ QRCodeHandler: QR de sesión ${sessionId} ha expirado`);
        this.qrCache.delete(sessionId);
        return null;
      }

      // Retornar según formato solicitado
      switch (format.toLowerCase()) {
        case 'dataurl':
        case 'data-url':
          return {
            sessionId,
            format: 'dataURL',
            data: qrData.images.dataURL,
            attempts: qrData.attempts,
            timestamp: qrData.timestamp,
            expiresAt: qrData.expiresAt
          };

        case 'buffer':
          return {
            sessionId,
            format: 'buffer',
            data: qrData.images.buffer,
            attempts: qrData.attempts,
            timestamp: qrData.timestamp,
            expiresAt: qrData.expiresAt
          };

        case 'base64':
          return {
            sessionId,
            format: 'base64',
            data: qrData.images.base64,
            attempts: qrData.attempts,
            timestamp: qrData.timestamp,
            expiresAt: qrData.expiresAt
          };

        case 'ascii':
          return {
            sessionId,
            format: 'ascii',
            data: qrData.original.ascii,
            attempts: qrData.attempts,
            timestamp: qrData.timestamp,
            expiresAt: qrData.expiresAt
          };

        case 'original':
          return {
            sessionId,
            format: 'original',
            data: qrData.original,
            attempts: qrData.attempts,
            timestamp: qrData.timestamp,
            expiresAt: qrData.expiresAt
          };

        case 'all':
          return {
            sessionId,
            format: 'all',
            data: {
              images: qrData.images,
              original: qrData.original
            },
            attempts: qrData.attempts,
            timestamp: qrData.timestamp,
            expiresAt: qrData.expiresAt
          };

        default:
          throw new Error(`Formato QR no soportado: ${format}`);
      }

    } catch (error) {
      logger.error(`❌ QRCodeHandler: Error obteniendo QR para ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Verificar si hay QR disponible para una sesión
   * @param {string} sessionId 
   * @returns {boolean} True si hay QR válido
   */
  hasQRCode(sessionId) {
    const qrData = this.qrCache.get(sessionId);
    if (!qrData) {
      return false;
    }

    // Verificar si no ha expirado
    if (new Date() > qrData.expiresAt) {
      this.qrCache.delete(sessionId);
      return false;
    }

    return true;
  }

  /**
   * Marcar QR como escaneado
   * @param {string} sessionId 
   * @returns {boolean} True si se marcó exitosamente
   */
  markQRScanned(sessionId) {
    try {
      const qrData = this.qrCache.get(sessionId);
      if (!qrData) {
        return false;
      }

      qrData.scanned = true;
      qrData.status = 'scanned';
      qrData.scannedAt = new Date();

      logger.info(`✅ QRCodeHandler: QR de sesión ${sessionId} marcado como escaneado`);

      this.emit('qrScanned', {
        sessionId,
        attempts: qrData.attempts,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      logger.error(`❌ QRCodeHandler: Error marcando QR escaneado para ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Limpiar QR de una sesión
   * @param {string} sessionId 
   * @returns {boolean} True si se limpió
   */
  clearQRCode(sessionId) {
    try {
      const existed = this.qrCache.has(sessionId);
      this.qrCache.delete(sessionId);

      if (existed) {
        logger.info(`🧹 QRCodeHandler: QR de sesión ${sessionId} eliminado`);
        
        this.emit('qrCleared', {
          sessionId,
          timestamp: new Date()
        });
      }

      return existed;

    } catch (error) {
      logger.error(`❌ QRCodeHandler: Error limpiando QR para ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Listar todas las sesiones con QR activo
   * @returns {Array} Lista de sesiones con QR
   */
  listActiveQRs() {
    this._ensureInitialized();
    
    const activeQRs = [];
    const now = new Date();

    for (const [sessionId, qrData] of this.qrCache) {
      // Solo incluir QRs no expirados
      if (now <= qrData.expiresAt) {
        activeQRs.push({
          sessionId,
          attempts: qrData.attempts,
          timestamp: qrData.timestamp,
          expiresAt: qrData.expiresAt,
          status: qrData.status,
          scanned: qrData.scanned,
          timeRemaining: qrData.expiresAt - now
        });
      } else {
        // Limpiar expirados
        this.qrCache.delete(sessionId);
      }
    }

    return activeQRs.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Obtener estadísticas de QR
   * @returns {Object} Estadísticas
   */
  getStats() {
    this._ensureInitialized();
    
    const activeQRs = this.listActiveQRs();
    
    return {
      totalActiveQRs: activeQRs.length,
      scannedQRs: activeQRs.filter(qr => qr.scanned).length,
      pendingQRs: activeQRs.filter(qr => !qr.scanned).length,
      averageAttempts: activeQRs.length > 0 
        ? activeQRs.reduce((sum, qr) => sum + qr.attempts, 0) / activeQRs.length 
        : 0,
      oldestQR: activeQRs.length > 0 ? activeQRs[activeQRs.length - 1] : null,
      newestQR: activeQRs.length > 0 ? activeQRs[0] : null
    };
  }

  /**
   * Limpiar QRs expirados
   * @returns {number} Número de QRs eliminados
   */
  cleanupExpiredQRs() {
    const before = this.qrCache.size;
    const now = new Date();
    const expiredSessions = [];

    for (const [sessionId, qrData] of this.qrCache) {
      if (now > qrData.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.qrCache.delete(sessionId);
    }

    const cleaned = expiredSessions.length;
    if (cleaned > 0) {
      logger.info(`🧹 QRCodeHandler: Eliminados ${cleaned} códigos QR expirados`);
      
      this.emit('qrCleanup', {
        cleanedCount: cleaned,
        timestamp: new Date()
      });
    }

    return cleaned;
  }

  /**
   * Destruir el manejador
   */
  async destroy() {
    logger.info('🧹 QRCodeHandler: Destruyendo manejador de códigos QR...');
    
    // Limpiar cache
    this.qrCache.clear();
    
    // Limpiar timer
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }
    
    // Remover listeners
    this.removeAllListeners();
    
    this.isInitialized = false;
    
    logger.info('✅ QRCodeHandler: Destrucción completada');
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
      throw new Error('QRCodeHandler no está inicializado');
    }
  }

  /**
   * Generar imágenes QR en diferentes formatos
   * @private
   */
  async _generateQRImages(qrString) {
    try {
      // Generar como data URL
      const dataURL = await QRCode.toDataURL(qrString, this.config.qrOptions);
      
      // Extraer base64 del data URL
      const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
      
      // Convertir a buffer
      const buffer = Buffer.from(base64Data, 'base64');

      return {
        dataURL,           // data:image/png;base64,iVBORw0KG...
        base64: base64Data, // iVBORw0KGgoAAAANSUhEUgAA...
        buffer             // Buffer binario
      };

    } catch (error) {
      logger.error('❌ QRCodeHandler: Error generando imágenes QR:', error);
      throw new Error(`Error generando QR: ${error.message}`);
    }
  }

  /**
   * Configurar timer de limpieza automática
   * @private
   */
  _setupCleanupTimer() {
    this._cleanupTimer = setInterval(() => {
      this.cleanupExpiredQRs();
    }, this.config.cleanupInterval);
  }
}

module.exports = QRCodeHandler;