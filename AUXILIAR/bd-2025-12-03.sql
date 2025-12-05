-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: sv46.byethost46.org    Database: iunaorg_dyd
-- ------------------------------------------------------
-- Server version	5.5.5-10.11.14-MariaDB-cll-lve-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ll_busquedas`
--

DROP TABLE IF EXISTS `ll_busquedas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_busquedas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `celda_id` varchar(50) DEFAULT NULL,
  `keyword_google` varchar(255) DEFAULT NULL,
  `fecha` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_busquedas_realizadas`
--

DROP TABLE IF EXISTS `ll_busquedas_realizadas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_busquedas_realizadas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grilla_id` int(11) NOT NULL,
  `keyword` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `grilla_id` (`grilla_id`),
  CONSTRAINT `ll_busquedas_realizadas_ibfk_1` FOREIGN KEY (`grilla_id`) REFERENCES `ll_grilla` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1047 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_campanias_whatsapp`
--

DROP TABLE IF EXISTS `ll_campanias_whatsapp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_campanias_whatsapp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `mensaje` text NOT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `estado` enum('pendiente','en_progreso','finalizado') DEFAULT 'pendiente',
  `cliente_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_envios_whatsapp`
--

DROP TABLE IF EXISTS `ll_envios_whatsapp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_envios_whatsapp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campania_id` int(11) NOT NULL,
  `telefono_wapp` varchar(255) DEFAULT NULL,
  `nombre_destino` varchar(255) DEFAULT NULL,
  `mensaje_final` text DEFAULT NULL,
  `estado` enum('pendiente','enviado','error') DEFAULT 'pendiente',
  `fecha_envio` datetime DEFAULT NULL,
  `lugar_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_unico_envio` (`campania_id`,`telefono_wapp`),
  CONSTRAINT `ll_envios_whatsapp_ibfk_1` FOREIGN KEY (`campania_id`) REFERENCES `ll_campanias_whatsapp` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_fuentes`
--

DROP TABLE IF EXISTS `ll_fuentes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_fuentes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_grilla`
--

DROP TABLE IF EXISTS `ll_grilla`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_grilla` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grilla_nombre` varchar(100) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `fila` int(11) NOT NULL,
  `columna` int(11) NOT NULL,
  `lat1` decimal(10,6) NOT NULL,
  `lng1` decimal(10,6) NOT NULL,
  `lat2` decimal(10,6) NOT NULL,
  `lng2` decimal(10,6) NOT NULL,
  `lat_centro` decimal(10,6) NOT NULL,
  `lng_centro` decimal(10,6) NOT NULL,
  `estado` varchar(50) NOT NULL DEFAULT 'pendiente',
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1601 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_grilla_rubros`
--

DROP TABLE IF EXISTS `ll_grilla_rubros`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_grilla_rubros` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `grilla_id` int(11) NOT NULL,
  `rubro_id` int(11) NOT NULL,
  `estado` enum('pendiente','seleccionado','revisar','descartado') DEFAULT 'pendiente',
  `fecha_modificacion` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `grilla_rubro_unico` (`grilla_id`,`rubro_id`),
  KEY `idx_grilla` (`grilla_id`),
  KEY `idx_rubro` (`rubro_id`),
  KEY `idx_estado` (`estado`),
  CONSTRAINT `ll_grilla_rubros_ibfk_1` FOREIGN KEY (`grilla_id`) REFERENCES `ll_grilla` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ll_grilla_rubros_ibfk_2` FOREIGN KEY (`rubro_id`) REFERENCES `ll_rubros` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2518 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_grillas`
--

DROP TABLE IF EXISTS `ll_grillas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_grillas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `zona` varchar(100) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_ia_conversaciones`
--

DROP TABLE IF EXISTS `ll_ia_conversaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_ia_conversaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `telefono` varchar(20) NOT NULL,
  `rol` enum('user','assistant') NOT NULL,
  `mensaje` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_lugares`
--

