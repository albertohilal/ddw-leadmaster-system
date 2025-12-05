/**
 * Pool de Conexiones MySQL
 */

const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../logger');

let pool = null;

/**
 * Crear pool de conexiones
 */
function createPool() {
  if (!pool) {
    try {
      pool = mysql.createPool(config.database);
      logger.info('📦 Pool de conexiones MySQL creado');
    } catch (error) {
      logger.error('❌ Error creando pool MySQL:', error);
      throw error;
    }
  }
  return pool;
}

/**
 * Obtener pool de conexiones
 */
function getPool() {
  if (!pool) {
    return createPool();
  }
  return pool;
}

/**
 * Test de conexión
 */
async function testConnection() {
  try {
    const connection = await getPool().getConnection();
    await connection.ping();
    connection.release();
    logger.info('✅ Conexión a MySQL exitosa');
    return true;
  } catch (error) {
    logger.error('❌ Error conectando a MySQL:', error.message);
    throw error;
  }
}

/**
 * Cerrar pool de conexiones
 */
async function closeConnection() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      logger.info('✅ Pool MySQL cerrado');
    } catch (error) {
      logger.error('❌ Error cerrando pool MySQL:', error);
      throw error;
    }
  }
}

/**
 * Ejecutar query
 */
async function query(sql, params = []) {
  try {
    const [results] = await getPool().execute(sql, params);
    return results;
  } catch (error) {
    logger.error('❌ Error ejecutando query:', error);
    throw error;
  }
}

module.exports = {
  createPool,
  getPool,
  testConnection,
  closeConnection,
  query
};
