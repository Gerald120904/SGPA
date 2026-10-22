import { MigrationInterface, QueryRunner } from 'typeorm';

export const LEGACY_REQUIRED_COLUMNS = {
  "area_carreras": [
    "id",
    "area_academica_id",
    "carrera_id"
  ],
  "areas_academicas": [
    "id",
    "codigo",
    "nombre",
    "descripcion",
    "activo",
    "created_at",
    "updated_at"
  ],
  "areas_perfiles_academicos": [
    "id",
    "perfil_academico_id",
    "tipo",
    "descripcion",
    "orden"
  ],
  "asignaciones_academicas": [
    "id",
    "usuario_id",
    "tipo",
    "carrera_id",
    "area_academica_id",
    "fecha_inicio",
    "fecha_fin",
    "activo",
    "created_at",
    "updated_at"
  ],
  "atestados_profesor": [
    "id",
    "profesor_usuario_id",
    "tipo",
    "nombre",
    "institucion",
    "fecha_obtencion",
    "descripcion",
    "estado",
    "revisado_por_usuario_id",
    "fecha_revision",
    "observacion_revision",
    "created_at",
    "updated_at",
    "fecha_inicio",
    "fecha_fin"
  ],
  "auditorias_aulas": [
    "id",
    "aula_id",
    "usuario_id",
    "accion",
    "entidad",
    "entidad_id",
    "detalle",
    "created_at"
  ],
  "aula_equipamientos": [
    "id",
    "aula_id",
    "equipamiento_id",
    "observaciones",
    "activo",
    "created_at",
    "updated_at",
    "cantidad_asignada",
    "asignado_en",
    "retirado_en"
  ],
  "aulas": [
    "id",
    "codigo",
    "nombre",
    "ubicacion",
    "capacidad",
    "tipo",
    "tipo_mobiliario",
    "origen",
    "activo",
    "created_at",
    "updated_at"
  ],
  "bloques_disponibilidad_profesor": [
    "id",
    "disponibilidad_id",
    "dia",
    "hora_inicio",
    "hora_fin",
    "created_at",
    "updated_at"
  ],
  "bloques_plan": [
    "id",
    "plan_estudio_id",
    "codigo",
    "nombre",
    "tipo",
    "orden",
    "descripcion",
    "activo",
    "created_at",
    "updated_at"
  ],
  "carreras": [
    "id",
    "codigo",
    "nombre",
    "descripcion",
    "activo",
    "created_at",
    "updated_at"
  ],
  "cumplimientos_requisitos_profesor": [
    "id",
    "profesor_perfil_academico_id",
    "requisito_perfil_academico_id",
    "estado",
    "observacion_profesor",
    "observacion_revision",
    "revisado_por_usuario_id",
    "fecha_revision",
    "created_at",
    "updated_at"
  ],
  "curso_carreras": [
    "curso_id",
    "carrera_id"
  ],
  "curso_optativas": [
    "id",
    "curso_id",
    "tipo",
    "carrera_origen_id",
    "activo",
    "created_at",
    "updated_at"
  ],
  "curso_perfiles_academicos": [
    "id",
    "curso_id",
    "perfil_academico_id",
    "activo",
    "created_at"
  ],
  "curso_requisitos": [
    "id",
    "curso_id",
    "requisito_curso_id",
    "tipo",
    "created_at"
  ],
  "cursos": [
    "id",
    "codigo",
    "nombre",
    "descripcion",
    "activo",
    "created_at",
    "updated_at"
  ],
  "disponibilidades_aulas": [
    "id",
    "aula_id",
    "periodo_id",
    "dia_semana",
    "hora_inicio",
    "hora_fin",
    "created_at",
    "updated_at"
  ],
  "disponibilidades_profesor": [
    "id",
    "profesor_usuario_id",
    "periodo_academico_id",
    "estado",
    "observaciones",
    "created_at",
    "updated_at"
  ],
  "equipamientos": [
    "id",
    "nombre",
    "descripcion",
    "activo",
    "created_at",
    "updated_at",
    "cantidad_total"
  ],
  "estudiantes": [
    "id",
    "cedula",
    "nombres",
    "apellido1",
    "apellido2",
    "correo_institucional",
    "telefono",
    "carrera_id",
    "plan_estudio_id",
    "periodo_ingreso_id",
    "estado",
    "created_at",
    "updated_at"
  ],
  "evidencias_requisitos_profesor": [
    "id",
    "cumplimiento_requisito_id",
    "atestado_profesor_id",
    "created_at"
  ],
  "formularios_estudiantes": [
    "id",
    "titulo",
    "descripcion",
    "carrera_id",
    "plan_estudio_id",
    "google_form_id",
    "responder_uri",
    "estado",
    "mapa_preguntas",
    "detalle_error",
    "ultima_sincronizacion_at",
    "creado_por_usuario_id",
    "created_at",
    "updated_at"
  ],
  "google_conexiones_usuario": [
    "id",
    "usuario_id",
    "google_email",
    "google_subject",
    "refresh_token_cifrado",
    "scopes",
    "activo",
    "conectado_at",
    "revocado_at",
    "created_at",
    "updated_at"
  ],
  "google_oauth_estados": [
    "id",
    "usuario_id",
    "state_hash",
    "code_verifier_cifrado",
    "expira_at",
    "usado_at",
    "created_at"
  ],
  "historial_academico_estudiantes": [
    "id",
    "estudiante_id",
    "plan_asignatura_id",
    "periodo_id",
    "resultado",
    "origen_academico",
    "fuente_registro",
    "observaciones",
    "registrado_por_usuario_id",
    "created_at"
  ],
  "historial_disponibilidad_profesor": [
    "id",
    "disponibilidad_id",
    "usuario_id",
    "accion",
    "datos_anteriores",
    "datos_nuevos",
    "created_at"
  ],
  "historial_perfil_profesor": [
    "id",
    "profesor_usuario_id",
    "usuario_accion_id",
    "curso_id",
    "perfil_academico_id",
    "tipo",
    "accion",
    "datos_anteriores",
    "datos_nuevos",
    "created_at"
  ],
  "historial_planes_estudiantes": [
    "id",
    "estudiante_id",
    "plan_anterior_id",
    "plan_nuevo_id",
    "periodo_cambio_id",
    "motivo",
    "cambiado_por_usuario_id",
    "created_at"
  ],
  "indisponibilidades_aulas": [
    "id",
    "aula_id",
    "tipo",
    "fecha_hora_inicio",
    "fecha_hora_fin",
    "motivo",
    "activo",
    "created_at",
    "updated_at"
  ],
  "perfiles_academicos": [
    "id",
    "carrera_id",
    "codigo",
    "nombre",
    "descripcion",
    "activo",
    "created_at",
    "updated_at",
    "numero_perfil",
    "consecutivo",
    "acuerdo_aprobacion",
    "fecha_aprobacion",
    "tipo_registro"
  ],
  "periodos_academicos": [
    "id",
    "codigo",
    "nombre",
    "anio",
    "ciclo",
    "fecha_inicio",
    "fecha_fin",
    "fecha_limite_disponibilidad",
    "estado",
    "observaciones",
    "created_at",
    "updated_at"
  ],
  "plan_asignaturas": [
    "id",
    "plan_estudio_id",
    "curso_id",
    "nivel",
    "ciclo",
    "orden",
    "creditos",
    "horas_teoria",
    "horas_practica",
    "horas_laboratorio",
    "horas_gira",
    "horas_estudio_independiente",
    "horas_totales",
    "horas_docente",
    "observacion_horas",
    "tipo",
    "codigo_referencia",
    "nombre_referencia",
    "activo",
    "created_at",
    "updated_at",
    "tipo_optativa"
  ],
  "plan_requisitos": [
    "id",
    "asignatura_id",
    "requisito_asignatura_id",
    "tipo",
    "created_at"
  ],
  "planes_estudio": [
    "id",
    "carrera_id",
    "codigo",
    "nombre",
    "descripcion",
    "activo",
    "created_at",
    "updated_at",
    "grado"
  ],
  "profesor_carreras": [
    "id",
    "profesor_usuario_id",
    "carrera_id",
    "created_at"
  ],
  "profesor_cursos": [
    "id",
    "profesor_usuario_id",
    "curso_id",
    "estado",
    "solicitado_por_usuario_id",
    "revisado_por_usuario_id",
    "fecha_revision",
    "observacion_revision",
    "created_at",
    "updated_at"
  ],
  "profesor_perfiles_academicos": [
    "id",
    "profesor_usuario_id",
    "perfil_academico_id",
    "estado",
    "solicitado_por_usuario_id",
    "revisado_por_usuario_id",
    "fecha_revision",
    "observacion_revision",
    "created_at",
    "updated_at"
  ],
  "proyectos_profesor": [
    "id",
    "profesor_usuario_id",
    "nombre",
    "unidad",
    "rol",
    "fecha_inicio",
    "fecha_fin",
    "descripcion",
    "activo",
    "created_at",
    "updated_at"
  ],
  "reglas_optativas_plan": [
    "id",
    "plan_estudio_id",
    "minimo_disciplinarias_propias",
    "maximo_otras_areas",
    "cantidad_disciplinarias",
    "cantidad_abiertas",
    "cantidad_sede"
  ],
  "requisitos_perfiles_academicos": [
    "id",
    "perfil_academico_id",
    "tipo",
    "obligatorio",
    "descripcion",
    "orden"
  ],
  "reservas_aulas": [
    "id",
    "aula_id",
    "tipo",
    "titulo",
    "descripcion",
    "fecha_hora_inicio",
    "fecha_hora_fin",
    "activo",
    "created_at",
    "updated_at"
  ],
  "respuestas_formularios_estudiantes": [
    "id",
    "formulario_id",
    "google_response_id",
    "payload_json",
    "datos_normalizados_json",
    "estado",
    "detalle_error",
    "optativas_no_disciplinarias",
    "procesado_at",
    "revisado_por_usuario_id",
    "revisado_at",
    "motivo_rechazo",
    "created_at",
    "updated_at"
  ],
  "roles": [
    "id",
    "nombre",
    "descripcion",
    "activo",
    "created_at"
  ],
  "salida_academica_asignaturas": [
    "salida_academica_id",
    "plan_asignatura_id"
  ],
  "salidas_academicas": [
    "id",
    "plan_estudio_id",
    "codigo",
    "nombre",
    "tipo",
    "creditos_requeridos",
    "orden",
    "descripcion",
    "activo",
    "created_at",
    "updated_at"
  ],
  "usuario_permisos": [
    "id",
    "usuario_id",
    "permiso",
    "activo",
    "created_at"
  ],
  "usuario_roles": [
    "usuario_id",
    "rol_id",
    "created_at"
  ],
  "usuarios": [
    "id",
    "cedula",
    "nombres",
    "apellido1",
    "apellido2",
    "correo",
    "password_hash",
    "activo",
    "ultimo_acceso",
    "created_at",
    "updated_at",
    "password_reset_token_hash",
    "password_reset_expires_at"
  ]
} as const;
const EMPTY_SCHEMA_DDL = [
  "CREATE TABLE `area_carreras` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `area_academica_id` int unsigned NOT NULL,\n  `carrera_id` int unsigned NOT NULL,\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_area_carrera` (`area_academica_id`,`carrera_id`),\n  KEY `FK_12460e43cad65b1eeb55a202238` (`carrera_id`),\n  CONSTRAINT `FK_12460e43cad65b1eeb55a202238` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_376b6c9ada674087856c68aca39` FOREIGN KEY (`area_academica_id`) REFERENCES `areas_academicas` (`id`) ON DELETE RESTRICT\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `areas_academicas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_1b653aeb92d11c9d093ff5c7f9` (`codigo`),\n  UNIQUE KEY `IDX_dbb33dd20648764cc6502184e5` (`nombre`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `areas_perfiles_academicos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `perfil_academico_id` int unsigned NOT NULL,\n  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `orden` int unsigned NOT NULL DEFAULT '1',\n  PRIMARY KEY (`id`),\n  KEY `IDX_area_perfil_orden` (`perfil_academico_id`,`tipo`,`orden`),\n  CONSTRAINT `FK_a0da8970f0b2cf3967f99c1ccff` FOREIGN KEY (`perfil_academico_id`) REFERENCES `perfiles_academicos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `asignaciones_academicas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `usuario_id` int unsigned NOT NULL,\n  `tipo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `carrera_id` int unsigned DEFAULT NULL,\n  `area_academica_id` int unsigned DEFAULT NULL,\n  `fecha_inicio` date NOT NULL,\n  `fecha_fin` date DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_asignacion_usuario` (`usuario_id`),\n  KEY `FK_17e3a527164c2e0df0801da870c` (`carrera_id`),\n  KEY `FK_ad95003be57c01a8e3af44ac62d` (`area_academica_id`),\n  CONSTRAINT `FK_17e3a527164c2e0df0801da870c` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_9f9dcefd21bf3b92a43682287d3` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_ad95003be57c01a8e3af44ac62d` FOREIGN KEY (`area_academica_id`) REFERENCES `areas_academicas` (`id`) ON DELETE RESTRICT\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `atestados_profesor` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `profesor_usuario_id` int unsigned NOT NULL,\n  `tipo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `institucion` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `fecha_obtencion` date DEFAULT NULL,\n  `fecha_inicio` date DEFAULT NULL,\n  `fecha_fin` date DEFAULT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',\n  `revisado_por_usuario_id` int unsigned DEFAULT NULL,\n  `fecha_revision` datetime DEFAULT NULL,\n  `observacion_revision` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_atestados_profesor` (`profesor_usuario_id`),\n  KEY `FK_3d4bd161e2cef778187482f6d97` (`revisado_por_usuario_id`),\n  CONSTRAINT `FK_3d4bd161e2cef778187482f6d97` FOREIGN KEY (`revisado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_67242aeca28ec465c17191f68df` FOREIGN KEY (`profesor_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `auditoria_jerarquia` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `actor_usuario_id` int unsigned NOT NULL,\n  `objetivo_usuario_id` int unsigned NOT NULL,\n  `accion` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `detalle` json NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_auditoria_jerarquia_objetivo` (`objetivo_usuario_id`,`created_at`),\n  KEY `FK_auditoria_actor` (`actor_usuario_id`),\n  CONSTRAINT `FK_auditoria_actor` FOREIGN KEY (`actor_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_auditoria_objetivo` FOREIGN KEY (`objetivo_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `auditorias_aulas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `aula_id` int unsigned DEFAULT NULL,\n  `usuario_id` int unsigned DEFAULT NULL,\n  `accion` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `entidad` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `entidad_id` int unsigned DEFAULT NULL,\n  `detalle` text COLLATE utf8mb4_unicode_ci,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_auditorias_aulas_aula_fecha` (`aula_id`,`created_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `aula_equipamientos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `aula_id` int unsigned NOT NULL,\n  `equipamiento_id` int unsigned NOT NULL,\n  `cantidad_asignada` smallint unsigned NOT NULL,\n  `observaciones` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `asignado_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `retirado_en` datetime DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_aula_equipamientos_aula_equipamiento` (`aula_id`,`equipamiento_id`),\n  KEY `FK_d309fe2184cdff4f7e769fd8e02` (`equipamiento_id`),\n  CONSTRAINT `FK_78a01f1f93346284b5039718117` FOREIGN KEY (`aula_id`) REFERENCES `aulas` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `FK_d309fe2184cdff4f7e769fd8e02` FOREIGN KEY (`equipamiento_id`) REFERENCES `equipamientos` (`id`) ON DELETE RESTRICT\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `aulas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `ubicacion` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `capacidad` smallint unsigned NOT NULL,\n  `tipo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `tipo_mobiliario` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'SIN_ESPECIFICAR',\n  `origen` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `uq_aulas_codigo_origen` (`codigo`,`origen`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `bloques_disponibilidad_profesor` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `disponibilidad_id` int unsigned NOT NULL,\n  `dia` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `hora_inicio` time NOT NULL,\n  `hora_fin` time NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_bloque_disponibilidad_dia` (`disponibilidad_id`,`dia`),\n  CONSTRAINT `FK_e8086bff36e64778680045d1a8b` FOREIGN KEY (`disponibilidad_id`) REFERENCES `disponibilidades_profesor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `carreras` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_cf7a90274fea6f203c3aa4c6f6` (`codigo`),\n  UNIQUE KEY `IDX_6139c12dd008e21c0dc39c6184` (`nombre`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `cumplimientos_requisitos_profesor` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `profesor_perfil_academico_id` int unsigned NOT NULL,\n  `requisito_perfil_academico_id` int unsigned NOT NULL,\n  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',\n  `observacion_profesor` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `observacion_revision` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `revisado_por_usuario_id` int unsigned DEFAULT NULL,\n  `fecha_revision` datetime DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_cumplimiento_solicitud_requisito` (`profesor_perfil_academico_id`,`requisito_perfil_academico_id`),\n  KEY `FK_5fa7f4e537bd81566f595958e6b` (`requisito_perfil_academico_id`),\n  KEY `FK_dc49ef8628c7cb9bdb6df6e2630` (`revisado_por_usuario_id`),\n  CONSTRAINT `FK_5fa7f4e537bd81566f595958e6b` FOREIGN KEY (`requisito_perfil_academico_id`) REFERENCES `requisitos_perfiles_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_817be67c61b6b511612bad3a6cf` FOREIGN KEY (`profesor_perfil_academico_id`) REFERENCES `profesor_perfiles_academicos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT `FK_dc49ef8628c7cb9bdb6df6e2630` FOREIGN KEY (`revisado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `curso_carreras` (\n  `curso_id` int unsigned NOT NULL,\n  `carrera_id` int unsigned NOT NULL,\n  PRIMARY KEY (`curso_id`,`carrera_id`),\n  KEY `IDX_7de25a48e711189cdcbd3361e7` (`curso_id`),\n  KEY `IDX_176c20ae6db302ff27d795cd34` (`carrera_id`),\n  CONSTRAINT `FK_176c20ae6db302ff27d795cd34a` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT `FK_7de25a48e711189cdcbd3361e70` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `curso_optativas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `curso_id` int unsigned NOT NULL,\n  `tipo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `carrera_origen_id` int unsigned DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_curso_optativas_curso` (`curso_id`),\n  UNIQUE KEY `REL_f4ab69e6f9d5b0c109affda126` (`curso_id`),\n  KEY `FK_659a20ca95785f5cab7a8569433` (`carrera_origen_id`),\n  CONSTRAINT `FK_659a20ca95785f5cab7a8569433` FOREIGN KEY (`carrera_origen_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_f4ab69e6f9d5b0c109affda126b` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `curso_perfiles_academicos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `curso_id` int unsigned NOT NULL,\n  `perfil_academico_id` int unsigned NOT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_curso_perfil_academico` (`curso_id`,`perfil_academico_id`),\n  KEY `FK_6924c682f82522d188c8daa6010` (`perfil_academico_id`),\n  CONSTRAINT `FK_5b6d3a055874ee6722f4a077803` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_6924c682f82522d188c8daa6010` FOREIGN KEY (`perfil_academico_id`) REFERENCES `perfiles_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `curso_requisitos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `curso_id` int unsigned NOT NULL,\n  `requisito_curso_id` int unsigned NOT NULL,\n  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_curso_requisito_relacion` (`curso_id`,`requisito_curso_id`,`tipo`),\n  KEY `FK_256f555a5174f331a0038a63e8d` (`requisito_curso_id`),\n  CONSTRAINT `FK_256f555a5174f331a0038a63e8d` FOREIGN KEY (`requisito_curso_id`) REFERENCES `cursos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_55ce5dc26c4842c2427fb09e5d8` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `cursos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_2c7f33e90ac5d9a62879b6d4ca` (`codigo`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `dependencias_usuario` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `asistente_id` int unsigned NOT NULL,\n  `coordinador_id` int unsigned NOT NULL,\n  `creado_por_usuario_id` int unsigned NOT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `desactivado_en` datetime DEFAULT NULL,\n  `motivo_desactivacion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_dependencia_asistente` (`asistente_id`),\n  KEY `FK_dependencia_coordinador` (`coordinador_id`),\n  KEY `FK_dependencia_creador` (`creado_por_usuario_id`),\n  CONSTRAINT `FK_dependencia_asistente` FOREIGN KEY (`asistente_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_dependencia_coordinador` FOREIGN KEY (`coordinador_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_dependencia_creador` FOREIGN KEY (`creado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `disponibilidades_aulas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `aula_id` int unsigned NOT NULL,\n  `periodo_id` int unsigned NOT NULL,\n  `dia_semana` tinyint unsigned NOT NULL,\n  `hora_inicio` time NOT NULL,\n  `hora_fin` time NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_disponibilidades_aulas_aula_periodo_dia` (`aula_id`,`periodo_id`,`dia_semana`),\n  KEY `FK_e6967837d30cb79c50ce1e876ac` (`periodo_id`),\n  CONSTRAINT `FK_493255140a9986046b98b6832c7` FOREIGN KEY (`aula_id`) REFERENCES `aulas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT `FK_e6967837d30cb79c50ce1e876ac` FOREIGN KEY (`periodo_id`) REFERENCES `periodos_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `disponibilidades_profesor` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `profesor_usuario_id` int unsigned NOT NULL,\n  `periodo_academico_id` int unsigned NOT NULL,\n  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',\n  `observaciones` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_disponibilidad_profesor_periodo` (`profesor_usuario_id`,`periodo_academico_id`),\n  KEY `FK_987ee53c5fc9a565a1609b793ed` (`periodo_academico_id`),\n  CONSTRAINT `FK_6ace10a603618360b66b20cc3aa` FOREIGN KEY (`profesor_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_987ee53c5fc9a565a1609b793ed` FOREIGN KEY (`periodo_academico_id`) REFERENCES `periodos_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `equipamientos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `cantidad_total` smallint unsigned NOT NULL DEFAULT '0',\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_52959daef136cc737283297018` (`nombre`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `estudiantes` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `cedula` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombres` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `apellido1` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `apellido2` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `correo_institucional` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `carrera_id` int unsigned NOT NULL,\n  `plan_estudio_id` int unsigned NOT NULL,\n  `periodo_ingreso_id` int unsigned NOT NULL,\n  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVO',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_c3ac48e5a9835af980095b589a` (`cedula`),\n  UNIQUE KEY `IDX_91aadc6458fa6c3b1dd6befe15` (`correo_institucional`),\n  KEY `IDX_estudiantes_plan` (`plan_estudio_id`),\n  KEY `IDX_estudiantes_carrera` (`carrera_id`),\n  KEY `FK_f9284d2e5b887eb72b31f59aecc` (`periodo_ingreso_id`),\n  CONSTRAINT `FK_294ce5482d4c45dc823938aa207` FOREIGN KEY (`plan_estudio_id`) REFERENCES `planes_estudio` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_b1a14d87c128641261c2e049471` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_f9284d2e5b887eb72b31f59aecc` FOREIGN KEY (`periodo_ingreso_id`) REFERENCES `periodos_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `evidencias_requisitos_profesor` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `cumplimiento_requisito_id` int unsigned NOT NULL,\n  `atestado_profesor_id` int unsigned NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_evidencia_cumplimiento_atestado` (`cumplimiento_requisito_id`,`atestado_profesor_id`),\n  KEY `FK_8a543dcc5b07b799e9b6593db80` (`atestado_profesor_id`),\n  CONSTRAINT `FK_8a543dcc5b07b799e9b6593db80` FOREIGN KEY (`atestado_profesor_id`) REFERENCES `atestados_profesor` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_ad1a5ae4054a2202ca5e9c530cc` FOREIGN KEY (`cumplimiento_requisito_id`) REFERENCES `cumplimientos_requisitos_profesor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `formularios_estudiantes` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `titulo` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` text COLLATE utf8mb4_unicode_ci NOT NULL,\n  `carrera_id` int unsigned NOT NULL,\n  `plan_estudio_id` int unsigned NOT NULL,\n  `google_form_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `responder_uri` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `proveedor` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GOOGLE_FORMS',\n  `token_publico` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `estado` enum('CREANDO','PUBLICADO','CERRADO','ERROR') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREANDO',\n  `mapa_preguntas` json DEFAULT NULL,\n  `detalle_error` text COLLATE utf8mb4_unicode_ci,\n  `ultima_sincronizacion_at` datetime DEFAULT NULL,\n  `creado_por_usuario_id` int unsigned NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_formulario_google_form_id` (`google_form_id`),\n  UNIQUE KEY `UQ_formularios_token_publico` (`token_publico`),\n  UNIQUE KEY `IDX_52fe1af1baadf512514231a18a` (`google_form_id`),\n  KEY `FK_dd2b5cf629e7d5c67a7260b4d07` (`carrera_id`),\n  KEY `FK_2a1c7b6e75e14dd8918532cee1f` (`plan_estudio_id`),\n  KEY `FK_e96e5ee4b978ed61aa2d5072c0a` (`creado_por_usuario_id`),\n  CONSTRAINT `FK_2a1c7b6e75e14dd8918532cee1f` FOREIGN KEY (`plan_estudio_id`) REFERENCES `planes_estudio` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_dd2b5cf629e7d5c67a7260b4d07` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_e96e5ee4b978ed61aa2d5072c0a` FOREIGN KEY (`creado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `google_conexiones_usuario` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `usuario_id` int unsigned NOT NULL,\n  `google_email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `google_subject` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `refresh_token_cifrado` text COLLATE utf8mb4_unicode_ci,\n  `scopes` json NOT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `conectado_at` datetime NOT NULL,\n  `revocado_at` datetime DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_68175e8400a43939cb0e517cb2` (`usuario_id`),\n  CONSTRAINT `FK_68175e8400a43939cb0e517cb22` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `google_oauth_estados` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `usuario_id` int unsigned NOT NULL,\n  `state_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `code_verifier_cifrado` text COLLATE utf8mb4_unicode_ci NOT NULL,\n  `expira_at` datetime NOT NULL,\n  `usado_at` datetime DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_google_oauth_estado_hash` (`state_hash`),\n  KEY `FK_fd85609fd5084043ab817a4dfe9` (`usuario_id`),\n  CONSTRAINT `FK_fd85609fd5084043ab817a4dfe9` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `grupos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `curso_id` int unsigned NOT NULL,\n  `periodo_id` int unsigned NOT NULL,\n  `profesor_id` int unsigned DEFAULT NULL,\n  `numero_grupo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `tipo_grupo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `cupo_maximo` smallint unsigned NOT NULL,\n  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `uq_grupo_curso_periodo` (`curso_id`,`periodo_id`,`numero_grupo`),\n  KEY `fk_grupo_profesor` (`profesor_id`),\n  KEY `idx_grupo_periodo` (`periodo_id`),\n  CONSTRAINT `FK_grupo_curso` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_grupo_periodo` FOREIGN KEY (`periodo_id`) REFERENCES `periodos_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `historial_academico_estudiantes` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `estudiante_id` int unsigned NOT NULL,\n  `plan_asignatura_id` int unsigned NOT NULL,\n  `periodo_id` int unsigned DEFAULT NULL,\n  `resultado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `origen_academico` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `fuente_registro` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `observaciones` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `registrado_por_usuario_id` int unsigned NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_historial_academico_estudiante_asignatura` (`estudiante_id`,`plan_asignatura_id`),\n  KEY `FK_9983062ddf2cb99911bf392f6e9` (`plan_asignatura_id`),\n  KEY `FK_e1e3870bd4fd404cc2cb13e2f80` (`periodo_id`),\n  KEY `FK_c5d919835e50b05960da113e1c7` (`registrado_por_usuario_id`),\n  CONSTRAINT `FK_41d3480c63c3dfe4e404abb0c58` FOREIGN KEY (`estudiante_id`) REFERENCES `estudiantes` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_9983062ddf2cb99911bf392f6e9` FOREIGN KEY (`plan_asignatura_id`) REFERENCES `plan_asignaturas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_c5d919835e50b05960da113e1c7` FOREIGN KEY (`registrado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_e1e3870bd4fd404cc2cb13e2f80` FOREIGN KEY (`periodo_id`) REFERENCES `periodos_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `historial_disponibilidad_profesor` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `disponibilidad_id` int unsigned NOT NULL,\n  `usuario_id` int unsigned NOT NULL,\n  `accion` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `datos_anteriores` json DEFAULT NULL,\n  `datos_nuevos` json DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_historial_disponibilidad` (`disponibilidad_id`),\n  KEY `FK_863cfe05d11eb525d5efa992dac` (`usuario_id`),\n  CONSTRAINT `FK_1ab036e524957f6f6ad792f01cf` FOREIGN KEY (`disponibilidad_id`) REFERENCES `disponibilidades_profesor` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_863cfe05d11eb525d5efa992dac` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `historial_perfil_profesor` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `profesor_usuario_id` int unsigned NOT NULL,\n  `usuario_accion_id` int unsigned NOT NULL,\n  `curso_id` int unsigned DEFAULT NULL,\n  `perfil_academico_id` int unsigned DEFAULT NULL,\n  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `accion` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `datos_anteriores` json DEFAULT NULL,\n  `datos_nuevos` json DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_historial_perfil_profesor` (`profesor_usuario_id`),\n  KEY `FK_ae2d0da0f3fe25ee939966b3e77` (`usuario_accion_id`),\n  KEY `FK_4a3415f32f43895ea8597a646b1` (`curso_id`),\n  KEY `FK_0400301cffdc8a50adafe374a15` (`perfil_academico_id`),\n  CONSTRAINT `FK_0400301cffdc8a50adafe374a15` FOREIGN KEY (`perfil_academico_id`) REFERENCES `perfiles_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_4a3415f32f43895ea8597a646b1` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_ae2d0da0f3fe25ee939966b3e77` FOREIGN KEY (`usuario_accion_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_e16e45dc1eeeaaf19311b146691` FOREIGN KEY (`profesor_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `historial_planes_estudiantes` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `estudiante_id` int unsigned NOT NULL,\n  `plan_anterior_id` int unsigned NOT NULL,\n  `plan_nuevo_id` int unsigned NOT NULL,\n  `periodo_cambio_id` int unsigned NOT NULL,\n  `motivo` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `cambiado_por_usuario_id` int unsigned NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_historial_planes_estudiante` (`estudiante_id`),\n  KEY `FK_abeda51a60238c11c2a673a70a3` (`plan_anterior_id`),\n  KEY `FK_6342d55a310f91d4dc5db2cf7cd` (`plan_nuevo_id`),\n  KEY `FK_61590c64ddd3af1624d150bf416` (`periodo_cambio_id`),\n  KEY `FK_2daf161ef6d02998091630f78b6` (`cambiado_por_usuario_id`),\n  CONSTRAINT `FK_2daf161ef6d02998091630f78b6` FOREIGN KEY (`cambiado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_549d71ba598c0b1842261d07d13` FOREIGN KEY (`estudiante_id`) REFERENCES `estudiantes` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_61590c64ddd3af1624d150bf416` FOREIGN KEY (`periodo_cambio_id`) REFERENCES `periodos_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_6342d55a310f91d4dc5db2cf7cd` FOREIGN KEY (`plan_nuevo_id`) REFERENCES `planes_estudio` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_abeda51a60238c11c2a673a70a3` FOREIGN KEY (`plan_anterior_id`) REFERENCES `planes_estudio` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `horarios_grupo` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `grupo_id` int unsigned NOT NULL,\n  `aula_id` int unsigned DEFAULT NULL,\n  `dia_semana` tinyint unsigned NOT NULL,\n  `hora_inicio` time NOT NULL,\n  `hora_fin` time NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `fk_horario_grupo_aula` (`aula_id`),\n  KEY `fk_horario_grupo_grupo` (`grupo_id`),\n  CONSTRAINT `FK_horario_aula` FOREIGN KEY (`aula_id`) REFERENCES `aulas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,\n  CONSTRAINT `FK_horario_grupo` FOREIGN KEY (`grupo_id`) REFERENCES `grupos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `indisponibilidades_aulas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `aula_id` int unsigned NOT NULL,\n  `tipo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `fecha_hora_inicio` datetime NOT NULL,\n  `fecha_hora_fin` datetime NOT NULL,\n  `motivo` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_indisponibilidades_aulas_aula_inicio_fin` (`aula_id`,`fecha_hora_inicio`,`fecha_hora_fin`),\n  CONSTRAINT `FK_0f22a52fae4c9a9bd333a121c4d` FOREIGN KEY (`aula_id`) REFERENCES `aulas` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `invitacion_outbox` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `usuario_id` int unsigned NOT NULL,\n  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `enlace_cifrado` text COLLATE utf8mb4_unicode_ci,\n  `estado` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `intentos` smallint unsigned NOT NULL DEFAULT '0',\n  `lease_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `bloqueado_hasta` datetime(3) DEFAULT NULL,\n  `expira_en` datetime(3) NOT NULL,\n  `enviado_en` datetime(3) DEFAULT NULL,\n  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),\n  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_c908f31ae39be47c676a4d3ec9` (`usuario_id`),\n  CONSTRAINT `FK_invitacion_outbox_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `perfiles_academicos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `carrera_id` int unsigned NOT NULL,\n  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `numero_perfil` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `consecutivo` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `acuerdo_aprobacion` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `fecha_aprobacion` date DEFAULT NULL,\n  `tipo_registro` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_perfiles_academicos_carrera_codigo` (`carrera_id`,`codigo`),\n  CONSTRAINT `FK_5832760958d30a60baf4438fa55` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `periodos_academicos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `anio` smallint unsigned NOT NULL,\n  `ciclo` tinyint unsigned NOT NULL,\n  `fecha_inicio` date NOT NULL,\n  `fecha_fin` date NOT NULL,\n  `fecha_limite_disponibilidad` date NOT NULL,\n  `estado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BORRADOR',\n  `observaciones` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_periodos_academicos_anio_ciclo` (`anio`,`ciclo`),\n  UNIQUE KEY `IDX_f7993aa410473e3af6b4f51ebc` (`codigo`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `permisos_carrera` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `usuario_id` int unsigned NOT NULL,\n  `carrera_id` int unsigned NOT NULL,\n  `permiso` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_permiso_carrera` (`usuario_id`,`carrera_id`,`permiso`),\n  KEY `FK_permiso_carrera_carrera` (`carrera_id`),\n  CONSTRAINT `FK_permiso_carrera_carrera` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_permiso_carrera_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `plan_asignaturas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `plan_estudio_id` int unsigned NOT NULL,\n  `curso_id` int unsigned DEFAULT NULL,\n  `nivel` smallint unsigned NOT NULL,\n  `ciclo` smallint unsigned NOT NULL,\n  `orden` smallint unsigned NOT NULL,\n  `creditos` smallint unsigned NOT NULL DEFAULT '0',\n  `horas_teoria` decimal(5,2) DEFAULT NULL,\n  `horas_practica` decimal(5,2) DEFAULT NULL,\n  `horas_laboratorio` decimal(5,2) DEFAULT NULL,\n  `horas_gira` decimal(5,2) DEFAULT NULL,\n  `horas_estudio_independiente` decimal(5,2) DEFAULT NULL,\n  `horas_totales` decimal(5,2) DEFAULT NULL,\n  `horas_docente` decimal(5,2) DEFAULT NULL,\n  `observacion_horas` varchar(250) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `tipo_optativa` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `codigo_referencia` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `nombre_referencia` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_plan_asignaturas_orden` (`plan_estudio_id`,`nivel`,`ciclo`,`orden`),\n  KEY `FK_cb31abd440af4118b711f083ae8` (`curso_id`),\n  CONSTRAINT `FK_917daf1dbbb71055838a1b340e1` FOREIGN KEY (`plan_estudio_id`) REFERENCES `planes_estudio` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_cb31abd440af4118b711f083ae8` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `plan_requisitos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `asignatura_id` int unsigned NOT NULL,\n  `requisito_asignatura_id` int unsigned NOT NULL,\n  `tipo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_plan_requisito_relacion` (`asignatura_id`,`requisito_asignatura_id`,`tipo`),\n  KEY `FK_53baa5a9f11b17310b8bf2ac370` (`requisito_asignatura_id`),\n  CONSTRAINT `FK_53baa5a9f11b17310b8bf2ac370` FOREIGN KEY (`requisito_asignatura_id`) REFERENCES `plan_asignaturas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_6f5b6cfa5f9ca19fd29cd50ad29` FOREIGN KEY (`asignatura_id`) REFERENCES `plan_asignaturas` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `planes_estudio` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `carrera_id` int unsigned NOT NULL,\n  `grado` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `codigo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_planes_estudio_carrera_codigo` (`carrera_id`,`codigo`),\n  CONSTRAINT `FK_182623a0456b346b7fce27a54f1` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `profesor_carreras` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `profesor_usuario_id` int unsigned NOT NULL,\n  `carrera_id` int unsigned NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_profesor_carreras_profesor_carrera` (`profesor_usuario_id`,`carrera_id`),\n  KEY `FK_f287d1826c41422e745b1ba35d0` (`carrera_id`),\n  CONSTRAINT `FK_0df31e53f46169513cdfd265d9e` FOREIGN KEY (`profesor_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_f287d1826c41422e745b1ba35d0` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `profesor_cursos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `profesor_usuario_id` int unsigned NOT NULL,\n  `curso_id` int unsigned NOT NULL,\n  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',\n  `solicitado_por_usuario_id` int unsigned NOT NULL,\n  `revisado_por_usuario_id` int unsigned DEFAULT NULL,\n  `fecha_revision` datetime DEFAULT NULL,\n  `observacion_revision` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_profesor_cursos_profesor_curso` (`profesor_usuario_id`,`curso_id`),\n  KEY `FK_f7a5200718b356e4dee0e0e508d` (`curso_id`),\n  KEY `FK_37dcf310d31a19291162ff18a98` (`solicitado_por_usuario_id`),\n  KEY `FK_19a0252bab59710bd1f314fc2aa` (`revisado_por_usuario_id`),\n  CONSTRAINT `FK_19a0252bab59710bd1f314fc2aa` FOREIGN KEY (`revisado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_37dcf310d31a19291162ff18a98` FOREIGN KEY (`solicitado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_a09e069f9fc23faa7e58de76084` FOREIGN KEY (`profesor_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_f7a5200718b356e4dee0e0e508d` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `profesor_perfiles_academicos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `profesor_usuario_id` int unsigned NOT NULL,\n  `perfil_academico_id` int unsigned NOT NULL,\n  `estado` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',\n  `solicitado_por_usuario_id` int unsigned NOT NULL,\n  `revisado_por_usuario_id` int unsigned DEFAULT NULL,\n  `fecha_revision` datetime DEFAULT NULL,\n  `observacion_revision` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_profesor_perfil_academico` (`profesor_usuario_id`,`perfil_academico_id`),\n  KEY `FK_dc84afda2c5b546b299b853b0f9` (`perfil_academico_id`),\n  KEY `FK_b96bb059fa66b04b29b581dd2f5` (`solicitado_por_usuario_id`),\n  KEY `FK_02b314157127f63b48d14e9440a` (`revisado_por_usuario_id`),\n  CONSTRAINT `FK_000ffd858163cb77864a6fb82b5` FOREIGN KEY (`profesor_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_02b314157127f63b48d14e9440a` FOREIGN KEY (`revisado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_b96bb059fa66b04b29b581dd2f5` FOREIGN KEY (`solicitado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,\n  CONSTRAINT `FK_dc84afda2c5b546b299b853b0f9` FOREIGN KEY (`perfil_academico_id`) REFERENCES `perfiles_academicos` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `proyectos_profesor` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `profesor_usuario_id` int unsigned NOT NULL,\n  `nombre` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `unidad` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `rol` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `fecha_inicio` date DEFAULT NULL,\n  `fecha_fin` date DEFAULT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_proyectos_profesor` (`profesor_usuario_id`),\n  CONSTRAINT `FK_1a9d29b22298e06926004b2be25` FOREIGN KEY (`profesor_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `reglas_optativas_plan` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `plan_estudio_id` int unsigned NOT NULL,\n  `cantidad_disciplinarias` smallint unsigned NOT NULL DEFAULT '0',\n  `cantidad_abiertas` smallint unsigned NOT NULL DEFAULT '0',\n  `cantidad_sede` smallint unsigned NOT NULL DEFAULT '0',\n  `minimo_disciplinarias_propias` smallint unsigned NOT NULL DEFAULT '0',\n  `maximo_otras_areas` smallint unsigned DEFAULT NULL,\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_reglas_optativas_plan` (`plan_estudio_id`),\n  UNIQUE KEY `REL_382fc0a53bbd85256d28874c53` (`plan_estudio_id`),\n  CONSTRAINT `FK_382fc0a53bbd85256d28874c53e` FOREIGN KEY (`plan_estudio_id`) REFERENCES `planes_estudio` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `requisitos_perfiles_academicos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `perfil_academico_id` int unsigned NOT NULL,\n  `tipo` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `obligatorio` tinyint NOT NULL,\n  `descripcion` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `orden` int unsigned NOT NULL DEFAULT '1',\n  PRIMARY KEY (`id`),\n  KEY `IDX_requisito_perfil_orden` (`perfil_academico_id`,`obligatorio`,`orden`),\n  CONSTRAINT `FK_f5327b80842d6f12c8826481113` FOREIGN KEY (`perfil_academico_id`) REFERENCES `perfiles_academicos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `reservas_aulas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `aula_id` int unsigned NOT NULL,\n  `tipo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `titulo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `fecha_hora_inicio` datetime NOT NULL,\n  `fecha_hora_fin` datetime NOT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  KEY `IDX_reservas_aulas_aula_inicio_fin` (`aula_id`,`fecha_hora_inicio`,`fecha_hora_fin`),\n  CONSTRAINT `FK_2f88e47fcce3c9fdf6236479cb4` FOREIGN KEY (`aula_id`) REFERENCES `aulas` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `respuestas_formularios_estudiantes` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `formulario_id` int unsigned NOT NULL,\n  `google_response_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `payload_json` json NOT NULL,\n  `datos_normalizados_json` json DEFAULT NULL,\n  `estado` enum('PENDIENTE','PROCESADO','RECHAZADO','REQUIERE_REVISION','ERROR') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',\n  `detalle_error` text COLLATE utf8mb4_unicode_ci,\n  `optativas_no_disciplinarias` text COLLATE utf8mb4_unicode_ci,\n  `procesado_at` datetime DEFAULT NULL,\n  `revisado_por_usuario_id` int unsigned DEFAULT NULL,\n  `revisado_at` datetime DEFAULT NULL,\n  `motivo_rechazo` text COLLATE utf8mb4_unicode_ci,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_formulario_google_response` (`formulario_id`,`google_response_id`),\n  KEY `FK_7914e2fc6878e035b1954a261ba` (`revisado_por_usuario_id`),\n  CONSTRAINT `FK_7914e2fc6878e035b1954a261ba` FOREIGN KEY (`revisado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,\n  CONSTRAINT `FK_e6d66b5a69a61eb644537bfca9f` FOREIGN KEY (`formulario_id`) REFERENCES `formularios_estudiantes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `roles` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_a5be7aa67e759e347b1c6464e1` (`nombre`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `salida_academica_asignaturas` (\n  `salida_academica_id` int unsigned NOT NULL,\n  `plan_asignatura_id` int unsigned NOT NULL,\n  PRIMARY KEY (`salida_academica_id`,`plan_asignatura_id`),\n  KEY `IDX_a83e5fd80db108d3daccb495b6` (`salida_academica_id`),\n  KEY `IDX_1e4af4898f8cd629b7ebecb17d` (`plan_asignatura_id`),\n  CONSTRAINT `FK_1e4af4898f8cd629b7ebecb17d9` FOREIGN KEY (`plan_asignatura_id`) REFERENCES `plan_asignaturas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT `FK_a83e5fd80db108d3daccb495b6b` FOREIGN KEY (`salida_academica_id`) REFERENCES `salidas_academicas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `salidas_academicas` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `plan_estudio_id` int unsigned NOT NULL,\n  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombre` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `tipo` varchar(25) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `creditos_requeridos` smallint unsigned NOT NULL,\n  `orden` smallint unsigned NOT NULL DEFAULT '1',\n  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_salidas_academicas_plan_codigo` (`plan_estudio_id`,`codigo`),\n  CONSTRAINT `FK_aa9dd59dd8c373203210a5c3a89` FOREIGN KEY (`plan_estudio_id`) REFERENCES `planes_estudio` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `solicitudes_cambio` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `solicitante_id` int unsigned NOT NULL,\n  `coordinador_id` int unsigned NOT NULL,\n  `carrera_id` int unsigned NOT NULL,\n  `modulo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `operacion` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `objetivo_id` int unsigned DEFAULT NULL,\n  `datos_propuestos` json NOT NULL,\n  `huella_original` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `estado` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `resuelto_en` datetime DEFAULT NULL,\n  `resuelto_por_usuario_id` int unsigned DEFAULT NULL,\n  `motivo_rechazo` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `correlacion_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `resultado_aplicado` json DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_12811adaa586cfd56925a295d2` (`correlacion_id`),\n  KEY `IDX_solicitud_solicitante` (`solicitante_id`),\n  KEY `IDX_solicitud_responsable_estado` (`coordinador_id`,`estado`),\n  KEY `FK_solicitud_carrera` (`carrera_id`),\n  KEY `FK_solicitud_resolutor` (`resuelto_por_usuario_id`),\n  CONSTRAINT `FK_solicitud_carrera` FOREIGN KEY (`carrera_id`) REFERENCES `carreras` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_solicitud_coordinador` FOREIGN KEY (`coordinador_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_solicitud_resolutor` FOREIGN KEY (`resuelto_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,\n  CONSTRAINT `FK_solicitud_solicitante` FOREIGN KEY (`solicitante_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `usuario_permiso_excepciones` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `usuario_id` int unsigned NOT NULL,\n  `permiso` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `tipo` enum('CONCEDER','DENEGAR') COLLATE utf8mb4_unicode_ci NOT NULL,\n  `motivo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `asignado_por_usuario_id` int unsigned DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_usuario_permiso_excepcion` (`usuario_id`,`permiso`),\n  KEY `FK_excepcion_asignador` (`asignado_por_usuario_id`),\n  CONSTRAINT `FK_excepcion_asignador` FOREIGN KEY (`asignado_por_usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,\n  CONSTRAINT `FK_excepcion_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `usuario_permisos` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `usuario_id` int unsigned NOT NULL,\n  `permiso` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `UQ_usuario_permiso` (`usuario_id`,`permiso`),\n  CONSTRAINT `FK_e62cb45e771719fa20c9171c4c2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `usuario_roles` (\n  `usuario_id` int unsigned NOT NULL,\n  `rol_id` int unsigned NOT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`usuario_id`,`rol_id`),\n  KEY `FK_0a60de73dab09515692949c13a5` (`rol_id`),\n  CONSTRAINT `FK_0a60de73dab09515692949c13a5` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,\n  CONSTRAINT `FK_f4660653ecea0eef621bae52097` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE `usuarios` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT,\n  `cedula` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `nombres` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `apellido1` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `apellido2` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `correo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,\n  `password_reset_token_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,\n  `password_reset_expires_at` datetime DEFAULT NULL,\n  `activo` tinyint NOT NULL DEFAULT '1',\n  `ultimo_acceso` datetime DEFAULT NULL,\n  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),\n  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `IDX_d0a04a74cdb68388fa196a5ba5` (`cedula`),\n  UNIQUE KEY `IDX_63665765c1a778a770c9bd585d` (`correo`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
] as const;

