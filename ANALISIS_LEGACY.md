# 📊 Análisis de Proyectos Legacy

**Fecha:** 5 de diciembre de 2025  
**Objetivo:** Extraer configuraciones, dependencias y funcionalidades de los 3 proyectos existentes

---

## 🗂️ Proyectos Analizados

### 1. whatsapp-massive-sender
**Descripción:** Sistema de envío masivo de mensajes WhatsApp  
**Puerto:** 3010  
**Archivo principal:** `index.js`

### 2. whatsapp-bot-responder
**Descripción:** Bot automático con respuestas IA (OpenAI GPT)  
**Puerto:** N/A (sin servidor web)  
**Archivo principal:** `index.js`

### 3. desarrolloydisenio-api
**Descripción:** API de gestión de leads y datos  
**Puerto:** N/A  
**Archivo principal:** `index.js`

---

## 📦 Dependencias Consolidadas

### WhatsApp & Automatización
```json
{
  "venom-bot": "^5.3.0",           // ✅ USAR (más actualizado)
  "whatsapp-web.js": "^1.23.0",    // ⚠️ DEPRECAR (solo en massive-sender)
  "puppeteer": "^24.15.0",         // ✅ Requerido por venom-bot
  "puppeteer-core": "^24.32.0",    // ✅ Requerido por venom-bot
  "qrcode-terminal": "^0.12.0"     // ✅ Para mostrar QR en terminal
}
```

### Backend & API
```json
{
  "express": "^4.21.2",            // ✅ Framework web
  "cors": "^2.8.5",                // ✅ CORS middleware
  "helmet": "^8.1.0",              // ✅ Seguridad HTTP headers
  "morgan": "^1.10.1",             // ✅ HTTP logger
  "express-rate-limit": "^8.2.1",  // ✅ Rate limiting
  "dotenv": "^16.5.0"              // ✅ Variables de entorno
}
```

### Base de Datos
```json
{
  "mysql2": "^3.14.1"              // ✅ Cliente MySQL (promise-based)
}
```

### Sesiones & Autenticación
```json
{
  "express-session": "^1.18.2",    // ✅ Gestión de sesiones
  "connect-redis": "^9.0.0",       // ✅ Store Redis para sesiones
  "redis": "^5.10.0",              // ✅ Cliente Redis
  "bcrypt": "^6.0.0"               // ✅ Hash de passwords
}
```

### IA & Procesamiento
```json
{
  "openai": "^4.36.0"              // ✅ API OpenAI GPT
}
```

### Utilidades
```json
{
  "moment": "^2.30.1",             // ⚠️ MIGRAR A dayjs
  "dayjs": "^1.11.13",             // ✅ USAR (más ligero)
  "axios": "^1.8.4",               // ✅ HTTP client
  "node-fetch": "^2.7.0",          // ⚠️ Redundante con axios
  "winston": "^3.18.3",            // ✅ Logger avanzado
  "geolib": "^3.3.4",              // ✅ Cálculos geográficos
  "papaparse": "^5.5.2",           // ✅ Parser CSV
  "csv-writer": "^1.6.0",          // ✅ Escritor CSV
  "json2csv": "^6.0.0-alpha.2",    // ✅ JSON a CSV
  "formdata-node": "^6.0.3"        // ✅ Manejo de FormData
}
```

### Process Manager
```json
{
  "pm2": "^6.0.8"                  // ✅ Gestión de procesos en producción
}
```

### Testing
```json
{
  "@playwright/test": "^1.57.0",   // ✅ Testing E2E
  "playwright": "^1.57.0",         // ✅ Automatización navegador
  "start-server-and-test": "^2.1.3" // ✅ Útil para CI/CD
}
```

### DevDependencies
```json
{
  "nodemon": "^3.1.9"              // ✅ Auto-reload en desarrollo
}
```

---

## ⚙️ Variables de Entorno

### Base de Datos (Compartida por los 3 proyectos)
```bash
DB_HOST=sv46.byethost46.org
DB_USER=iunaorg_b3toh
DB_PASSWORD=elgeneral2018
DB_NAME=iunaorg_doli184       # massive-sender
DB_NAME=iunaorg_database      # bot-responder (presumido)
DB_PORT=3306
```

### OpenAI API (Bot Responder & Massive Sender)
```bash
OPENAI_API_KEY=sk-proj-***    # ⚠️ ROTAR en nuevo proyecto
```

