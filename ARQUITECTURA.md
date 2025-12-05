# 🏗️ Estructura del Proyecto DDW LeadMaster System

**Fecha:** 5 de diciembre de 2025  
**Versión:** 1.0.0

---

## 📂 Estructura de Carpetas

```
ddw-leadmaster-system/
├── 📚 _legacy-massive-sender/        # Referencia legacy (ignorado en git)
├── 📚 _legacy-bot-responder/         # Referencia legacy (ignorado en git)
├── 📚 _legacy-ddw-api/               # Referencia legacy (ignorado en git)
│
├── 📦 src/                           # 🆕 CÓDIGO NUEVO
│   │
│   ├── 🔧 core/                      # Núcleo del sistema
│   │   ├── config/                   # Configuración centralizada
│   │   │   ├── index.js              # Config principal
│   │   │   ├── database.js           # Config BD
│   │   │   ├── redis.js              # Config Redis
│   │   │   └── whatsapp.js           # Config WhatsApp
│   │   │
│   │   ├── database/                 # Gestión base de datos
│   │   │   ├── connection.js         # Pool MySQL
│   │   │   ├── migrations/           # Migraciones SQL
│   │   │   └── seeds/                # Datos iniciales
│   │   │
│   │   └── logger/                   # Sistema de logs
│   │       ├── index.js              # Logger Winston
│   │       └── transports.js         # Transports personalizados
│   │
│   ├── 📦 modules/                   # Módulos principales
│   │   │
│   │   ├── whatsapp/                 # ⭐ MÓDULO WHATSAPP (Arquitectura propuesta)
│   │   │   │
│   │   │   ├── connection/           # 🔌 Gestión de conexiones
│   │   │   │   ├── ConnectionManager.js    # Gestor principal
│   │   │   │   ├── SessionStore.js         # Store de sesiones
│   │   │   │   ├── QRCodeHandler.js        # Manejo de QR
│   │   │   │   └── AuthHandler.js          # Autenticación WhatsApp
│   │   │   │
│   │   │   ├── sender/               # ✉️ Envío de mensajes
│   │   │   │   ├── MessageSender.js        # Envío individual
│   │   │   │   ├── BulkSender.js           # Envío masivo
│   │   │   │   ├── MessageQueue.js         # Cola de mensajes
│   │   │   │   └── RateLimiter.js          # Control de velocidad
│   │   │   │
│   │   │   ├── listener/             # 👂 Escucha de mensajes
│   │   │   │   ├── MessageListener.js      # Listener principal
│   │   │   │   ├── EventHandler.js         # Manejo de eventos
│   │   │   │   ├── CommandParser.js        # Parser de comandos
│   │   │   │   └── ResponseHandler.js      # Respuestas automáticas
│   │   │   │
│   │   │   ├── adapters/             # 🔌 Adaptadores de librerías
│   │   │   │   ├── VenomBotAdapter.js      # Adaptador venom-bot
│   │   │   │   └── WhatsAppWebAdapter.js   # Adaptador whatsapp-web.js (deprecado)
│   │   │   │
│   │   │   └── WhatsAppService.js    # 🎛️ Fachada unificada (Singleton)
│   │   │
│   │   ├── leads/                    # 📊 Gestión de leads
│   │   │   ├── LeadService.js        # Lógica de negocio
│   │   │   ├── LeadRepository.js     # Acceso a datos
│   │   │   ├── LeadValidator.js      # Validación de datos
│   │   │   └── LeadCurator.js        # Curación de datos
│   │   │
│   │   ├── campaigns/                # 📤 Campañas de envío
│   │   │   ├── CampaignService.js    # Lógica de campañas
│   │   │   ├── CampaignRepository.js # Acceso a datos
│   │   │   ├── CampaignScheduler.js  # Programación de envíos
│   │   │   └── CampaignAnalytics.js  # Métricas y estadísticas
│   │   │
│   │   └── ai/                       # 🤖 Inteligencia Artificial
│   │       ├── OpenAIService.js      # Integración OpenAI
│   │       ├── ContextManager.js     # Gestión de contexto
│   │       ├── ResponseGenerator.js  # Generación de respuestas
│   │       └── MessageAnalyzer.js    # Análisis de mensajes
│   │
│   ├── 🛣️ routes/                    # Rutas Express
│   │   ├── index.js                  # Router principal
│   │   ├── auth.routes.js            # Autenticación
│   │   ├── whatsapp.routes.js        # Endpoints WhatsApp
│   │   ├── leads.routes.js           # Endpoints leads
│   │   ├── campaigns.routes.js       # Endpoints campañas
│   │   ├── admin.routes.js           # Panel admin
│   │   └── client.routes.js          # Panel clientes
│   │
│   ├── 🛡️ middleware/                # Middlewares Express
│   │   ├── auth.js                   # Autenticación JWT/Session
│   │   ├── rateLimiter.js            # Rate limiting
│   │   ├── errorHandler.js           # Manejo de errores
│   │   ├── validator.js              # Validación de datos
│   │   └── cors.js                   # Configuración CORS
│   │
│   ├── 🔧 services/                  # Servicios de negocio
│   │   ├── AuthService.js            # Autenticación usuarios
│   │   ├── UserService.js            # Gestión usuarios
│   │   ├── ClientService.js          # Gestión clientes
│   │   └── NotificationService.js    # Notificaciones
│   │
│   ├── 🛠️ utils/                     # Utilidades
│   │   ├── formatters.js             # Formateo de datos
│   │   ├── validators.js             # Validadores
│   │   ├── helpers.js                # Funciones auxiliares
│   │   ├── constants.js              # Constantes
│   │   └── errors.js                 # Clases de error personalizadas
│   │
│   ├── 🌐 public/                    # Assets estáticos
│   │   ├── admin/                    # Panel administrador
│   │   │   ├── index.html
│   │   │   ├── css/
│   │   │   └── js/
│   │   │
│   │   └── client/                   # Panel clientes
│   │       ├── dashboard.html
│   │       ├── css/
│   │       └── js/
│   │
│   └── 🧪 tests/                     # Tests
│       ├── unit/                     # Tests unitarios
│       │   ├── whatsapp/
│       │   ├── leads/
│       │   └── ai/
│       │
│       ├── integration/              # Tests de integración
│       │   ├── api/
│       │   └── database/
│       │
│       └── e2e/                      # Tests end-to-end
│           └── scenarios/
│
├── 📄 index.js → src/index.js        # Entry point (redirige)
├── 📦 package.json                   # Dependencias
├── 🔒 .env.example                   # Template variables entorno
├── 🚫 .gitignore                     # Archivos ignorados
├── 📋 ecosystem.config.js            # Configuración PM2
├── 📖 README.md                      # Documentación principal
├── 📊 ANALISIS_LEGACY.md             # Análisis de proyectos legacy
└── 📐 ARQUITECTURA.md                # Este archivo
```

