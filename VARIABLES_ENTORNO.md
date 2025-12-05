# Variables de Entorno Consolidadas

## 📋 Resumen de Configuración

Este documento explica todas las variables de entorno del sistema unificado **DDW LeadMaster**, consolidando las configuraciones de los 3 proyectos legacy:

- `whatsapp-bot-responder` (bot IA)
- `whatsapp-massive-sender` (envíos masivos)
- `desarrolloydisenio-api` (API backend)

---

## 🗂️ Estructura de Archivos

```
ddw-leadmaster-system/
├── .env                    # ✅ Variables reales (NO subir a git)
├── .env.example            # ✅ Template público (SI subir a git)
└── src/core/config/
    └── index.js            # ✅ Módulo que organiza las variables
```

---

## 📦 Variables Consolidadas

### 1. Base de Datos (MySQL)
**Origen:** Los 3 proyectos usan la misma BD

```bash
DB_HOST=sv46.byethost46.org     # Host compartido
DB_USER=iunaorg_b3toh           # Usuario unificado
DB_PASSWORD=elgeneral2018       # Password unificada
DB_NAME=iunaorg_dyd             # Base de datos única
DB_PORT=3306                    # Puerto estándar MySQL
```

**Uso en código:**
```javascript
const config = require('./core/config');
config.database.host      // 'sv46.byethost46.org'
config.database.user      // 'iunaorg_b3toh'
```

---

### 2. Servidor
```bash
PORT=3011                       # Nuevo puerto (evita conflicto con 3010)
NODE_ENV=development            # 'development' | 'production'
HOST=localhost                  # Host del servidor
```

---

### 3. Seguridad y Sesiones
**Origen:** `whatsapp-massive-sender`

```bash
SESSION_SECRET=lZwIt8y...      # Secret para express-session
SESSION_MAX_AGE=86400000       # 24 horas en ms
```

---

### 4. Redis (Cache y Sesiones)
**Origen:** `whatsapp-massive-sender`

```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                 # Vacío si no tiene password
REDIS_DB=0
```

---

### 5. OpenAI (IA Conversacional)
**Origen:** `whatsapp-bot-responder` + `whatsapp-massive-sender`

```bash
OPENAI_API_KEY=sk-proj-aRbQ...
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
```

**Uso en código:**
```javascript
config.openai.apiKey      // Para inicializar OpenAI client
config.openai.model       // 'gpt-4'
```

---

### 6. Google API
**Origen:** `desarrolloydisenio-api`

```bash
GOOGLE_API_KEY=AIzaSyCVi...    # Para Google Maps, Places, etc.
```

---

### 7. WhatsApp Bot
**Origen:** Consolidación de bot-responder + massive-sender

```bash
BOT_RESPONDER_ACTIVO=false      # true/false - Activar respuestas automáticas
HOST_ENV=local                  # 'local' | 'server'
SESSION_NAME=whatsapp-bot-responder
MESSAGE_DELAY=3000              # Delay entre mensajes (ms)
MAX_MESSAGES_PER_MINUTE=20      # Rate limit
WHATSAPP_SESSIONS_PATH=./tokens # Ruta para tokens de sesión
```

**Uso en código:**
```javascript
config.whatsapp.responderActivo      // boolean
config.whatsapp.sessionName          // 'whatsapp-bot-responder'
config.whatsapp.sessionsPath         // './tokens'
```

---

### 8. Logs
```bash
LOG_LEVEL=info                  # 'error' | 'warn' | 'info' | 'debug'
LOG_FILE=logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7d                # Retención de 7 días
```

---

### 9. Rate Limiting
```bash
RATE_LIMIT_WINDOW_MS=900000     # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100     # Máx requests por ventana
```

---

### 10. CORS
```bash
CORS_ORIGIN=http://localhost:3010
CORS_CREDENTIALS=true
```

---

