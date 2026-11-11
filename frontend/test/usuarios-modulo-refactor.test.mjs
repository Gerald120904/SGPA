import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES_VISIBLES,
  nombreVisibleRol,
  normalizarRolesUsuario,
  obtenerNombreCompletoUsuario,
  usuarioEsAdminGlobal,
  obtenerCodigosPermisos,
  obtenerInformacionPermiso,
  obtenerPermisosSugeridosRoles,
  agruparPermisosPorModulo,
  filtrarListaUsuarios,
  construirMensajeImpactoJerarquia,
} from '../src/pages/usuarios/usuarios.helpers.js';
import { renderizarCatalogoUsuarios } from '../src/pages/usuarios/UsuariosCatalogo.js';
import { construirDialogoConsultaAccesos } from '../src/pages/usuarios/UsuarioAccesosDialog.js';
import {
  renderizarRolesEdicionHtml,
  renderizarPermisosGranularesHtml,
  renderizarAuditoriaJerarquiaHtml,
} from '../src/pages/usuarios/UsuarioFormDialog.js';
import {
  nombrePermisoDelegable,
  obtenerPresentacionInvitacion,
  renderizarInsigniaInvitacion,
  obtenerTonoEstadoSolicitud,
  construirResumenDelegacionHtml,
  propuestaVisible,
} from '../src/pages/usuarios/AsistentesPropuestasView.js';

test('usuarios.helpers — normalización, nombres, permisos y agrupación por módulo', () => {
  assert.equal(nombreVisibleRol('COORDINADOR'), ROLES_VISIBLES.COORDINADOR);
  assert.equal(
    obtenerNombreCompletoUsuario({ nombres: 'Ana', apellido1: 'Solís', apellido2: 'Vega' }),
    'Ana Solís Vega',
  );
  assert.deepEqual(
    normalizarRolesUsuario({ roles: ['PROFESOR', { id: 2, nombre: 'COORDINADOR' }] }).map(
      (r) => r.nombre,
    ),
    ['PROFESOR', 'COORDINADOR'],
  );
  assert.equal(usuarioEsAdminGlobal({ roles: [{ nombre: 'ADMIN_GLOBAL' }] }), true);
  assert.equal(usuarioEsAdminGlobal({ roles: ['PROFESOR'] }), false);

  const codigos = obtenerCodigosPermisos(['CURSOS_VER', { permiso: 'AULAS_GESTIONAR' }, null]);
  assert.deepEqual([...codigos], ['CURSOS_VER', 'AULAS_GESTIONAR']);

  assert.equal(obtenerInformacionPermiso('AULAS_VER').nombre, 'Ver aulas');
  assert.match(obtenerInformacionPermiso('PROYECCION_AUTORIZAR').nombre, /Autorizar proyección/i);

  const sugeridosAdmin = obtenerPermisosSugeridosRoles(['ADMIN_GLOBAL', 'PROFESOR'], {
    PROFESOR: ['CURSOS_VER'],
  });
  assert.equal(sugeridosAdmin.size, 0);

  const sugeridosProf = obtenerPermisosSugeridosRoles(['PROFESOR'], {
    PROFESOR: ['CURSOS_VER'],
  });
  assert.deepEqual([...sugeridosProf], ['CURSOS_VER']);

  const grupos = agruparPermisosPorModulo([
    'ESTUDIANTES_VER',
    'PLANES_ESTUDIO_GESTIONAR',
    'CUSTOM_X',
  ]);
  assert.deepEqual(grupos.get('Estudiantes'), ['ESTUDIANTES_VER']);
  assert.deepEqual(grupos.get('Planes de estudio'), ['PLANES_ESTUDIO_GESTIONAR']);
  assert.deepEqual(grupos.get('Otros permisos'), ['CUSTOM_X']);
});

test('usuarios.helpers — filtrado de usuarios e impacto de jerarquía', () => {
  const usuarios = [
    {
      id: 1,
      cedula: '111111111',
      nombres: 'Carlos',
      apellido1: 'Mora',
      correo: 'carlos@una.ac.cr',
      roles: ['COORDINADOR'],
      activo: true,
    },
    {
      id: 2,
      cedula: '222222222',
      nombre: 'Elena Legacy',
      email: 'elena@una.ac.cr',
      roles: ['PROFESOR'],
      carreras: [{ nombre: 'Informática' }],
      activo: false,
    },
  ];

  assert.equal(filtrarListaUsuarios(usuarios, 'carlos').length, 1);
  assert.equal(filtrarListaUsuarios(usuarios, '222222222').length, 1);
  assert.equal(filtrarListaUsuarios(usuarios, 'coordinador').length, 1);
  assert.equal(filtrarListaUsuarios(usuarios, 'informática').length, 1);
  assert.equal(filtrarListaUsuarios(usuarios, '').length, 2);

  const msgSinRevocar = construirMensajeImpactoJerarquia({ revocados: [] }, 'Carlos', []);
  assert.match(msgSinRevocar, /Se actualizarán las carreras y permisos de Carlos/);

  const msgRevocar = construirMensajeImpactoJerarquia(
    { revocados: ['5:CURSOS_GESTIONAR'], totalSolicitudes: 3 },
    'Carlos',
    [{ id: 5, nombre: 'Ingeniería' }],
  );
  assert.match(msgRevocar, /Ingeniería: CURSOS_GESTIONAR/);
  assert.match(msgRevocar, /3 solicitud\(es\) afectada\(s\)/);
});

