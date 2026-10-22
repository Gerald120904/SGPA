import {
  listarUsuarios,
  obtenerUsuario as obtenerUsuarioDetalle,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  asignarRolUsuario,
  revocarRolUsuario,
  listarRoles,
} from '../../services/usuarios.service.js';
import {
  listarCatalogoPermisos,
  listarPlantillasPermisos,
  listarPermisosUsuario,
  reemplazarPermisosUsuario,
} from '../../services/permisos.service.js';
import {
  listarCarreras,
} from '../../services/carreras.service.js';
import { ROLES } from '../../config/permissions.js';
import { obtenerCoordinadorJerarquia, configurarCoordinadorJerarquia, listarAuditoriaJerarquia } from '../../services/jerarquia.service.js';

import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { StatCard } from '../../components/StatCard.js';
import { StatusBadge } from '../../components/StatusBadge.js';

let instanciaActual = 0;

export function UsuariosPage() {
  return `
    <section id="usuariosPage" class="module-view usuarios-page">
      <header class="usuarios-toolbar sgpa-toolbar">
        <div class="usuarios-heading">
          <span class="usuarios-eyebrow">Administración institucional</span>
          <h2>Usuarios</h2>
          <p>Gestión de cuentas, roles y accesos al Sistema de Gestión y Proyección Académica.</p>
        </div>

        <button id="nuevoUsuarioButton" class="usuarios-primary-button"
          type="button">
          <i data-lucide="user-plus" aria-hidden="true"></i>
          <span>Nuevo usuario</span>
        </button>
      </header>

      <div id="usuariosFeedback" class="usuarios-feedback hidden" role="status"
        aria-live="polite"></div>

      <div id="usuariosResumen" class="usuarios-resumen" aria-label="Resumen de usuarios"></div>

      <section class="usuarios-panel" aria-label="Directorio de usuarios">
        <div class="usuarios-panel-header">
          <div class="usuarios-panel-title">
            <span class="usuarios-panel-icon" aria-hidden="true">
              <i data-lucide="users"></i>
            </span>
            <div>
              <h3>Directorio institucional</h3>
              <p>Consulte usuarios, roles asignados y estado de las cuentas.</p>
            </div>
          </div>
          <span id="usuariosContador" class="usuarios-result-count" aria-live="polite"></span>
        </div>

        <div class="usuarios-filtros">
          <label class="usuarios-search sgpa-search" for="usuariosBuscar">
            <i data-lucide="search" aria-hidden="true"></i>
            <input id="usuariosBuscar" type="search"
              placeholder="Buscar por nombre, cédula, correo o rol..."
              autocomplete="off">
          </label>
        </div>

        <div id="usuariosContent" class="usuarios-content" aria-live="polite">
          <div class="usuarios-message">
            <i data-lucide="loader-circle" aria-hidden="true"></i>
            <span>Cargando usuarios...</span>
          </div>
        </div>
      </section>

      <dialog id="usuarioDialog" class="sgpa-form-dialog sgpa-form-dialog-lg usuario-dialog">
        <div id="usuarioDialogContent"></div>
      </dialog>
    </section>
  `;
}

function obtenerNombreCompleto(usuario) {
  return [
    usuario?.nombres,
    usuario?.apellido1,
    usuario?.apellido2,
  ].filter(Boolean).join(' ');
}

function obtenerRoles(usuario) {
  if (!Array.isArray(usuario?.roles)) {
    return [];
  }

  return usuario.roles
    .map((rol) => (
      typeof rol === 'string'
        ? { id: null, nombre: rol, descripcion: null }
        : rol
    ))
    .filter((rol) => rol?.nombre);
}

export function nombreVisibleRol(nombre) {
  return {
    ADMIN_GLOBAL: 'Administrador global',
    COORDINADOR: 'Coordinador',
    PROFESOR: 'Profesor',
    ASISTENTE_ESTUDIANTIL: 'Asistente estudiantil',
  }[nombre] || nombre;
}

function mensajeResultado(resultado, mensajePredeterminado) {
  if (resultado?.ok) {
    return resultado;
  }

  throw new Error(resultado?.message || mensajePredeterminado);
}

const INFORMACION_PERMISOS = {

  PROFESORES_VER: {
    nombre:
      'Ver profesores',

    descripcion:
      'Permite consultar información administrativa de profesores.',
  },

  ATESTADOS_VALIDAR: {
    nombre:
      'Validar atestados',

    descripcion:
      'Permite aprobar o rechazar atestados de profesores.',
  },

  PERFILES_DOCENTES_VALIDAR: {
    nombre:
      'Validar perfiles docentes',

    descripcion:
      'Permite aprobar, rechazar o inactivar perfiles solicitados por profesores.',
  },

  PERFILES_ACADEMICOS_GESTIONAR: {
    nombre:
      'Gestionar perfiles académicos',

    descripcion:
      'Permite administrar perfiles académicos según el alcance autorizado.',
  },

  PROYECCION_VER: {
    nombre:
      'Ver proyección académica',

    descripcion:
      'Permite consultar información de proyección académica.',
  },

  PROYECCION_GESTIONAR: {
    nombre:
      'Gestionar proyección académica',

    descripcion:
      'Permite realizar operaciones de gestión sobre la proyección académica.',
  },

  OFERTA_VER: {
    nombre:
      'Ver oferta académica',

    descripcion:
      'Permite consultar la oferta académica.',
  },

  OFERTA_GESTIONAR: {
    nombre:
      'Gestionar oferta académica',

    descripcion:
      'Permite realizar operaciones administrativas sobre la oferta académica.',
  },

  PROFESORES_ASIGNAR: {
    nombre:
      'Asignar profesores',

    descripcion:
      'Permite asignar profesores dentro de los procesos académicos autorizados.',
  },

  AULAS_VER: {
    nombre:
      'Ver aulas',

    descripcion:
      'Permite consultar aulas, equipamiento, disponibilidad y ocupación.',
  },

  AULAS_GESTIONAR: {
    nombre:
      'Gestionar aulas',

    descripcion:
      'Permite administrar aulas y su información operativa.',
  },

  AULAS_ASIGNAR: {
    nombre:
      'Asignar aulas',

    descripcion:
      'Permite evaluar y utilizar aulas dentro de procesos de asignación académica.',
  },

};


function obtenerInformacionPermiso(
  permiso,
) {
  const etiquetas = {
    VER: 'Ver',
    GESTIONAR: 'Gestionar',
    VALIDAR: 'Validar',
    ASIGNAR: 'Asignar',
    AUTORIZAR: 'Autorizar',
  };

  const partes = String(permiso)
    .split('_');
  const accion = partes.pop();
  const recurso = partes
    .join(' ')
    .toLocaleLowerCase('es-CR')
    .replace('academicos', 'académicos')
    .replace('academica', 'académica')
    .replace('proyeccion', 'proyección');

  return (
    INFORMACION_PERMISOS[
      permiso
    ] || {
      nombre: `${
        etiquetas[accion] || accion
      } ${recurso}`,
      descripcion:
        `Permite ${
          (etiquetas[accion] || accion)
            .toLocaleLowerCase('es-CR')
        } ${recurso}.`,
    }
  );
}