### Servidor Web (Massive Sender)
```bash
PORT=3010
SESSION_SECRET=***            # ⚠️ GENERAR NUEVO
```

### WhatsApp (Bot Responder)
```bash
SESSION_NAME=whatsapp-bot-responder
RESPONDER_ACTIVO=false        # Toggle para activar/desactivar
HOST_ENV=server               # 'local' | 'server'
```

### Redis (Massive Sender)
```bash
REDIS_HOST=localhost          # Presumido
REDIS_PORT=6379               # Presumido
```

---

## 🎯 Funcionalidades Mapeadas

### 📤 whatsapp-massive-sender

#### Módulos Principales:
```
├── bot/
│   └── whatsapp_instance.js       # Gestión de múltiples sesiones venom-bot
├── campaigns/
│   └── envio.js                   # Lógica de envío de campañas
├── clients/
│   ├── {cliente}/                 # Por cliente (haby, marketing, etc.)
│   │   ├── tokens/                # Sesiones WhatsApp
│   │   └── dashboard.html         # Panel web del cliente
├── controllers/
│   ├── enviar_masivo.js           # Envío masivo de mensajes
│   ├── registros.js               # CRUD de registros
│   └── auth.js                    # Autenticación usuarios
├── routes/
│   ├── haby.js                    # Rutas específicas cliente Haby
│   ├── marketing.js               # Rutas cliente Marketing
│   └── admin.js                   # Panel administrador
├── db/
│   └── connection.js              # Pool MySQL
├── middleware/
│   ├── auth.js                    # Verificación sesión
│   └── rateLimiter.js             # Límite de requests
├── public/
│   ├── admin/                     # Panel administrador
│   └── {cliente}/                 # Dashboards por cliente
└── services/
    └── whatsapp.js                # Servicios WhatsApp
```

#### Funcionalidades Clave:
1. ✅ **Multi-sesión WhatsApp** - Múltiples clientes con sesiones separadas
2. ✅ **Envío Masivo** - Campañas a listas de contactos
3. ✅ **QR Code Management** - Generación y display de QR
4. ✅ **Dashboard por Cliente** - Panel web individual
5. ✅ **Panel Admin** - Gestión global de clientes
6. ✅ **Rate Limiting** - Control de velocidad de envío
7. ✅ **Autenticación** - Login con bcrypt
8. ✅ **Sesiones Redis** - Persistencia de sesiones web
9. ✅ **Logging** - Winston para logs

#### Base de Datos:
- `ll_envios_whatsapp` - Cola de mensajes a enviar
- `ll_usuarios` - Usuarios del sistema
- `ll_clientes` - Clientes (haby, marketing, etc.)
- `ll_campanas` - Campañas de envío

---

### 🤖 whatsapp-bot-responder

#### Módulos Principales:
```
├── bot/
│   └── whatsapp.js                # Venom-bot listener
├── ia/
│   ├── chatgpt.js                 # Integración OpenAI
│   ├── analizador.js              # Análisis de mensajes
│   ├── contextoSitio.js           # Contexto empresa
│   └── respuestas.js              # Generación respuestas
├── db/
│   ├── connection.js              # Pool MySQL
│   ├── conversaciones.js          # Guardado de chats
│   └── botControl.js              # Estado del bot
├── config/
│   └── config.js                  # Configuración centralizada
└── utils/
    └── normalizar.js              # Normalización de texto
```

#### Funcionalidades Clave:
1. ✅ **Escucha de Mensajes** - onMessage listener
2. ✅ **Respuestas IA** - OpenAI GPT-4
3. ✅ **Contexto Empresarial** - Personalización de respuestas
4. ✅ **Historial Conversaciones** - Guardado en BD
5. ✅ **Toggle Activación** - Encender/apagar bot
6. ✅ **Filtros** - No responder mensajes propios/grupos
7. ✅ **Normalización** - Limpieza de texto

#### Base de Datos:
- `bot_conversaciones` - Historial de mensajes
- `bot_control` - Estado del bot (activo/inactivo)

---

### 🌐 desarrolloydisenio-api

#### Módulos Principales:
```
├── routes/
│   ├── listados.js                # Endpoints de listados
│   ├── lugares.js                 # Gestión de lugares
│   ├── rubros.js                  # Gestión de rubros
│   └── portfolio.js               # Gestión de portfolios
├── database/
│   └── *.sql                      # Migraciones SQL
├── scripts/
│   └── sync-*.js                  # Scripts de sincronización
├── listados/
│   └── *.csv                      # Datos en CSV
└── logs/
    └── *.log                      # Logs de operaciones
```