---

## 🎯 Responsabilidades por Módulo

### 🔧 Core (Núcleo)

#### `core/config/`
- ✅ Centralizar toda la configuración del sistema
- ✅ Validar variables de entorno
- ✅ Exportar configuración tipada
- ✅ Separar configs por dominio (DB, Redis, WhatsApp)

#### `core/database/`
- ✅ Gestionar pool de conexiones MySQL
- ✅ Ejecutar migraciones
- ✅ Seeders para datos iniciales
- ✅ Health checks de BD

#### `core/logger/`
- ✅ Sistema de logging centralizado con Winston
- ✅ Múltiples transports (console, file, remote)
- ✅ Niveles de log configurables
- ✅ Rotación de logs

---

### 📦 Modules (Módulos de Negocio)

#### `modules/whatsapp/` ⭐ **MÓDULO PRINCIPAL**

Implementa la **arquitectura propuesta** en `ANALISIS_MODULARIZACION_WHATSAPP.md`:

##### **connection/** - Gestión de Conexiones
```javascript
ConnectionManager.js
├── createConnection(sessionId, options)
├── getConnection(sessionId)
├── closeConnection(sessionId)
├── isConnected(sessionId)
└── getActiveConnections()

SessionStore.js
├── save(sessionId, sessionData)
├── load(sessionId)
├── delete(sessionId)
└── exists(sessionId)

QRCodeHandler.js
├── generate(sessionId)
├── display(qrCode, format)
└── isExpired(qrCode)

AuthHandler.js
├── authenticate(sessionId)
├── isAuthenticated(sessionId)
└── handleAuthFailure(sessionId, reason)
```