/** Installs the versioned schema on an empty database or validates a legacy base before adoption. */
export class InitializeOrAdoptSchema2026101400000 implements MigrationInterface {
  name = 'InitializeOrAdoptSchema2026101400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      "SELECT TABLE_NAME AS name, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> 'migrations' ORDER BY TABLE_NAME, ORDINAL_POSITION",
    )) as Array<{ name: string; columnName: string }>;
    const existing = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!existing.has(row.name)) existing.set(row.name, new Set());
      existing.get(row.name)!.add(row.columnName);
    }

    if (existing.size > 0) {
      const differences: string[] = [];
      for (const [table, columns] of Object.entries(LEGACY_REQUIRED_COLUMNS)) {
        if (!existing.has(table)) {
          differences.push(`${table} (tabla)`);
          continue;
        }
        for (const column of columns) {
          if (!existing.get(table)!.has(column)) differences.push(`${table}.${column}`);
        }
      }
      if (differences.length) {
        throw new Error(`La base existente no puede adoptar la migración base; faltan objetos legacy requeridos: ${differences.join(', ')}.`);
      }
      return;
    }

    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const ddl of EMPTY_SCHEMA_DDL) await queryRunner.query(ddl);
    } finally {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }

  async down(): Promise<void> {
    throw new Error('La migración base no admite reversión destructiva.');
  }
}
