import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guardarSesion,
  limpiarSesion,
  obtenerUsuario,
  obtenerRolActivo,
  obtenerRolesEfectivos,
  usuarioTienePermiso
} from '../src/app/session.js';
import { puedeAcceder, ROLES, PERMISOS } from '../src/config/permissions.js';
import { MODULES } from '../src/config/modules.js';
import { Sidebar } from '../src/components/Sidebar.js';
import { ModulesPage } from '../src/pages/modules/ModulesPage.js';
import { HomePage } from '../src/pages/home/HomePage.js';

test('1. Permisos y roles efectivos: una sola fuente de verdad basada en rol activo', () => {
  limpiarSesion();

  // Usuario con múltiples roles asignados (ADMIN_GLOBAL y COORDINADOR)
  const usuarioMultiRol = {
    id: 10,
    nombres: 'María Coordinadora',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
    rolActivo: ROLES.COORDINADOR,
    permisos: [
      PERMISOS.ESTUDIANTES_VER,
      PERMISOS.PERIODOS_VER,
      PERMISOS.AULAS_VER
    ]
  };

  guardarSesion({ usuario: usuarioMultiRol });

  assert.equal(obtenerRolActivo(), ROLES.COORDINADOR);
  assert.deepEqual(obtenerRolesEfectivos(), [ROLES.COORDINADOR]);

  // En rol activo COORDINADOR, NO debe heredar facultades de ADMIN_GLOBAL
  assert.equal(puedeAcceder(obtenerRolesEfectivos(), 'usuarios', usuarioMultiRol.permisos), false);
  assert.equal(puedeAcceder(obtenerRolesEfectivos(), 'carreras', usuarioMultiRol.permisos), false);

  // Módulos explícitamente permitidos para el rol activo
  assert.equal(puedeAcceder(obtenerRolesEfectivos(), 'estudiantes', usuarioMultiRol.permisos), true);
  assert.equal(puedeAcceder(obtenerRolesEfectivos(), 'periodos', usuarioMultiRol.permisos), true);
  assert.equal(puedeAcceder(obtenerRolesEfectivos(), 'aulas', usuarioMultiRol.permisos), true);

  limpiarSesion();
});

test('2. Menú lateral (Sidebar): muestra exclusivamente los módulos autorizados para el rol activo', () => {
  limpiarSesion();

  const usuarioCoordinador = {
    id: 20,
    nombres: 'Carlos Coord',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
    rolActivo: ROLES.COORDINADOR,
    permisos: [PERMISOS.ESTUDIANTES_VER, PERMISOS.PERIODOS_VER]
  };

  guardarSesion({ usuario: usuarioCoordinador });

  const html = Sidebar({
    usuario: usuarioCoordinador,
    roles: obtenerRolesEfectivos(usuarioCoordinador),
    permisos: usuarioCoordinador.permisos,
    isCollapsed: false
  });

  // Usuarios y Carreras NO deben aparecer
  assert.doesNotMatch(html, /data-module="usuarios"/);
  assert.doesNotMatch(html, /data-module="carreras"/);

  // Módulos con permiso deben aparecer
  assert.match(html, /data-module="estudiantes"/);
  assert.match(html, /data-module="periodos"/);

  limpiarSesion();
});