function usuarioEsAdminGlobal(
  usuario,
) {
  return obtenerRoles(
    usuario,
  ).some(
    (rol) =>
      rol.nombre ===
      'ADMIN_GLOBAL',
  );
}


function obtenerCodigosPermisos(
  permisos,
) {
  return new Set(
    (
      Array.isArray(permisos)
        ? permisos
        : []
    )
      .map(
        (item) =>
          typeof item === 'string'
            ? item
            : item?.permiso,
      )
      .filter(Boolean),
  );
}

export function obtenerEstadoSeleccionPermisosCarrera(
  permisos,
) {
  const editables = Array.from(
    permisos || [],
  ).filter(
    (permiso) => !permiso.disabled,
  );
  const seleccionados = editables.filter(
    (permiso) => permiso.checked,
  ).length;

  return {
    checked:
      editables.length > 0 &&
      seleccionados === editables.length,
    indeterminate:
      seleccionados > 0 &&
      seleccionados < editables.length,
    disabled: editables.length === 0,
  };
}

export function establecerSeleccionPermisosCarrera(
  permisos,
  seleccionado,
) {
  Array.from(permisos || [])
    .filter((permiso) => !permiso.disabled)
    .forEach((permiso) => {
      permiso.checked = Boolean(seleccionado);
    });
}