##### **sender/** - Envío de Mensajes
```javascript
MessageSender.js
├── sendMessage(sessionId, phone, message)
├── sendBulk(sessionId, messages)
├── formatPhoneNumber(phone)
└── logMessage(sessionId, phone, status)

BulkSender.js
├── sendCampaign(campaignId, sessionId)
├── processBatch(messages, batchSize)
└── getProgress(campaignId)

MessageQueue.js
├── enqueue(sessionId, phone, message, priority)
├── dequeue()
├── processQueue()
└── getStatus()

RateLimiter.js
├── checkLimit(sessionId)
├── incrementCounter(sessionId)
└── resetCounter(sessionId)
```

##### **listener/** - Escucha de Mensajes
```javascript
MessageListener.js
├── startListening(sessionId)
├── stopListening(sessionId)
├── handleMessage(sessionId, message)
├── onMessage(type, handler)
└── shouldProcessMessage(message)

EventHandler.js
├── on(event, handler)
├── emit(event, data)
└── removeListener(event, handler)

CommandParser.js
├── registerCommand(trigger, handler, description)
├── parse(message)
└── getCommands()

ResponseHandler.js
├── generateResponse(message, context)
├── sendResponse(sessionId, phone, response)
└── handleError(error)
```

##### **adapters/** - Adaptadores de Librerías
```javascript
VenomBotAdapter.js (USAR - v5.3.0)
├── createClient(sessionId, options)
├── sendText(client, phone, message)
├── onMessage(client, handler)
└── destroy(client)

WhatsAppWebAdapter.js (DEPRECAR)
├── createClient(sessionId, options)  // Mantener por compatibilidad temporal
└── ... (mismo API que VenomBotAdapter)
```

##### **WhatsAppService.js** - Fachada Unificada (Singleton)
```javascript
WhatsAppService (Singleton)
├── createSession(sessionId, options)
├── closeSession(sessionId)
├── getSessionStatus(sessionId)
├── getQRCode(sessionId)
├── sendMessage(sessionId, phone, message)
├── sendBulk(sessionId, messages)
├── queueMessage(sessionId, phone, message, priority)
├── onMessage(type, handler)
├── registerCommand(trigger, handler, description)
└── getAllSessions()
```

---

#### `modules/leads/` - Gestión de Leads

```javascript
LeadService.js
├── createLead(data)
├── updateLead(id, data)
├── getLead(id)
├── listLeads(filters, pagination)
├── deleteLead(id)
└── importLeads(csvFile)

LeadRepository.js
├── save(lead)
├── findById(id)
├── findAll(filters)
├── update(id, data)
└── delete(id)

LeadValidator.js
├── validateCreate(data)
├── validateUpdate(data)
├── validatePhone(phone)
└── validateEmail(email)

LeadCurator.js
├── normalize(lead)
├── deduplicate(leads)
├── enrich(lead)
└── validate(lead)
```

---

#### `modules/campaigns/` - Campañas de Envío

```javascript
CampaignService.js
├── createCampaign(data)
├── startCampaign(id)
├── pauseCampaign(id)
├── stopCampaign(id)
└── getCampaignStatus(id)

CampaignRepository.js
├── save(campaign)
├── findById(id)
├── findAll(filters)
└── update(id, data)

CampaignScheduler.js
├── schedule(campaignId, startDate)
├── cancel(campaignId)
└── getScheduled()

CampaignAnalytics.js
├── getStats(campaignId)
├── getDeliveryRate(campaignId)
├── getResponseRate(campaignId)
└── exportReport(campaignId)
```

---

#### `modules/ai/` - Inteligencia Artificial