test('3. Panel de gestión (ModulesPage): sincronizado 1 a 1 con permisos del rol activo', () => {
  limpiarSesion();

  // Caso A: Coordinador con 2 permisos
  const usuarioCoordinador = {
    id: 25,
    nombres: 'Laura Directora',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
    rolActivo: ROLES.COORDINADOR,
    permisos: [PERMISOS.ESTUDIANTES_VER, PERMISOS.AULAS_VER]
  };
  guardarSesion({ usuario: usuarioCoordinador });

  const htmlCoord = ModulesPage();

  // No debe contener tarjeta de Usuarios
  assert.doesNotMatch(htmlCoord, /data-module="usuarios"/);
  assert.doesNotMatch(htmlCoord, /data-route="\/usuarios"/);

  // Debe contener únicamente las tarjetas autorizadas
  assert.match(htmlCoord, /data-module="estudiantes"/);
  assert.match(htmlCoord, /data-module="aulas"/);
  assert.doesNotMatch(htmlCoord, /data-module="carreras"/);
  assert.doesNotMatch(htmlCoord, /data-module="periodos"/);

  limpiarSesion();

  // Caso B: Administrador Global
  const usuarioAdmin = {
    id: 1,
    nombres: 'Super Administrador',
    roles: [ROLES.ADMIN_GLOBAL],
    rolActivo: ROLES.ADMIN_GLOBAL,
    permisos: []
  };
  guardarSesion({ usuario: usuarioAdmin });

  const htmlAdmin = ModulesPage();
  assert.match(htmlAdmin, /data-module="usuarios"/);
  assert.match(htmlAdmin, /data-module="estudiantes"/);
  assert.match(htmlAdmin, /data-module="carreras"/);

  limpiarSesion();

  // Caso C: Usuario sin ningún módulo asignado
  const usuarioSinModulos = {
    id: 30,
    nombres: 'Usuario Restringido',
    roles: [],
    rolActivo: null,
    permisos: []
  };
  guardarSesion({ usuario: usuarioSinModulos });

  const htmlVacio = ModulesPage();
  assert.match(htmlVacio, /modules-dashboard-empty/);
  assert.match(htmlVacio, /Sin módulos asignados/);
  assert.match(htmlVacio, /No tiene módulos asignados para su rol actual/);

  limpiarSesion();
});

test('4. Inicio (HomePage): KPIs y acciones rápidas filtradas por rol activo', () => {
  limpiarSesion();

  // Asistente estudiantil con solo permisos de estudiantes
  const usuarioAsistente = {
    id: 40,
    nombres: 'Asistente Juan',
    roles: [ROLES.ASISTENTE_ESTUDIANTIL],
    rolActivo: ROLES.ASISTENTE_ESTUDIANTIL,
    permisos: [PERMISOS.ESTUDIANTES_VER]
  };
  guardarSesion({ usuario: usuarioAsistente });

  const html = HomePage();

  // Estudiantes sí, Cursos/Profesores/Aulas no
  assert.match(html, /dashboard-estudiantes-activos/);
  assert.doesNotMatch(html, /dashboard-cursos/);
  assert.doesNotMatch(html, /dashboard-profesores/);
  assert.doesNotMatch(html, /dashboard-aulas/);

  // Acción rápida de estudiantes visible, oferta/proyección no
  assert.match(html, /data-route="\/estudiantes"/);
  assert.doesNotMatch(html, /data-route="\/oferta"/);
  assert.doesNotMatch(html, /data-route="\/proyeccion"/);

  limpiarSesion();
});

test('5. Protección en navegación: router rechaza acceso no autorizado sin llamar al backend', () => {
  limpiarSesion();

  const usuario = {
    id: 50,
    nombres: 'Coord Pruebas',
    roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
    rolActivo: ROLES.COORDINADOR,
    permisos: [PERMISOS.ESTUDIANTES_VER]
  };
  guardarSesion({ usuario });

  const roles = obtenerRolesEfectivos(usuario);
  const permisos = usuario.permisos;

  // Acceso denegado a /usuarios para rol activo COORDINADOR
  assert.equal(puedeAcceder(roles, 'usuarios', permisos), false);
  // Acceso concedido a /estudiantes
  assert.equal(puedeAcceder(roles, 'estudiantes', permisos), true);

  limpiarSesion();
});

test('6. Cambio de rol activo recalcula permisos inmediatamente', () => {
  limpiarSesion();

  const sesion = {
    usuario: {
      id: 60,
      nombres: 'Usuario Bivalente',
      roles: [ROLES.ADMIN_GLOBAL, ROLES.COORDINADOR],
      rolActivo: ROLES.ADMIN_GLOBAL,
      permisos: []
    }
  };

  guardarSesion(sesion);
  assert.equal(obtenerRolActivo(), ROLES.ADMIN_GLOBAL);
  assert.equal(puedeAcceder(obtenerRolesEfectivos(), 'usuarios', []), true);

  // Simulamos cambio a COORDINADOR
  sesion.usuario.rolActivo = ROLES.COORDINADOR;
  guardarSesion(sesion);

  assert.equal(obtenerRolActivo(), ROLES.COORDINADOR);
  assert.deepEqual(obtenerRolesEfectivos(), [ROLES.COORDINADOR]);
  assert.equal(puedeAcceder(obtenerRolesEfectivos(), 'usuarios', []), false);

  limpiarSesion();
});