DROP TABLE IF EXISTS `ll_lugares`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_lugares` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `place_id` varchar(255) NOT NULL,
  `nombre` varchar(255) DEFAULT NULL,
  `rubro` varchar(100) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `telefono` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `sitio_web` varchar(255) DEFAULT NULL,
  `latitud` decimal(10,7) DEFAULT NULL,
  `longitud` decimal(10,7) DEFAULT NULL,
  `rubro_id` int(11) DEFAULT NULL,
  `zona_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `rating` decimal(2,1) DEFAULT NULL,
  `reviews` int(11) DEFAULT 0,
  `tipos` text DEFAULT NULL,
  `precio` tinyint(4) DEFAULT NULL,
  `abierto` tinyint(1) DEFAULT NULL,
  `telefono_wapp` varchar(20) DEFAULT NULL,
  `wapp_valido` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `place_id` (`place_id`),
  KEY `rubro_id` (`rubro_id`),
  CONSTRAINT `ll_lugares_ibfk_1` FOREIGN KEY (`rubro_id`) REFERENCES `ll_rubros` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8447 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_lugares_clientes`
--

DROP TABLE IF EXISTS `ll_lugares_clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_lugares_clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lugar_id` int(11) NOT NULL,
  `cliente_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_lugar_cliente` (`lugar_id`,`cliente_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1794 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_lugares_scrap`
--

DROP TABLE IF EXISTS `ll_lugares_scrap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_lugares_scrap` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `place_id` varchar(255) NOT NULL,
  `nombre` varchar(255) DEFAULT NULL,
  `tipo_dato` enum('telefono','sitio_web','instagram','facebook','whatsapp','email','otro') NOT NULL,
  `valor` text NOT NULL,
  `fuente` enum('manual','scraper','ia','api_externa') DEFAULT 'manual',
  `fecha_scrap` datetime DEFAULT current_timestamp(),
  `observaciones` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `place_id` (`place_id`),
  KEY `tipo_dato` (`tipo_dato`),
  KEY `fuente` (`fuente`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_mensajes`
--

DROP TABLE IF EXISTS `ll_mensajes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_mensajes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `telefono` varchar(20) DEFAULT NULL,
  `mensaje` text DEFAULT NULL,
  `respuesta` text DEFAULT NULL,
  `fecha` datetime DEFAULT current_timestamp(),
  `fuente` enum('whatsapp','email','web') DEFAULT NULL,
  `lugar_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_lugar` (`lugar_id`),
  CONSTRAINT `fk_lugar` FOREIGN KEY (`lugar_id`) REFERENCES `ll_lugares` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_rubros`
--

DROP TABLE IF EXISTS `ll_rubros`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_rubros` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `area` varchar(100) DEFAULT NULL,
  `nombre` varchar(100) NOT NULL,
  `nombre_es` varchar(100) DEFAULT NULL,
  `keyword_google` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `busqueda` tinyint(1) DEFAULT 0,
  `fuente_id` int(11) DEFAULT 2,
  PRIMARY KEY (`id`),
  KEY `fk_rubros_fuente` (`fuente_id`),
  KEY `idx_keyword_google_b89457` (`keyword_google`),
  CONSTRAINT `fk_rubros_fuente` FOREIGN KEY (`fuente_id`) REFERENCES `ll_fuentes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=301 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_temp_telefonos`
--

DROP TABLE IF EXISTS `ll_temp_telefonos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_temp_telefonos` (
  `place_id` text DEFAULT NULL,
  `telefono_wapp` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_usuarios`
--

DROP TABLE IF EXISTS `ll_usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cliente_id` int(11) DEFAULT NULL,
  `usuario` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `tipo` enum('cliente','admin') DEFAULT 'cliente',
  `activo` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario` (`usuario`),
  KEY `cliente_id` (`cliente_id`),
  CONSTRAINT `ll_usuarios_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `llxbx_societe` (`rowid`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_usuarios_wa`
--

DROP TABLE IF EXISTS `ll_usuarios_wa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_usuarios_wa` (
  `telefono` varchar(20) NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `rubro_id` int(11) DEFAULT NULL,
  `ultima_interaccion` datetime DEFAULT NULL,
  `fuente` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`telefono`),
  KEY `fk_rubro` (`rubro_id`),
  CONSTRAINT `fk_rubro` FOREIGN KEY (`rubro_id`) REFERENCES `ll_rubros` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ll_zonas`
--

DROP TABLE IF EXISTS `ll_zonas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ll_zonas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `latitud` decimal(10,7) NOT NULL,
  `longitud` decimal(10,7) NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `busqueda` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 13:16:17