```javascript
OpenAIService.js
├── generateResponse(prompt, context)
├── analyzeIntent(message)
└── generateSummary(conversation)

ContextManager.js
├── getContext(sessionId)
├── updateContext(sessionId, data)
└── clearContext(sessionId)

ResponseGenerator.js
├── generate(message, context)
├── formatResponse(response)
└── addPersonality(response)

MessageAnalyzer.js
├── extractEntities(message)
├── detectSentiment(message)
└── classifyIntent(message)
```

---

### 🛣️ Routes (Rutas HTTP)

```javascript
routes/index.js              // Router principal
├── /api/auth/*              // Autenticación
├── /api/whatsapp/*          // WhatsApp operations
├── /api/leads/*             // CRUD leads
├── /api/campaigns/*         // CRUD campañas
├── /admin/*                 // Panel administrador
└── /client/:clientId/*      // Panel cliente
```

---

### 🛡️ Middleware (Middlewares Express)

```javascript
auth.js
├── requireAuth()            // Verificar autenticación
├── requireRole(role)        // Verificar rol
└── extractUser()            // Extraer usuario del token

rateLimiter.js
├── apiLimiter               // Límite general API
├── authLimiter              // Límite login
└── whatsappLimiter          // Límite envío WhatsApp

errorHandler.js
├── handleError(err, req, res, next)
├── notFound(req, res, next)
└── logError(err)

validator.js
├── validateBody(schema)
├── validateQuery(schema)
└── validateParams(schema)

cors.js
├── configureCors()
└── allowedOrigins()
```

---

## 🔄 Flujo de Datos

### Envío de Mensaje Individual

```
Cliente → Route → Middleware → Service → WhatsAppService → MessageSender → VenomBotAdapter → WhatsApp
```

### Envío de Campaña Masiva

```
Cliente → Route → CampaignService → MessageQueue → BulkSender → RateLimiter → MessageSender → WhatsApp
```

### Recepción y Respuesta Automática

```
WhatsApp → VenomBotAdapter → MessageListener → CommandParser → AI Service → ResponseHandler → MessageSender → WhatsApp
```

---

## 🧪 Testing

### Unit Tests (`tests/unit/`)
- ✅ Tests de cada clase/módulo independiente
- ✅ Mocks de dependencias externas
- ✅ Cobertura > 80%

### Integration Tests (`tests/integration/`)
- ✅ Tests de integración entre módulos
- ✅ Tests de API endpoints
- ✅ Tests de base de datos

### E2E Tests (`tests/e2e/`)
- ✅ Tests de flujos completos
- ✅ Tests con Playwright
- ✅ Simulación de usuarios reales

---

## 📝 Convenciones de Código

### Naming Conventions
- **Clases:** `PascalCase` (ej: `ConnectionManager`)
- **Funciones:** `camelCase` (ej: `createConnection`)
- **Constantes:** `UPPER_SNAKE_CASE` (ej: `MAX_RETRIES`)
- **Archivos:** `PascalCase.js` para clases, `camelCase.js` para utilidades

### Estructura de Archivos
```javascript
// 1. Imports
const express = require('express');

// 2. Constants
const MAX_RETRIES = 3;

// 3. Class/Function
class ServiceName {
  // Constructor
  constructor() {}
  
  // Public methods
  publicMethod() {}
  
  // Private methods
  _privateMethod() {}
}

// 4. Exports
module.exports = ServiceName;
```

---

## 🚀 Próximos Pasos

1. ✅ Crear archivos base de cada módulo
2. ✅ Implementar `core/config/`
3. ✅ Implementar `core/database/`
4. ✅ Implementar `modules/whatsapp/connection/`
5. ✅ Implementar `modules/whatsapp/sender/`
6. ✅ Implementar `modules/whatsapp/listener/`
7. ✅ Implementar `modules/whatsapp/adapters/`
8. ✅ Implementar `WhatsAppService.js`
9. ✅ Crear routes y middleware
10. ✅ Testing completo

---

**Estado:** ✅ Estructura creada - Listo para implementar módulos