export async function iniciarUsuariosPage() {
  const pagina = document.getElementById('usuariosPage');

  if (!pagina) {
    return;
  }

  const instancia = ++instanciaActual;
  const estado = {
    usuarios: [],
    roles: [],
    carreras: [],
    permisosCatalogo: [],
    plantillasPermisos: {},
    filtro: '',
  };

  const sigueActiva = () => (
    instancia === instanciaActual &&
    document.getElementById('usuariosPage') === pagina
  );

  const contenido = pagina.querySelector('#usuariosContent');
  const feedback = pagina.querySelector('#usuariosFeedback');
  const dialogo = pagina.querySelector('#usuarioDialog');
  const dialogoContenido = pagina.querySelector('#usuarioDialogContent');

  // Presentación reutilizable. Los identificadores y eventos siguen siendo los originales.
  function mostrarFormularioUsuario({ formId, title, description, body, footerHtml, userId }) {
    dialogoContenido.innerHTML = FormDialog({
      formId,
      title,
      description,
      body,
      footerHtml,
      layout: 'custom',
      bodyClass: 'usuario-dialog-body',
      formClass: 'usuario-form',
    });

    if (userId != null) {
      dialogoContenido.querySelector(`#${formId}`).dataset.userId = String(userId);
    }

    // El formulario de datos personales muestra los errores al lado de cada input.
    // No afecta a jerarquía, permisos ni a otros FormDialog del SGPA.
    if (formId === 'usuarioForm') {
      dialogoContenido.querySelector('#usuarioForm').noValidate = true;
    }

    dialogoContenido.querySelector('.sgpa-form-header')?.insertAdjacentHTML(
      'beforeend',
      `<button class="usuarios-close-button" type="button"
        data-action="cerrar-dialogo" aria-label="Cerrar formulario" title="Cerrar">
        <i data-lucide="x" aria-hidden="true"></i>
      </button>`,
    );
    renderizarIconos();
    if (!dialogo.open) dialogo.showModal();
  }

  function renderizarOpcionesCarreras(
    seleccionados = new Set(),
  ) {
    if (!estado.carreras.length) {
      return '<p class="usuarios-muted">No hay carreras registradas o activas.</p>';
    }

    return estado.carreras
      .map(
        (carrera) => `
          <label
            class="usuario-carrera-option"
          >
            <input
              type="checkbox"
              name="carreras"
              value="${carrera.id}"
              ${
                seleccionados.has(
                  carrera.id,
                )
                  ? 'checked'
                  : ''
              }
            >
            <span>
              <strong>${escapeHtml(
                carrera.codigo,
              )}</strong>
              <small>${escapeHtml(
                carrera.nombre,
              )}</small>
            </span>
          </label>
        `,
      )
      .join('');
  }

  function renderizarOpcionesPermisos(
    seleccionados = new Set(),
  ) {
    return estado.permisosCatalogo
      .map(
        (permiso) => {
          const informacion =
            obtenerInformacionPermiso(
              permiso,
            );

          return `
            <label
              class="usuario-permission-option"
            >
              <input
                type="checkbox"
                name="permisos"
                value="${escapeHtml(
                  permiso,
                )}"
                ${
                  seleccionados.has(
                    permiso,
                  )
                    ? 'checked'
                    : ''
                }
              >

              <span>
                <strong>
                  ${escapeHtml(
                    informacion.nombre,
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    informacion.descripcion,
                  )}
                </small>

                <code>
                  ${escapeHtml(
                    permiso,
                  )}
                </code>
              </span>
            </label>
          `;
        },
      )
      .join('');
  }

  function obtenerPermisosSugeridosRoles(
    roles,
  ) {
    if (
      roles.includes(
        ROLES.ADMIN_GLOBAL,
      )
    ) {
      return new Set();
    }

    return new Set(
      roles.flatMap(
        (rol) =>
          estado
            .plantillasPermisos?.[
              rol
            ] || [],
      ),
    );
  }

  function aplicarPlantillaCreacion() {
    const roles =
      [
        ...dialogoContenido
          .querySelectorAll(
            'input[name="roles"]:checked',
          ),
      ].map(
        (input) =>
          input.value,
      );

    const seccionCarreras =
      dialogoContenido.querySelector(
        '#carrerasCreacionSection',
      );
    if (seccionCarreras) {
      if (
        roles.includes(
          ROLES.PROFESOR,
        )
      ) {
        seccionCarreras.classList.remove(
          'hidden',
        );
      } else {
        seccionCarreras.classList.add(
          'hidden',
        );
      }
    }

    const sugeridos =
      obtenerPermisosSugeridosRoles(
        roles,
      );

    const porCarrera = roles.includes(ROLES.COORDINADOR) ||
      roles.includes(ROLES.ASISTENTE_ESTUDIANTIL);
    dialogoContenido.querySelector('#permisosCreacionSection')
      ?.classList.toggle('hidden', porCarrera);

    dialogoContenido
      .querySelectorAll(
        'input[name="permisos"]',
      )
      .forEach(
        (input) => {
          input.checked =
            !porCarrera && sugeridos.has(
              input.value,
            );
        },
      );
  }


  function mostrarFeedback(mensaje, tipo = 'success') {
    if (!feedback) return;

    feedback.textContent = mensaje;
    feedback.className = `usuarios-feedback is-${tipo}`;

    if (dialogo?.open) {
      const feedbackDialogo = dialogo.querySelector(
        '.usuario-dialog-feedback',
      );

      if (feedbackDialogo) {
        feedbackDialogo.textContent = mensaje;
        feedbackDialogo.className =
          `usuario-dialog-feedback is-${tipo}`;
      }
    }
  }

  function ocultarFeedback() {
    if (!feedback) return;
    feedback.textContent = '';
    feedback.className = 'usuarios-feedback hidden';
  }

  function renderizarTabla() {
    if (!contenido || !sigueActiva()) return;

    const total = estado.usuarios.length;
    const activos = estado.usuarios.filter((usuario) => usuario.activo).length;
    const inactivos = total - activos;
    const coordinadores = estado.usuarios.filter((usuario) =>
      obtenerRoles(usuario).some((rol) => rol.nombre === ROLES.COORDINADOR)
    ).length;

    const resumen = pagina.querySelector('#usuariosResumen');
    if (resumen) {
      resumen.innerHTML = [
        StatCard({ icon: 'users', title: 'Usuarios registrados',
          value: String(total), description: 'Cuentas en el directorio' }),
        StatCard({ icon: 'circle-check', title: 'Cuentas activas',
          value: String(activos), description: 'Accesos habilitados' }),
        StatCard({ icon: 'circle-pause', title: 'Cuentas inactivas',
          value: String(inactivos), description: 'Accesos deshabilitados' }),
        StatCard({ icon: 'shield-check', title: 'Coordinadores',
          value: String(coordinadores), description: 'Con rol de coordinación' }),
      ].join('');
    }

    const termino = estado.filtro.trim().toLowerCase();
    const usuarios = estado.usuarios.filter((usuario) => {
      const texto = [
        usuario.cedula,
        obtenerNombreCompleto(usuario),
        usuario.correo,
        ...obtenerRoles(usuario).map((rol) => nombreVisibleRol(rol.nombre)),
      ].join(' ').toLowerCase();

      return texto.includes(termino);
    });

    const contador = pagina.querySelector('#usuariosContador');
    if (contador) {
      contador.textContent = termino
        ? `${usuarios.length} de ${total} usuarios`
        : `${total} ${total === 1 ? 'usuario' : 'usuarios'}`;
    }

    const filas = usuarios.map((usuario) => {
      const roles = obtenerRoles(usuario);
      const nombre = obtenerNombreCompleto(usuario);
      const inicial = nombre.trim().charAt(0).toUpperCase() || 'U';
      const badges = roles.length
        ? roles.map((rol) => `
            <span title="${escapeHtml(rol.descripcion || rol.nombre)}">
              ${StatusBadge({
                label: nombreVisibleRol(rol.nombre),
                tone: rol.nombre === ROLES.ADMIN_GLOBAL ? 'danger'
                  : rol.nombre === ROLES.COORDINADOR ? 'warning'
                  : rol.nombre === ROLES.PROFESOR ? 'info' : 'neutral',
              })}
            </span>
          `).join('')
        : '<span class="usuarios-no-role">Sin rol asignado</span>';

      return `
        <tr>
          <td><span class="usuarios-cedula">${escapeHtml(usuario.cedula)}</span></td>
          <td>
            <div class="usuarios-persona">
              <span class="usuarios-avatar" aria-hidden="true">${escapeHtml(inicial)}</span>
              <strong>${escapeHtml(nombre)}</strong>
            </div>
          </td>
          <td><span class="usuarios-correo">${escapeHtml(usuario.correo)}</span></td>
          <td><div class="usuarios-role-list">${badges}</div></td>
          <td>${StatusBadge({
            label: usuario.activo ? 'Activo' : 'Inactivo',
            tone: usuario.activo ? 'success' : 'neutral',
          })}</td>
          <td>
            <div class="usuarios-actions">
              <button class="usuarios-icon-button" type="button"
                data-action="editar" data-user-id="${usuario.id}"
                aria-label="Editar ${escapeHtml(nombre)}" title="Editar usuario">
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>
              ${roles.some((rol) => rol.nombre === ROLES.COORDINADOR) ? `
                <button class="usuarios-icon-button" type="button"
                  data-action="configurar-jerarquia" data-user-id="${usuario.id}"
                  aria-label="Configurar carreras y permisos de ${escapeHtml(nombre)}"
                  title="Carreras y permisos por carrera">
                  <i data-lucide="shield-check" aria-hidden="true"></i>
                </button>
              ` : ''}
              <button
                class="usuarios-icon-button ${usuario.activo ? 'is-danger' : 'is-success'}"
                type="button" data-action="estado" data-user-id="${usuario.id}"
                data-active="${usuario.activo}"
                aria-label="${usuario.activo ? 'Desactivar' : 'Activar'} usuario"
                title="${usuario.activo ? 'Desactivar' : 'Activar'}">
                <i data-lucide="power" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    contenido.innerHTML = DataTable({
      columns: [
        { label: 'Cédula' },
        { label: 'Usuario' },
        { label: 'Correo institucional' },
        { label: 'Roles' },
        { label: 'Estado' },
        { label: 'Acciones' },
      ],
      rows: filas,
      emptyMessage: termino
        ? 'No hay usuarios que coincidan con la búsqueda.'
        : 'No hay usuarios registrados.',
      ariaLabel: 'Directorio institucional de usuarios',
    });

    renderizarIconos();
  }

  async function cargarUsuarios(mostrarCarga = true) {
    if (mostrarCarga && contenido) {
      contenido.innerHTML = '<div class="usuarios-message"><i data-lucide="loader-circle" aria-hidden="true"></i><span>Cargando usuarios...</span></div>';
      renderizarIconos();
    }

    const resultado = mensajeResultado(
      await listarUsuarios(),
      'No fue posible consultar los usuarios.',
    );

    if (!sigueActiva()) return;
    estado.usuarios = Array.isArray(resultado.usuarios)
      ? resultado.usuarios
      : [];
    renderizarTabla();
  }

  async function cargarRoles() {
    const resultado = mensajeResultado(
      await listarRoles(),
      'No fue posible consultar los roles.',
    );

    if (!sigueActiva()) return;
    estado.roles = Array.isArray(resultado.data) ? resultado.data : [];
  }

  async function cargarCarreras() {
    const resultado = mensajeResultado(
      await listarCarreras(),
      'No fue posible consultar las carreras.',
    );

    if (!sigueActiva()) return;
    estado.carreras = Array.isArray(resultado.carreras)
      ? resultado.carreras.filter((c) => c.activo)
      : Array.isArray(resultado.data)
        ? resultado.data.filter((c) => c.activo)
        : [];
  }



  async function cargarPermisosCatalogo() {
    const resultado =
      mensajeResultado(
        await listarCatalogoPermisos(),
        'No fue posible consultar el catálogo de permisos.',
      );

    if (!sigueActiva()) {
      return;
    }

    estado.permisosCatalogo =
      Array.isArray(
        resultado.permisos,
      )
        ? resultado.permisos
        : [];
  }

  async function cargarPlantillasPermisos() {
    const resultado =
      mensajeResultado(
        await listarPlantillasPermisos(),
        'No fue posible consultar las plantillas de permisos.',
      );

    if (!sigueActiva()) {
      return;
    }

    estado.plantillasPermisos =
      resultado.plantillas || {};
  }

  // Límites elegidos para el formulario institucional de Usuarios.
  // El backend conserva por separado sus contratos actuales para otras integraciones.
  const LIMITES_USUARIO = Object.freeze({
    cedula: 9,
    correo: 150,
    nombres: 60,
    apellido1: 50,
    apellido2: 50,
  });

  const NOMBRES_CAMPOS_USUARIO = ['cedula', 'correo', 'nombres', 'apellido1', 'apellido2'];
  const EXPRESION_CARACTERES_NOMBRE = /[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]/g;

  function leerDatosUsuarioFormulario(formulario) {
    const datos = new FormData(formulario);
    return {
      cedula: String(datos.get('cedula') || '').trim(),
      nombres: String(datos.get('nombres') || '').trim(),
      apellido1: String(datos.get('apellido1') || '').trim(),
      apellido2: String(datos.get('apellido2') || '').trim() || null,
      correo: String(datos.get('correo') || '').trim().toLowerCase(),
    };
  }

  function mostrarErrorCampoUsuario(input, mensaje = '') {
    if (!input) return;
    input.setCustomValidity(mensaje);
    if (mensaje) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');

    const etiqueta = input.closest('.usuario-campo');
    etiqueta?.classList.toggle('is-invalid', Boolean(mensaje));
    const detalle = etiqueta?.querySelector('.usuario-campo-error');
    if (detalle) {
      detalle.textContent = mensaje;
      detalle.classList.toggle('hidden', !mensaje);
    }
  }

  function validarCamposUsuario(formulario, usuario, id, { enfocar = false } = {}) {
    const cedulaRegex = /^\d{1,9}$/;
    const nombreRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
    const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const otrosUsuarios = estado.usuarios.filter(
      (existente) => Number(existente.id) !== id,
    );
    const cedulaDuplicada = otrosUsuarios.some((existente) =>
      String(existente.cedula ?? '').trim() === usuario.cedula,
    );
    const correoDuplicado = otrosUsuarios.some((existente) =>
      String(existente.correo ?? '').trim().toLowerCase() === usuario.correo,
    );

    const errores = {
      cedula: !usuario.cedula
        ? 'La cédula es obligatoria.'
        : !cedulaRegex.test(usuario.cedula)
          ? 'La cédula solo debe contener números (máximo 9 dígitos, sin guiones).'
          : cedulaDuplicada
            ? 'La cédula ya está registrada.'
            : '',
      correo: !usuario.correo
        ? 'El correo electrónico es obligatorio.'
        : usuario.correo.length > LIMITES_USUARIO.correo
          ? 'El correo no puede superar los 150 caracteres.'
          : !correoRegex.test(usuario.correo)
            ? 'Ingrese un correo válido (ejemplo: usuario@una.cr).'
            : correoDuplicado
              ? 'El correo ya está registrado.'
              : '',
      nombres: !usuario.nombres
        ? 'El nombre es obligatorio.'
        : usuario.nombres.length > LIMITES_USUARIO.nombres
          ? 'Los nombres no pueden superar los 60 caracteres.'
          : !nombreRegex.test(usuario.nombres)
            ? 'El nombre solo debe contener letras y espacios válidos.'
            : '',
      apellido1: !usuario.apellido1
        ? 'El primer apellido es obligatorio.'
        : usuario.apellido1.length > LIMITES_USUARIO.apellido1
          ? 'El primer apellido no puede superar los 50 caracteres.'
          : !nombreRegex.test(usuario.apellido1)
            ? 'El primer apellido solo debe contener letras y signos propios de nombres.'
            : '',
      apellido2: usuario.apellido2 && usuario.apellido2.length > LIMITES_USUARIO.apellido2
        ? 'El segundo apellido no puede superar los 50 caracteres.'
        : usuario.apellido2 && !nombreRegex.test(usuario.apellido2)
          ? 'El segundo apellido solo debe contener letras y signos propios de nombres.'
          : '',
    };

    let primerInvalido = null;
    for (const nombre of NOMBRES_CAMPOS_USUARIO) {
      const input = formulario.querySelector(`[name="${nombre}"]`);
      mostrarErrorCampoUsuario(input, errores[nombre]);
      if (!primerInvalido && errores[nombre]) primerInvalido = input;
    }

    // La selección de rol es obligatoria solo al crear, no en la edición.
    const roles = formulario.querySelector('.usuario-role-options');
    if (roles) {
      const faltaRol = !id && !roles.querySelector('input[name="roles"]:checked');
      roles.classList.toggle('is-invalid', faltaRol);
      const mensajeRol = roles.querySelector('.usuario-roles-error');
      if (mensajeRol) mensajeRol.classList.toggle('hidden', !faltaRol);
      if (!primerInvalido && faltaRol) primerInvalido = roles;
    }

    if (enfocar && primerInvalido) {
      const destino = primerInvalido.matches('fieldset')
        ? primerInvalido.querySelector('input[name="roles"]')
        : primerInvalido;
      destino?.focus();
    }
    return !primerInvalido;
  }

  function camposUsuario(usuario = null) {
    return `
      <div class="usuario-form-info">Los campos marcados con <strong>*</strong> son obligatorios.</div>
      <div class="usuario-form-grid">
        <label class="usuario-campo">
          <span>Cédula <b class="usuario-obligatorio" aria-hidden="true">*</b></span>
          <input
            name="cedula"
            type="text"
            inputmode="numeric"
            pattern="[0-9]{1,9}"
            required
            maxlength="${LIMITES_USUARIO.cedula}"
            aria-describedby="usuario-cedula-ayuda usuario-cedula-error"
            autocomplete="off"
            placeholder="Ej: 208570524"
            value="${escapeHtml(usuario?.cedula || '')}"
          >
          <small id="usuario-cedula-ayuda">Solo números, hasta 9 dígitos, sin guiones.</small>
          <small id="usuario-cedula-error" class="usuario-campo-error hidden" role="alert"></small>
        </label>

        <label class="usuario-campo">
          <span>Correo electrónico <b class="usuario-obligatorio" aria-hidden="true">*</b></span>
          <input
            name="correo"
            type="email"
            required
            maxlength="${LIMITES_USUARIO.correo}"
            aria-describedby="usuario-correo-ayuda usuario-correo-error"
            autocomplete="email"
            placeholder="Ej: usuario@una.cr"
            value="${escapeHtml(usuario?.correo || '')}"
          >
          <small id="usuario-correo-ayuda">Correo institucional · máximo 150 caracteres.</small>
          <small id="usuario-correo-error" class="usuario-campo-error hidden" role="alert"></small>
        </label>

        <label class="usuario-campo">
          <span>Nombres <b class="usuario-obligatorio" aria-hidden="true">*</b></span>
          <input
            name="nombres"
            required
            maxlength="${LIMITES_USUARIO.nombres}"
            aria-describedby="usuario-nombres-ayuda usuario-nombres-error"
            autocomplete="given-name"
            placeholder="Primer y segundo nombre"
            value="${escapeHtml(usuario?.nombres || '')}"
          >
          <small id="usuario-nombres-ayuda">Hasta 60 caracteres, únicamente letras.</small>
          <small id="usuario-nombres-error" class="usuario-campo-error hidden" role="alert"></small>
        </label>

        <label class="usuario-campo">
          <span>Primer apellido <b class="usuario-obligatorio" aria-hidden="true">*</b></span>
          <input
            name="apellido1"
            required
            maxlength="${LIMITES_USUARIO.apellido1}"
            aria-describedby="usuario-apellido1-ayuda usuario-apellido1-error"
            autocomplete="family-name"
            placeholder="Primer apellido"
            value="${escapeHtml(usuario?.apellido1 || '')}"
          >
          <small id="usuario-apellido1-ayuda">Hasta 50 caracteres, sin números.</small>
          <small id="usuario-apellido1-error" class="usuario-campo-error hidden" role="alert"></small>
        </label>

        <label class="usuario-campo usuario-form-full">
          <span>Segundo apellido <small class="usuario-opcional">Opcional</small></span>
          <input
            name="apellido2"
            maxlength="${LIMITES_USUARIO.apellido2}"
            aria-describedby="usuario-apellido2-ayuda usuario-apellido2-error"
            autocomplete="additional-name"
            placeholder="Segundo apellido (opcional)"
            value="${escapeHtml(usuario?.apellido2 || '')}"
          >
          <small id="usuario-apellido2-ayuda">Hasta 50 caracteres, sin números.</small>
          <small id="usuario-apellido2-error" class="usuario-campo-error hidden" role="alert"></small>
        </label>
      </div>
    `;
  }

  function renderizarGestorPermisos(
    usuario,
    permisosUsuario,
  ) {
    if (obtenerRoles(usuario).some((rol) =>
      rol.nombre === ROLES.COORDINADOR || rol.nombre === ROLES.ASISTENTE_ESTUDIANTIL)) {
      return `<section class="usuario-permission-manager">
        <h4>Permisos por carrera</h4>
        <p>Utilice el botón de escudo en la lista de usuarios para configurar el alcance del coordinador.
          Los permisos de asistentes se administran desde Asistentes y solicitudes.</p>
      </section>`;
    }
    const asignados =
      obtenerCodigosPermisos(
        permisosUsuario,
      );

    const esAdmin =
      usuarioEsAdminGlobal(
        usuario,
      );

    if (esAdmin) {
      return `
        <section
          id="permisosCreacionSection"
          class="usuario-permission-manager"
        >

          <div
            class="usuario-permission-header"
          >

            <div>

              <h4>
                Permisos granulares
              </h4>

              <p>
                Este usuario posee el rol de
                ${escapeHtml(nombreVisibleRol(ROLES.ADMIN_GLOBAL))}.
              </p>

            </div>

          </div>


          <div
            class="usuario-permission-superuser"
          >

            <i
              data-lucide="shield-check"
              aria-hidden="true"
            ></i>


            <div>

              <strong>
                Acceso de superusuario
              </strong>

              <p>
                El ${escapeHtml(nombreVisibleRol(ROLES.ADMIN_GLOBAL))} cuenta con acceso administrativo total en el sistema y no requiere permisos granulares individuales.
              </p>

            </div>

          </div>

        </section>
      `;
    }

    return `
      <section
        class="usuario-permission-manager"
      >

        <div
          class="usuario-permission-header"
        >

          <div>

            <h4>
              Permisos granulares
            </h4>

            <p>
              Defina las operaciones
              administrativas adicionales
              permitidas para este usuario.
            </p>

          </div>


          <span
            class="usuario-permission-count"
          >
            ${
              asignados.size
            }
            asignados
          </span>

        </div>


        <div
          class="usuario-permission-grid"
        >
          ${renderizarOpcionesPermisos(asignados)}
        </div>


        <div
          class="usuario-permission-actions"
        >

          <small>
            Los permisos no seleccionados
            serán removidos al guardar.
          </small>


          <button
            type="button"
            class="usuarios-secondary-button"
            data-action="guardar-permisos"
            data-user-id="${
              usuario.id
            }"
          >
            <i
              data-lucide="shield-check"
              aria-hidden="true"
            ></i>

            Guardar permisos
          </button>

        </div>

      </section>
    `;
  }

  function renderizarDialogoCreacion() {
    mostrarFormularioUsuario({
      formId: 'usuarioForm',
      title: 'Nuevo usuario',
      description: 'Cree una cuenta institucional y asigne al menos un rol oficial.',
      body: `
        <div class="usuario-dialog-feedback hidden" role="status" aria-live="polite"></div>
        <div class="usuario-section-heading">
          <span class="usuario-section-icon"><i data-lucide="user-round" aria-hidden="true"></i></span>
          <div><h4>Información personal</h4><p>Datos de identificación y contacto institucional.</p></div>
        </div>
        ${camposUsuario()}

        <div class="usuario-invitacion-banner">
          <i data-lucide="mail" aria-hidden="true"></i>
          <div>
            <strong>Invitación por correo electrónico</strong>
            <p>No se requiere contraseña temporal. Al crear la cuenta se enviará una invitación segura para que el usuario configure su acceso.</p>
          </div>
        </div>

        <fieldset class="usuario-role-options">
          <legend>Roles iniciales <b class="usuario-obligatorio" aria-hidden="true">*</b></legend>
          <small class="usuario-roles-error hidden" role="alert">Seleccione al menos un rol para crear el usuario.</small>
          ${estado.roles.map((rol) => `
            <label>
              <input type="checkbox" name="roles" value="${escapeHtml(rol.nombre)}">
              <span>
                <strong>${escapeHtml(nombreVisibleRol(rol.nombre))}</strong>
                <small>${escapeHtml(rol.descripcion || '')}</small>
              </span>
            </label>
          `).join('')}
        </fieldset>

        <section id="carrerasCreacionSection" class="usuario-role-manager hidden">
          <div class="usuario-permission-header">
            <div>
              <h4>Carreras asignadas (Profesor)</h4>
              <p>Seleccione las carreras a las que pertenece el docente.</p>
            </div>
          </div>
          <div class="usuario-carreras-grid">${renderizarOpcionesCarreras()}</div>
        </section>

        <section class="usuario-permission-manager">
          <div class="usuario-permission-header">
            <div>
              <h4>Permisos iniciales</h4>
              <p>Se sugieren según los roles, pero puede agregar o quitar cualquiera antes de crear el usuario.</p>
            </div>
          </div>
          <div id="permisosCreacionUsuario" class="usuario-permission-grid">
            ${renderizarOpcionesPermisos()}
          </div>
        </section>
      `,
      footerHtml: `
        <button class="sgpa-form-secondary" type="button" data-action="cerrar-dialogo">Cancelar</button>
        <button class="sgpa-form-primary" type="submit">
          <i data-lucide="user-plus" aria-hidden="true"></i><span>Crear usuario</span>
        </button>
      `,
    });
  }

  function renderizarDialogoJerarquia(usuario, configuracion, auditoria = []) {
    const asignadas = new Map((configuracion.carreras || []).map((c) => [Number(c.carreraId), new Set(c.permisos || [])]));
    mostrarFormularioUsuario({
      formId: 'jerarquiaForm',
      userId: usuario.id,
      title: `Carreras y permisos de ${obtenerNombreCompleto(usuario)}`,
      description: 'Seleccione las operaciones autorizadas en cada carrera. La revocación se aplica a sus asistentes.',
      body: `
        <div class="usuario-dialog-feedback hidden" role="status" aria-live="polite"></div>
        <div class="usuario-section-heading">
          <span class="usuario-section-icon"><i data-lucide="shield-check" aria-hidden="true"></i></span>
          <div><h4>Alcance académico por carrera</h4><p>Marque las carreras y los permisos que corresponden.</p></div>
        </div>
        <div class="usuarios-alcances">
          ${estado.carreras.map((carrera) => {
            const permisos = asignadas.get(Number(carrera.id)) || new Set();
            return `<fieldset class="usuarios-alcance" data-carrera-id="${carrera.id}">
              <legend>
                <label><input type="checkbox" name="jerarquia-carrera" value="${carrera.id}"
                  ${asignadas.has(Number(carrera.id)) ? 'checked' : ''}>
                  ${escapeHtml(carrera.nombre)} (${escapeHtml(carrera.codigo)})</label>
              </legend>
              <label class="usuarios-alcance-seleccionar-todos">
                <input type="checkbox" name="jerarquia-todos-permisos">
                <span>Seleccionar todos los permisos de esta carrera</span>
              </label>
              <div class="usuarios-alcance-permisos">
                ${estado.permisosCatalogo.filter((permiso) =>
                  [
                    'ESTUDIANTES_VER',
                    'ESTUDIANTES_GESTIONAR',
                    'CURSOS_VER',
                    'CURSOS_GESTIONAR',
                    'PLANES_ESTUDIO_VER',
                    'PLANES_ESTUDIO_GESTIONAR',
                    'OPTATIVAS_VER',
                    'OPTATIVAS_GESTIONAR',
                  ].includes(permiso)).map((permiso) => `
                  <label><input type="checkbox" name="jerarquia-permiso" value="${escapeHtml(permiso)}"
                    ${permisos.has(permiso) ? 'checked' : ''}>
                    ${escapeHtml(obtenerInformacionPermiso(permiso).nombre)}</label>
                `).join('')}
              </div>
            </fieldset>`;
          }).join('')}
        </div>
        <section class="usuarios-auditoria">
          <div class="usuario-section-heading">
            <span class="usuario-section-icon"><i data-lucide="history" aria-hidden="true"></i></span>
            <div><h4>Historial reciente</h4><p>Registro de las últimas modificaciones al alcance.</p></div>
          </div>
          ${auditoria.length ? `<ul>${auditoria.map((item) => `
            <li>${escapeHtml(item.accion)} · ${escapeHtml(new Date(item.createdAt).toLocaleString('es-CR'))}</li>
          `).join('')}</ul>` : '<p class="usuarios-muted">Sin cambios registrados.</p>'}
        </section>
      `,
      footerHtml: `
        <button class="sgpa-form-secondary" type="button" data-action="cerrar-dialogo">Cancelar</button>
        <button class="sgpa-form-primary" type="submit">
          <i data-lucide="save" aria-hidden="true"></i><span>Guardar alcance</span>
        </button>
      `,
    });
    dialogoContenido.querySelectorAll('.usuarios-alcance')
      .forEach(actualizarSeleccionTodosPermisosCarrera);
  }

  function actualizarSeleccionTodosPermisosCarrera(campo) {
    const selector = campo?.querySelector(
      '[name="jerarquia-todos-permisos"]',
    );
    if (!selector) return;

    const estadoSeleccion = obtenerEstadoSeleccionPermisosCarrera(
      campo.querySelectorAll('[name="jerarquia-permiso"]'),
    );
    selector.checked = estadoSeleccion.checked;
    selector.indeterminate = estadoSeleccion.indeterminate;
    selector.disabled = estadoSeleccion.disabled;
  }

  function renderizarDialogoEdicion(
    usuario,
    permisosUsuario = [],
  ) {
    const rolesUsuario = obtenerRoles(usuario);
    const nombresAsignados = new Set(rolesUsuario.map((rol) => rol.nombre));
    const rolesDisponibles = estado.roles.filter(
      (rol) => !nombresAsignados.has(rol.nombre),
    );
    const esProfesor = rolesUsuario.some((rol) => rol.nombre === ROLES.PROFESOR);
    const carrerasAsignadas = new Set((usuario.carreras || []).map((c) => c.id));

    mostrarFormularioUsuario({
      formId: 'usuarioForm',
      userId: usuario.id,
      title: 'Editar usuario',
      description: 'Actualice sus datos administrativos, roles, carreras y permisos.',
      body: `
        <div class="usuario-dialog-feedback hidden" role="status" aria-live="polite"></div>
        <div class="usuario-section-heading">
          <span class="usuario-section-icon"><i data-lucide="user-round" aria-hidden="true"></i></span>
          <div><h4>Información personal</h4><p>Datos de identificación y contacto institucional.</p></div>
        </div>
        ${camposUsuario(usuario)}

        <section class="usuario-role-manager">
          <div class="usuario-section-heading">
            <span class="usuario-section-icon"><i data-lucide="users" aria-hidden="true"></i></span>
            <div><h4>Roles asignados</h4><p>Administre los perfiles de acceso del usuario.</p></div>
          </div>
          <div class="usuario-assigned-roles">
            ${rolesUsuario.length
              ? rolesUsuario.map((rol) => `
                  <span class="usuarios-role-badge is-removable">
                    ${escapeHtml(nombreVisibleRol(rol.nombre))}
                    <button type="button" data-action="revocar-rol"
                      data-user-id="${usuario.id}" data-role-id="${rol.id ?? ''}"
                      aria-label="Revocar ${escapeHtml(nombreVisibleRol(rol.nombre))}"
                      title="Revocar rol" ${rol.id == null ? 'disabled' : ''}>
                      <i data-lucide="x" aria-hidden="true"></i>
                    </button>
                  </span>
                `).join('')
              : '<span class="usuarios-no-role">Sin rol asignado</span>'}
          </div>

          <div class="usuario-add-role">
            <select id="rolParaAsignar" aria-label="Rol para asignar"
              ${rolesDisponibles.length ? '' : 'disabled'}>
              ${rolesDisponibles.length
                ? rolesDisponibles.map((rol) => `
                    <option value="${escapeHtml(rol.nombre)}">${escapeHtml(nombreVisibleRol(rol.nombre))}</option>
                  `).join('')
                : '<option>Todos los roles están asignados</option>'}
            </select>
            <button class="usuarios-secondary-button" type="button"
              data-action="asignar-rol" data-user-id="${usuario.id}"
              ${rolesDisponibles.length ? '' : 'disabled'}>
              <i data-lucide="plus" aria-hidden="true"></i>Agregar rol
            </button>
          </div>
        </section>

        ${esProfesor ? `
          <section class="usuario-role-manager">
            <div class="usuario-permission-header">
              <div>
                <h4>Carreras asignadas (Profesor)</h4>
                <p>Carreras asociadas al perfil docente de este usuario.</p>
              </div>
            </div>
            <div class="usuario-carreras-grid">${renderizarOpcionesCarreras(carrerasAsignadas)}</div>
          </section>
        ` : ''}

        ${renderizarGestorPermisos(usuario, permisosUsuario)}
      `,
      footerHtml: `
        <button class="sgpa-form-secondary" type="button" data-action="cerrar-dialogo">Cancelar</button>
        <button class="sgpa-form-primary" type="submit">
          <i data-lucide="save" aria-hidden="true"></i><span>Guardar cambios</span>
        </button>
      `,
    });
  }

  async function abrirEdicion(
    id,
  ) {
    ocultarFeedback();


    const [
      resultadoUsuario,
      resultadoPermisos,
    ] = await Promise.all([

      obtenerUsuarioDetalle(
        id,
      ),

      listarPermisosUsuario(
        id,
      ),

    ]);


    const usuario =
      mensajeResultado(
        resultadoUsuario,
        'No fue posible obtener el usuario.',
      );


    const permisos =
      mensajeResultado(
        resultadoPermisos,
        'No fue posible consultar los permisos del usuario.',
      );


    if (!sigueActiva()) {
      return;
    }


    renderizarDialogoEdicion(
      usuario.data,
      permisos.permisos,
    );
  }

  async function actualizarVistaYDialogo(
    id,
  ) {
    await cargarUsuarios(
      false,
    );


    const [
      resultadoUsuario,
      resultadoPermisos,
    ] = await Promise.all([

      obtenerUsuarioDetalle(
        id,
      ),

      listarPermisosUsuario(
        id,
      ),

    ]);


    const usuario =
      mensajeResultado(
        resultadoUsuario,
        'No fue posible actualizar el detalle.',
      );


    const permisos =
      mensajeResultado(
        resultadoPermisos,
        'No fue posible actualizar los permisos.',
      );


    if (!sigueActiva()) {
      return;
    }


    renderizarDialogoEdicion(
      usuario.data,
      permisos.permisos,
    );
  }

  pagina.addEventListener('input', (event) => {
    const campoUsuario = event.target.closest?.('#usuarioForm .usuario-campo input');
    if (campoUsuario) {
      const anterior = campoUsuario.value;
      const nombre = campoUsuario.name;
      const depurado = nombre === 'cedula'
        ? anterior.replace(/\D/g, '')
        : ['nombres', 'apellido1', 'apellido2'].includes(nombre)
          ? anterior.replace(EXPRESION_CARACTERES_NOMBRE, '')
          : anterior;

      // La cédula no admite letras, y los nombres y apellidos no admiten números,
      // ni siquiera al pegar texto. Conservar el cursor al eliminar caracteres.
      if (depurado !== anterior) {
        const cursor = campoUsuario.selectionStart;
        const nuevaPosicion = Number.isInteger(cursor)
          ? (nombre === 'cedula'
            ? anterior.slice(0, cursor).replace(/\D/g, '').length
            : ['nombres', 'apellido1', 'apellido2'].includes(nombre)
              ? anterior.slice(0, cursor).replace(EXPRESION_CARACTERES_NOMBRE, '').length
              : cursor)
          : null;
        campoUsuario.value = depurado;
        if (nuevaPosicion != null) campoUsuario.setSelectionRange(nuevaPosicion, nuevaPosicion);
      }

      const formulario = campoUsuario.closest('#usuarioForm');
      if (formulario?.dataset.validacionIntentada === 'true') {
        validarCamposUsuario(
          formulario,
          leerDatosUsuarioFormulario(formulario),
          Number(formulario.dataset.userId),
        );
      } else {
        mostrarErrorCampoUsuario(campoUsuario);
      }
    }

    if (event.target.id !== 'usuariosBuscar') return;
    estado.filtro = event.target.value;
    renderizarTabla();
  });

  pagina.addEventListener('change', (event) => {
    const campoCarrera = event.target.closest?.(
      '#jerarquiaForm .usuarios-alcance',
    );

    if (
      campoCarrera &&
      event.target.name === 'jerarquia-todos-permisos'
    ) {
      establecerSeleccionPermisosCarrera(
        campoCarrera.querySelectorAll('[name="jerarquia-permiso"]'),
        event.target.checked,
      );

      if (event.target.checked) {
        const carrera = campoCarrera.querySelector(
          '[name="jerarquia-carrera"]',
        );
        if (carrera && !carrera.disabled) {
          carrera.checked = true;
        }
      }

      actualizarSeleccionTodosPermisosCarrera(campoCarrera);
      return;
    }

    if (
      campoCarrera &&
      event.target.name === 'jerarquia-permiso'
    ) {
      if (event.target.checked) {
        const carrera = campoCarrera.querySelector(
          '[name="jerarquia-carrera"]',
        );
        if (carrera && !carrera.disabled) {
          carrera.checked = true;
        }
      }

      actualizarSeleccionTodosPermisosCarrera(campoCarrera);
      return;
    }

    if (
      event.target.name === 'roles' &&
      dialogo?.open &&
      !dialogoContenido.querySelector('#usuarioForm')?.dataset.userId
    ) {
      aplicarPlantillaCreacion();
      const formulario = dialogoContenido.querySelector('#usuarioForm');
      if (formulario?.dataset.validacionIntentada === 'true') {
        validarCamposUsuario(
          formulario,
          leerDatosUsuarioFormulario(formulario),
          Number(formulario.dataset.userId),
        );
      }
    }
  });

  pagina.addEventListener('submit', async (event) => {
    if (event.target.id !== 'usuarioForm') return;
    event.preventDefault();

    const formulario = event.target;
    const boton = formulario.querySelector('[type="submit"]');
    const datos = new FormData(formulario);
    const id = Number(formulario.dataset.userId);

    const usuario = leerDatosUsuarioFormulario(formulario);

    // Se muestran todos los campos faltantes, sin el aviso genérico del navegador.
    // La edición conserva su lógica y la creación conserva la obligatoriedad del rol.
    formulario.dataset.validacionIntentada = 'true';
    if (!validarCamposUsuario(formulario, usuario, id, { enfocar: true })) return;

    try {
      boton.disabled = true;

      if (id) {
        const tieneSelectorCarreras = formulario.querySelector(
          'input[name="carreras"]',
        );
        const carreraIds = tieneSelectorCarreras
          ? datos.getAll('carreras').map(Number)
          : undefined;

        mensajeResultado(
          await actualizarUsuario(id, {
            ...usuario,
            ...(carreraIds !== undefined ? { carreraIds } : {}),
          }),
          'No fue posible actualizar el usuario.',
        );
        mostrarFeedback('Usuario actualizado correctamente.');
      } else {
        const roles = datos.getAll('roles');
        if (!roles.length) {
          throw new Error('Seleccione al menos un rol.');
        }

        const permisos = datos.getAll('permisos');
        const carreraIds = roles.includes(ROLES.PROFESOR)
          ? datos.getAll('carreras').map(Number)
          : [];

        mensajeResultado(
          await crearUsuario({
            ...usuario,
            roles,
            permisos: roles.includes(ROLES.ADMIN_GLOBAL)
              ? []
              : permisos,
            carreraIds,
          }),
          'No fue posible crear el usuario.',
        );
        mostrarFeedback(roles.includes(ROLES.COORDINADOR)
          ? 'Coordinador creado. Configure sus carreras y permisos con el botón de escudo.'
          : 'Usuario creado. Se envió la invitación a su correo.');
      }


      dialogo.close();
      await cargarUsuarios(false);
    } catch (error) {
      mostrarFeedback(error.message, 'error');
      boton.disabled = false;
    }
  });

  pagina.addEventListener('submit', async (event) => {
    if (event.target.id !== 'jerarquiaForm') return;
    event.preventDefault();
    const formulario = event.target;
    const boton = formulario.querySelector('[type="submit"]');
    const carreras = [...formulario.querySelectorAll('.usuarios-alcance')]
      .filter((campo) => campo.querySelector('[name="jerarquia-carrera"]')?.checked)
      .map((campo) => ({
        carreraId: Number(campo.dataset.carreraId),
        permisos: [...campo.querySelectorAll('[name="jerarquia-permiso"]:checked')].map((input) => input.value),
      }));
    try {
      boton.disabled = true;
      mensajeResultado(
        await configurarCoordinadorJerarquia(Number(formulario.dataset.userId), carreras),
        'No fue posible guardar el alcance del coordinador.',
      );
      dialogo.close();
      mostrarFeedback('Carreras y permisos actualizados.');
    } catch (error) {
      mostrarFeedback(error.message, 'error');
    } finally {
      boton.disabled = false;
    }
  });

  pagina.addEventListener('click', async (event) => {
    const boton = event.target.closest('[data-action]');
    if (!boton) return;

    const accion = boton.dataset.action;
    const id = Number(boton.dataset.userId);

    if (accion === 'cerrar-dialogo') {
      dialogo.close();
      return;
    }

    if (accion === 'editar') {
      try {
        boton.disabled = true;
        await abrirEdicion(id);
      } catch (error) {
        mostrarFeedback(error.message, 'error');
      } finally {
        boton.disabled = false;
      }
      return;
    }

    if (accion === 'configurar-jerarquia') {
      try {
        boton.disabled = true;
        const [configuracion, auditoria] = await Promise.all([
          obtenerCoordinadorJerarquia(id),
          listarAuditoriaJerarquia(id),
        ]);
        const datos = mensajeResultado(configuracion, 'No fue posible consultar el alcance.');
        if (!sigueActiva()) return;
        const usuario = estado.usuarios.find((item) => Number(item.id) === id);
        renderizarDialogoJerarquia(usuario, datos.data, auditoria.ok ? auditoria.data : []);
      } catch (error) {
        mostrarFeedback(error.message, 'error');
      } finally {
        boton.disabled = false;
      }
      return;
    }

    if (accion === 'estado') {
      const activo = boton.dataset.active === 'true';
      const verbo = activo ? 'desactivar' : 'activar';
      const nuevoEstado = !activo;
      const confirmado = await confirmarAccion({
        titulo: nuevoEstado ? 'Activar usuario' : 'Desactivar usuario',
        mensaje: `¿Desea ${verbo} este usuario?`,
        textoConfirmar: nuevoEstado ? 'Activar' : 'Desactivar',
        peligro: !nuevoEstado,
      });

      if (!confirmado) return;

      try {
        boton.disabled = true;
        mensajeResultado(
          await cambiarEstadoUsuario(id, !activo),
          `No fue posible ${verbo} el usuario.`,
        );
        mostrarFeedback(`Usuario ${activo ? 'desactivado' : 'activado'} correctamente.`);
        await cargarUsuarios(false);
      } catch (error) {
        mostrarFeedback(error.message, 'error');
        boton.disabled = false;
      }
      return;
    }

    if (accion === 'asignar-rol') {
      const selector = dialogoContenido.querySelector('#rolParaAsignar');
      if (!selector?.value) return;

      try {
        boton.disabled = true;
        mensajeResultado(
          await asignarRolUsuario(id, selector.value),
          'No fue posible asignar el rol.',
        );
        await actualizarVistaYDialogo(id);
        mostrarFeedback('Rol asignado correctamente.');
      } catch (error) {
        mostrarFeedback(error.message, 'error');
        boton.disabled = false;
      }
      return;
    }

    if (accion === 'revocar-rol') {
      const rolId = Number(boton.dataset.roleId);
      if (!rolId) return;

      const confirmado = await confirmarAccion({
        titulo: 'Revocar rol',
        mensaje: '¿Desea revocar este rol del usuario?',
        textoConfirmar: 'Revocar',
        peligro: true,
      });

      if (!confirmado) return;

      try {
        boton.disabled = true;
        mensajeResultado(
          await revocarRolUsuario(id, rolId),
          'No fue posible revocar el rol.',
        );
        await actualizarVistaYDialogo(id);
        mostrarFeedback('Rol revocado correctamente.');
      } catch (error) {
        mostrarFeedback(error.message, 'error');
        boton.disabled = false;
      }
      return;
    }

    if (
      accion ===
      'guardar-permisos'
    ) {

      const seleccionados =
        [
          ...dialogoContenido
            .querySelectorAll(
              'input[name="permisos"]:checked',
            ),
        ].map(
          (input) =>
            input.value,
        );


      try {

        boton.disabled =
          true;


        mensajeResultado(
          await reemplazarPermisosUsuario(
            id,
            seleccionados,
          ),
          'No fue posible guardar los permisos.',
        );


        await actualizarVistaYDialogo(
          id,
        );


        mostrarFeedback(
          'Permisos actualizados correctamente.',
        );

      } catch (error) {

        mostrarFeedback(
          error.message,
          'error',
        );


        boton.disabled =
          false;

      }


      return;
    }
  });

  pagina.querySelector('#nuevoUsuarioButton')?.addEventListener('click', () => {
    ocultarFeedback();
    renderizarDialogoCreacion();
  });

  habilitarCierreExterior(dialogo);

  try {
    await Promise.all([
      cargarRoles(),
      cargarCarreras(),
      cargarPermisosCatalogo(),
      cargarPlantillasPermisos(),
      cargarUsuarios(),
    ]);

  } catch (error) {
    console.error('Error cargando el módulo de usuarios:', error);
    if (!sigueActiva()) return;

    mostrarFeedback(error.message, 'error');
    contenido.innerHTML = `
      <div class="usuarios-message usuarios-error" role="alert">
        <h3>No fue posible cargar Usuarios</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}
