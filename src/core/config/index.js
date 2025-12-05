/**
 * Configuración Central del Sistema
 */

require('dotenv').config();

const config = {
  // Servidor
  server: {
    port: process.env.PORT || 3010,
    env: process.env.NODE_ENV || 'development',
    host: process.env.HOST || 'localhost'
  },

  // Base de Datos
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7
  },

  // Google API
  google: {
    apiKey: process.env.GOOGLE_API_KEY
  },

  // WhatsApp Bot
  whatsapp: {
    responderActivo: process.env.BOT_RESPONDER_ACTIVO === 'true',
    hostEnv: process.env.HOST_ENV || 'local',
    sessionName: process.env.SESSION_NAME || 'whatsapp-bot-responder',
    sessionsPath: process.env.WHATSAPP_SESSIONS_PATH || './tokens',
    messageDelay: parseInt(process.env.MESSAGE_DELAY) || 3000,
    maxMessagesPerMinute: parseInt(process.env.MAX_MESSAGES_PER_MINUTE) || 20,
    // Configuración multicliente
    maxSessions: parseInt(process.env.WHATSAPP_MAX_SESSIONS) || 10,
    sessionTimeout: parseInt(process.env.WHATSAPP_SESSION_TIMEOUT) || 300000, // 5 minutos
    reconnectAttempts: parseInt(process.env.WHATSAPP_RECONNECT_ATTEMPTS) || 3,
    reconnectDelay: parseInt(process.env.WHATSAPP_RECONNECT_DELAY) || 30000 // 30 segundos
  },

  // Sesiones
  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000 // 24 horas
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3010',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },

  // Logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || '7d'
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Features Flags
  features: {
    multiSession: process.env.FEATURE_MULTI_SESSION !== 'false',
    aiResponses: process.env.FEATURE_AI_RESPONSES !== 'false',
    bulkSender: process.env.FEATURE_BULK_SENDER !== 'false',
    leadManagement: process.env.FEATURE_LEAD_MANAGEMENT !== 'false',
    autoStartWhatsApp: false // No iniciar WhatsApp automáticamente
  }
};

// Validar configuración crítica
function validateConfig() {
  const errors = [];

  if (!config.database.host) errors.push('DB_HOST no configurado');
  if (!config.database.user) errors.push('DB_USER no configurado');
  if (!config.database.password) errors.push('DB_PASSWORD no configurado');
  if (!config.database.database) errors.push('DB_NAME no configurado');
  
  if (config.features.aiResponses && !config.openai.apiKey) {
    errors.push('OPENAI_API_KEY no configurado pero FEATURE_AI_RESPONSES está activo');
  }

  if (!config.session.secret) {
    errors.push('SESSION_SECRET no configurado');
  }

  if (errors.length > 0) {
    console.warn('⚠️  Advertencias de configuración:');
    errors.forEach(err => console.warn(`   - ${err}`));
    console.warn('⚠️  El sistema puede tener funcionalidad limitada\n');
  }
}

validateConfig();

module.exports = config;