#### Funcionalidades Clave:
1. ✅ **CRUD Lugares** - Alta, modificación, baja lugares
2. ✅ **CRUD Rubros** - Gestión de categorías
3. ✅ **Listados** - Endpoints de consulta
4. ✅ **Portfolios** - Gestión de trabajos
5. ✅ **Geolocalización** - Cálculos con geolib
6. ✅ **Export CSV** - Exportación de datos
7. ✅ **Import CSV** - Importación masiva

#### Base de Datos:
- `ll_lugares` - Lugares/negocios
- `ll_rubros` - Rubros/categorías
- `ll_portfolio` - Portfolio de trabajos
- `ll_usuarios` - Usuarios del sistema

---

## 🔄 Dependencias Cruzadas

### Módulos Compartidos:
- ✅ **MySQL Connection Pool** - Los 3 usan `mysql2` con mismo servidor
- ✅ **Variables Entorno** - Los 3 usan `dotenv`
- ✅ **Express** - massive-sender y ddw-api usan Express

### Conflictos Identificados:
- ⚠️ **Dos librerías WhatsApp** - venom-bot vs whatsapp-web.js
- ⚠️ **Sesiones separadas** - Bot usa una, massive-sender usa múltiples
- ⚠️ **Sin comunicación** - Los 3 proyectos no se comunican entre sí

---

## 🎯 Dependencias del Nuevo Proyecto

### Core Dependencies (Unificadas)
```json
{
  "express": "^4.21.2",
  "venom-bot": "^5.3.0",
  "mysql2": "^3.14.1",
  "openai": "^4.36.0",
  "dotenv": "^16.5.0",
  "cors": "^2.8.5",
  "helmet": "^8.1.0",
  "morgan": "^1.10.1",
  "winston": "^3.18.3",
  "express-rate-limit": "^8.2.1",
  "express-session": "^1.18.2",
  "connect-redis": "^9.0.0",
  "redis": "^5.10.0",
  "bcrypt": "^6.0.0",
  "puppeteer": "^24.15.0",
  "qrcode-terminal": "^0.12.0",
  "dayjs": "^1.11.13",
  "axios": "^1.8.4"
}
```

### Utilities (Opcionales según módulos)
```json
{
  "geolib": "^3.3.4",
  "papaparse": "^5.5.2",
  "csv-writer": "^1.6.0",
  "json2csv": "^6.0.0-alpha.2",
  "formdata-node": "^6.0.3"
}
```

### Process Manager
```json
{
  "pm2": "^6.0.8"
}
```

### Dev Dependencies
```json
{
  "nodemon": "^3.1.9",
  "@playwright/test": "^1.57.0",
  "jest": "^29.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0"
}
```

---

## 📝 Recomendaciones de Migración

### 1. WhatsApp Library
- ✅ **USAR:** `venom-bot` (v5.3.0)
- ❌ **DEPRECAR:** `whatsapp-web.js`
- **Razón:** venom-bot es más estable, mejor documentado, y ya está en bot-responder

### 2. Date Library
- ✅ **USAR:** `dayjs`
- ❌ **DEPRECAR:** `moment`
- **Razón:** dayjs es 2KB vs 67KB de moment

### 3. HTTP Client
- ✅ **USAR:** `axios`
- ❌ **DEPRECAR:** `node-fetch`
- **Razón:** axios tiene mejor API y más features

### 4. Arquitectura
- ✅ **Unificar** conexiones WhatsApp en un solo módulo
- ✅ **Separar** lógica de envío y escucha en servicios independientes
- ✅ **Centralizar** configuración de BD
- ✅ **Modularizar** IA, leads, y campañas

### 5. Base de Datos
- ✅ **Mantener** estructura existente
- ✅ **Agregar** tablas nuevas para features unificados
- ✅ **Migrar** gradualmente datos legacy

---

## 🚀 Próximos Pasos

1. ✅ Crear estructura de carpetas `src/`
2. ✅ Inicializar `package.json` con dependencias unificadas
3. ✅ Crear módulo core de WhatsApp (ConnectionManager)
4. ✅ Migrar lógica de envío masivo
5. ✅ Migrar lógica de bot responder
6. ✅ Integrar API de leads
7. ✅ Crear panel unificado
8. ✅ Testing
9. ✅ Documentación
10. ✅ Deploy

---

**Estado:** ✅ Análisis completo - Listo para iniciar Fase 0