test('UsuariosCatalogo y UsuarioFormDialog — renderizado institucional sin acciones impropias', () => {
  const { resumenHtml, contadorTexto, tablaHtml } = renderizarCatalogoUsuarios({
    usuarios: [
      {
        id: 10,
        cedula: '501230456',
        nombres: 'Lucía',
        apellido1: 'Castro',
        correo: 'lucia@una.ac.cr',
        roles: [{ id: 2, nombre: 'COORDINADOR' }],
        activo: true,
      },
    ],
    filtro: '',
  });

  assert.match(resumenHtml, /Usuarios registrados/);
  assert.match(resumenHtml, /Coordinadores/);
  assert.equal(contadorTexto, '1 usuario');
  assert.match(tablaHtml, /Lucía Castro/);
  assert.match(tablaHtml, /data-action="ver-roles-permisos"/);
  assert.match(tablaHtml, /data-action="configurar-jerarquia"/);

  const rolesHtml = renderizarRolesEdicionHtml({
    usuarioId: 10,
    rolesUsuario: [{ id: 2, nombre: 'COORDINADOR' }],
    rolesDisponibles: [{ nombre: 'PROFESOR' }],
  });
  assert.match(rolesHtml, /data-action="revocar-rol"/);
  assert.match(rolesHtml, /data-action="asignar-rol"/);

  const permisosHtml = renderizarPermisosGranularesHtml({
    usuarioId: 10,
    permisosUsuario: ['CURSOS_VER'],
    permisosCatalogo: ['CURSOS_VER', 'AULAS_VER'],
  });
  assert.match(permisosHtml, /1 asignados/);
  assert.match(permisosHtml, /data-action="guardar-permisos"/);

  const auditoriaHtml = renderizarAuditoriaJerarquiaHtml([
    { accion: 'ASIGNACION', createdAt: '2026-01-10T10:00:00.000Z' },
  ]);
  assert.match(auditoriaHtml, /ASIGNACION/);
});

test('UsuarioAccesosDialog — consulta de solo lectura para admin, coordinador y errores parciales', () => {
  const adminDialog = construirDialogoConsultaAccesos({
    usuario: {
      id: 1,
      nombres: 'Admin',
      apellido1: 'General',
      correo: 'admin@una.ac.cr',
      activo: true,
      roles: ['ADMIN_GLOBAL'],
    },
  });
  assert.equal(adminDialog.formId, 'usuarioConsultaAccesosForm');
  assert.match(adminDialog.body, /Acceso administrativo global/);
  assert.doesNotMatch(adminDialog.body, /guardar-permisos|revocar-rol|asignar-rol/);

  const coordErrorDialog = construirDialogoConsultaAccesos({
    usuario: {
      id: 2,
      nombres: 'María',
      apellido1: 'Pérez',
      correo: 'maria@una.ac.cr',
      activo: true,
      roles: ['COORDINADOR'],
    },
    permisosUsuario: ['CURSOS_VER'],
    alcance: null,
    errorAlcance: 'Permiso denegado',
    carreras: [{ id: 1, nombre: 'Sistemas' }],
  });
  assert.match(coordErrorDialog.body, /Permisos por carrera/);
  assert.match(coordErrorDialog.body, /Permiso denegado/);
  assert.doesNotMatch(coordErrorDialog.body, /guardar-permisos|revocar-rol|asignar-rol/);
});

test('AsistentesPropuestasView — estados de invitación, propuestas y delegación', () => {
  assert.equal(nombrePermisoDelegable('CURSOS_VER'), 'Consultar');
  assert.equal(nombrePermisoDelegable('CURSOS_GESTIONAR'), 'Proponer cambios');

  for (const [estado, esperado] of [
    ['PENDIENTE', 'Invitación pendiente'],
    ['EN_PROCESO', 'Procesando invitación'],
    ['ENVIADA', 'Invitación enviada'],
    ['FALLIDA', 'Envío fallido'],
    ['INCIERTA', 'Resultado incierto'],
    ['CADUCADA', 'Invitación vencida'],
    ['ACEPTADA', 'Invitación aceptada'],
    ['SIN_INVITACION', 'Sin invitación'],
  ]) {
    const [label] = obtenerPresentacionInvitacion(estado);
    assert.equal(label, esperado);
    assert.match(renderizarInsigniaInvitacion({ invitacion: { estado } }), new RegExp(esperado));
  }

  assert.equal(obtenerTonoEstadoSolicitud('APROBADA'), 'success');
  assert.equal(obtenerTonoEstadoSolicitud('PENDIENTE'), 'warning');
  assert.equal(obtenerTonoEstadoSolicitud('RECHAZADA'), 'danger');
  assert.equal(obtenerTonoEstadoSolicitud('INVALIDADA'), 'danger');

  const resumen = construirResumenDelegacionHtml({
    coordinador: 'Luis Gómez',
    envioInvitacionHabilitado: false,
    seleccion: [{ nombre: 'Ingeniería', permisos: ['Consultar'] }],
  });
  assert.match(resumen, /Luis Gómez/);
  assert.match(resumen, /Pendiente de envío/);
  assert.match(resumen, /Ingeniería/);

  const propuesta = propuestaVisible({
    modulo: 'CURSOS',
    objetivoId: 44,
    datosPropuestos: {
      cursoReferencia: { codigo: 'EIF-101', nombre: 'Fundamentos' },
      nombre: 'Fundamentos II',
      observacion: 'Actualización de nombre',
    },
  });
  assert.match(propuesta, /EIF-101 · Fundamentos/);
  assert.match(propuesta, /Fundamentos II/);
  assert.match(propuesta, /Actualización de nombre/);
});
