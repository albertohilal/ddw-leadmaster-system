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
    endpoints: {
      health: '/api/health',
      whatsapp: '/api/whatsapp',
      leads: '/api/leads',
      campaigns: '/api/campaigns',
      admin: '/api/admin'
    }
  });
});

// TODO: Agregar más rutas
// router.use('/auth', require('./auth.routes'));
// router.use('/whatsapp', require('./whatsapp.routes'));
// router.use('/leads', require('./leads.routes'));
// router.use('/campaigns', require('./campaigns.routes'));
// router.use('/admin', require('./admin.routes'));

module.exports = router;