### 11. Feature Flags
```bash
FEATURE_MULTI_SESSION=true      # Múltiples sesiones WhatsApp
FEATURE_AI_RESPONSES=false      # Respuestas automáticas con IA
FEATURE_BULK_SENDER=true        # Envíos masivos
FEATURE_LEAD_MANAGEMENT=true    # Gestión de leads
```

---

## 🔄 Migración desde Legacy

### ¿Qué cambió?

| Variable Legacy | Nueva Variable | Proyecto Origen |
|----------------|----------------|-----------------|
| `DB_DATABASE` | `DB_NAME` | bot-responder |
| `RESPONDER_ACTIVO` | `BOT_RESPONDER_ACTIVO` | bot-responder |
| - | `REDIS_URL` | massive-sender (agregado) |
| - | `GOOGLE_API_KEY` | ddw-api (agregado) |
| - | `SESSION_NAME` | bot-responder (agregado) |
| - | `WHATSAPP_SESSIONS_PATH` | massive-sender (agregado) |

---

## 📚 Acceso desde Código

### Ejemplo de uso:

```javascript
// ❌ ANTES (legacy) - Acceso directo a process.env
const dbHost = process.env.DB_HOST;
const openaiKey = process.env.OPENAI_API_KEY;

// ✅ AHORA - A través del módulo config
const config = require('./core/config');

const dbHost = config.database.host;
const openaiKey = config.openai.apiKey;
const sessionsPath = config.whatsapp.sessionsPath;
const googleKey = config.google.apiKey;
```

### Ventajas:
- ✅ **Tipado y validación** en un solo lugar
- ✅ **Valores por defecto** si falta alguna variable
- ✅ **Organización lógica** por módulos (database, whatsapp, openai, etc.)
- ✅ **Fácil refactorización** - cambias en un solo archivo

---

## 🚀 Despliegue

### Development (Local)
```bash
cp .env.example .env
# Editar .env con valores reales
npm run dev
```

### Production (Contabo)
```bash
# En el servidor
nano .env
# Cambiar:
# NODE_ENV=production
# HOST_ENV=server
# PORT=3011
# BOT_RESPONDER_ACTIVO=true
# FEATURE_AI_RESPONSES=true

npm start
# O con PM2:
npm run pm2:start
```

---

## ⚠️ Seguridad

### ✅ LO QUE ESTÁ PROTEGIDO (Git ignora):
- `.env` - Variables reales, **NUNCA** en git

### ✅ LO QUE SE SUBE A GIT:
- `.env.example` - Template sin valores sensibles
- `src/core/config/index.js` - Código que lee las variables

### 🔒 Valores sensibles:
- `DB_PASSWORD`
- `SESSION_SECRET`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`

**Nunca compartir estos valores en público.**

---

## 🔧 Mantenimiento

### Agregar nueva variable:

1. **Agregar al `.env`:**
```bash
NEW_VARIABLE=valor_real
```

2. **Agregar al `.env.example`:**
```bash
NEW_VARIABLE=placeholder_value
```

3. **Agregar al `config/index.js`:**
```javascript
newFeature: {
  variable: process.env.NEW_VARIABLE || 'default_value'
}
```

4. **Documentar aquí** en esta guía.

---

## 📊 Comparación con Legacy

| Aspecto | Legacy (3 proyectos) | Nuevo (Unificado) |
|---------|---------------------|-------------------|
| Archivos .env | 3 archivos separados | 1 archivo central |
| Variables duplicadas | Sí (DB_*, OPENAI_*) | No, consolidadas |
| Acceso | `process.env.*` | `config.*.*` |
| Validación | Ninguna | Centralizada |
| Mantenimiento | Cambios en 3 lugares | Un solo lugar |

---

## ✅ Checklist

- [x] `.env` con todas las variables de los 3 proyectos
- [x] `.env.example` sin valores sensibles
- [x] `config/index.js` leyendo todas las variables
- [x] `.gitignore` protegiendo `.env`
- [x] Documentación completa
- [ ] Variables de producción preparadas
- [ ] PM2 ecosystem config con variables de entorno

---

**Última actualización:** 5 de diciembre de 2025
