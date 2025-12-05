/**
 * Router Principal de la API
 */

const express = require('express');
const router = express.Router();

// Health check interno
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Info de la API
router.get('/', (req, res) => {
  res.json({
    name: 'DDW LeadMaster API',
    version: '1.0.0',
    description: 'Sistema unificado de gestión de leads con WhatsApp multicliente',
    endpoints: {
      health: '/api/health',
      whatsapp: '/api/whatsapp',
      leads: '/api/leads',
      campaigns: '/api/campaigns',
      admin: '/api/admin'
    },
    features: {
      whatsapp: {
        multiSession: true,
        maxSessions: 10,
        qrCodeGeneration: true,
        messageQueue: true,
        autoResponder: true
      }
    }
  });
});

// Exportar directamente el router
module.exports = router;
