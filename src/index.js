/**
 * DDW LeadMaster System
 * Entry Point de la Aplicación
 * 
 * Sistema unificado de gestión de leads con WhatsApp,
 * curación de datos y respuestas automáticas con IA
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');

// Core
const config = require('./core/config');
const logger = require('./core/logger');
const database = require('./core/database/connection');

// Middleware
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Routes
const apiRoutes = require('./routes');
const initializeWhatsAppRoutes = require('./routes/whatsapp');

// Services
const WhatsAppService = require('./modules/whatsapp/WhatsAppService');

// Initialize Express App
const app = express();
const PORT = config.server.port || 3010;

// Global service instances
let whatsAppService = null;

// ==========================================
// MIDDLEWARE SETUP
// ==========================================

// Security
app.use(helmet());

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials
}));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.server.env !== 'test') {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Rate Limiting
app.use('/api/', rateLimiter.apiLimiter);

// Static Files
app.use(express.static('src/public'));

// ==========================================
// ROUTES
// ==========================================

// Montar rutas base de la API
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.env,
    version: require('../package.json').version
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'DDW LeadMaster System',
    version: require('../package.json').version,
    description: 'Sistema unificado de gestión de leads con WhatsApp, curación de datos y respuestas automáticas con IA',
    endpoints: {
      health: '/health',
      api: '/api',
      admin: '/admin',
      docs: '/api/docs'
    }
  });
});

// ==========================================
// STARTUP
// ==========================================

async function startServer() {
  try {
    // 1. Verificar conexión a base de datos
    logger.info('🔌 Conectando a base de datos...');
    await database.testConnection();
    logger.info('✅ Base de datos conectada');

    // 2. Inicializar servicios
    logger.info('🚀 Inicializando servicios...');
    
    // WhatsApp Service
    logger.info('📱 Inicializando servicio WhatsApp...');
    whatsAppService = new WhatsAppService(database);
    await whatsAppService.initialize();
    
    if (config.features.autoStartWhatsApp) {
      await whatsAppService.start();
      logger.info('✅ WhatsApp servicio iniciado automáticamente');
    } else {
      logger.info('✅ WhatsApp servicio inicializado (no iniciado)');
    }

    // 3. Configurar rutas WhatsApp con servicios
    logger.info('🛣️ Configurando rutas WhatsApp...');
    const whatsappRoutes = initializeWhatsAppRoutes(whatsAppService);
    app.use('/api/whatsapp', whatsappRoutes);
    logger.info('✅ Rutas WhatsApp montadas en /api/whatsapp');

    // 4. Registrar manejadores de error DESPUÉS de montar todas las rutas
    //    para evitar que el catch-all 404 bloquee las rutas dinámicas
    app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });
    });

    app.use(errorHandler);

    // 5. Iniciar servidor HTTP
    const server = app.listen(PORT, () => {
      logger.info('='.repeat(50));
      logger.info(`🚀 DDW LeadMaster System`);
      logger.info(`📡 Servidor corriendo en http://localhost:${PORT}`);
      logger.info(`🌍 Entorno: ${config.server.env}`);
      logger.info(`📝 Versión: ${require('../package.json').version}`);
      logger.info('='.repeat(50));
    });

    // Graceful Shutdown
    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));

  } catch (error) {
    logger.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(server) {
  logger.info('🛑 Iniciando apagado graceful...');

  // Cerrar servidor HTTP
  server.close(() => {
    logger.info('✅ Servidor HTTP cerrado');
  });

  try {
    // Cerrar servicios WhatsApp
    if (whatsAppService) {
      logger.info('📱 Cerrando servicios WhatsApp...');
      await whatsAppService.destroy();
      logger.info('✅ Servicios WhatsApp cerrados');
    }

    // Cerrar conexión a BD
    logger.info('🔌 Cerrando conexión a base de datos...');
    await database.closeConnection();
    logger.info('✅ Conexión a BD cerrada');

    logger.info('👋 Sistema apagado correctamente');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error durante apagado:', error);
    process.exit(1);
  }
}

// Handle Uncaught Exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ==========================================
// START
// ==========================================

if (require.main === module) {
  startServer();
}

module.exports = app;
