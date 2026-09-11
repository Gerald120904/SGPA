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
import { ROLES } from '../../config/permissions.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { confirmarAccion } from '../../utils/confirm.js';

let instanciaActual = 0;

export function UsuariosPage() {
  return `
    <section
      id="usuariosPage"
      class="module-view usuarios-page"
    >
      <div class="usuarios-toolbar">
        <div>
          <h2>Usuarios</h2>
          <p>Administración de cuentas, roles y accesos del SGPA.</p>
        </div>

        <button
          id="nuevoUsuarioButton"
          class="usuarios-primary-button"
          type="button"
        >
          <i data-lucide="user-plus" aria-hidden="true"></i>
          Nuevo usuario
        </button>
      </div>

      <div
        id="usuariosFeedback"
        class="usuarios-feedback hidden"
        role="status"
      ></div>

      <label class="usuarios-search" for="usuariosBuscar">
        <i data-lucide="search" aria-hidden="true"></i>
        <input
          id="usuariosBuscar"
          type="search"
          placeholder="Buscar por nombre, cédula, correo o rol..."
          autocomplete="off"
        >
      </label>

      <div
        id="usuariosContent"
        class="usuarios-content"
        aria-live="polite"
      >
        <div class="usuarios-message">Cargando usuarios...</div>
      </div>

      <dialog id="usuarioDialog" class="usuario-dialog">
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

  AULAS_CAMBIO_AUTORIZAR: {
    nombre:
      'Autorizar cambios de aula',

    descripcion:
      'Permite autorizar excepciones o cambios de aula cuando el proceso académico lo requiera.',
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

export async function iniciarUsuariosPage() {
  const pagina = document.getElementById('usuariosPage');

  if (!pagina) {
    return;
  }

  const instancia = ++instanciaActual;
  const estado = {
    usuarios: [],
    roles: [],
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

    const sugeridos =
      obtenerPermisosSugeridosRoles(
        roles,
      );

    dialogoContenido
      .querySelectorAll(
        'input[name="permisos"]',
      )
      .forEach(
        (input) => {
          input.checked =
            sugeridos.has(
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

    const termino = estado.filtro.trim().toLowerCase();
    const usuarios = estado.usuarios.filter((usuario) => {
      const texto = [
        usuario.cedula,
        obtenerNombreCompleto(usuario),
        usuario.correo,
        ...obtenerRoles(usuario).map((rol) => rol.nombre),
      ].join(' ').toLowerCase();

      return texto.includes(termino);
    });

    const filas = usuarios.map((usuario) => {
      const roles = obtenerRoles(usuario);
      const badges = roles.length
        ? roles.map((rol) => `
            <span
              class="usuarios-role-badge"
              title="${escapeHtml(rol.descripcion || rol.nombre)}"
            >${escapeHtml(rol.nombre)}</span>
          `).join('')
        : '<span class="usuarios-no-role">Sin rol asignado</span>';

      return `
        <tr>
          <td>${escapeHtml(usuario.cedula)}</td>
          <td>
            <strong>${escapeHtml(obtenerNombreCompleto(usuario))}</strong>
          </td>
          <td>${escapeHtml(usuario.correo)}</td>
          <td><div class="usuarios-role-list">${badges}</div></td>
          <td>
            <span class="usuarios-status ${usuario.activo ? 'is-active' : 'is-inactive'}">
              ${usuario.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td>
            <div class="usuarios-actions">
              <button
                class="usuarios-icon-button"
                type="button"
                data-action="editar"
                data-user-id="${usuario.id}"
                aria-label="Editar ${escapeHtml(obtenerNombreCompleto(usuario))}"
                title="Editar usuario"
              >
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>
              <button
                class="usuarios-icon-button ${usuario.activo ? 'is-danger' : 'is-success'}"
                type="button"
                data-action="estado"
                data-user-id="${usuario.id}"
                data-active="${usuario.activo}"
                aria-label="${usuario.activo ? 'Desactivar' : 'Activar'} usuario"
                title="${usuario.activo ? 'Desactivar' : 'Activar'}"
              >
                <i data-lucide="power" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    contenido.innerHTML = `
      <div class="usuarios-table-wrap">
        <table class="usuarios-table">
          <thead>
            <tr>
              <th>Cédula</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Roles</th>
              <th>Estado</th>
              <th><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            ${filas || `
              <tr>
                <td class="usuarios-empty" colspan="6">
                  ${termino
                    ? 'No hay usuarios que coincidan con la búsqueda.'
                    : 'No hay usuarios registrados.'}
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    `;

    renderizarIconos();
  }

  async function cargarUsuarios(mostrarCarga = true) {
    if (mostrarCarga && contenido) {
      contenido.innerHTML = '<div class="usuarios-message">Cargando usuarios...</div>';
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

  function camposUsuario(usuario = null) {
    return `
      <div class="usuario-form-grid">
        <label>
          <span>Cédula</span>
          <input name="cedula" required maxlength="20" value="${escapeHtml(usuario?.cedula || '')}">
        </label>
        <label>
          <span>Correo</span>
          <input name="correo" type="email" required maxlength="150" value="${escapeHtml(usuario?.correo || '')}">
        </label>
        <label>
          <span>Nombres</span>
          <input name="nombres" required maxlength="100" value="${escapeHtml(usuario?.nombres || '')}">
        </label>
        <label>
          <span>Primer apellido</span>
          <input name="apellido1" required maxlength="100" value="${escapeHtml(usuario?.apellido1 || '')}">
        </label>
        <label class="usuario-form-full">
          <span>Segundo apellido</span>
          <input name="apellido2" maxlength="100" value="${escapeHtml(usuario?.apellido2 || '')}">
        </label>
      </div>
    `;
  }

  function renderizarGestorPermisos(
    usuario,
    permisosUsuario,
  ) {
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
                Este usuario posee el rol
                ADMIN_GLOBAL.
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
                ADMIN_GLOBAL no necesita
                permisos granulares individuales.
                El backend le concede acceso
                administrativo automáticamente.
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
    dialogoContenido.innerHTML = `
      <form id="usuarioForm" class="usuario-form">
        <div class="usuario-dialog-header">
          <div>
            <h3>Nuevo usuario</h3>
            <p>Cree la cuenta y asigne al menos un rol oficial.</p>
          </div>
          <button class="usuarios-close-button" type="button" data-action="cerrar-dialogo" aria-label="Cerrar">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>

        <div
          class="usuario-dialog-feedback hidden"
          role="status"
        ></div>

        ${camposUsuario()}

        <label class="usuario-password-field">
          <span>Contraseña temporal</span>
          <input name="password" type="password" required minlength="8" maxlength="128" autocomplete="new-password">
          <small>Debe contener entre 8 y 128 caracteres.</small>
        </label>

        <fieldset class="usuario-role-options">
          <legend>Roles iniciales</legend>
          ${estado.roles.map((rol) => `
            <label>
              <input type="checkbox" name="roles" value="${escapeHtml(rol.nombre)}">
              <span>
                <strong>${escapeHtml(rol.nombre)}</strong>
                <small>${escapeHtml(rol.descripcion || '')}</small>
              </span>
            </label>
          `).join('')}
        </fieldset>

        <section
          class="usuario-permission-manager"
        >
          <div
            class="usuario-permission-header"
          >
            <div>
              <h4>
                Permisos iniciales
              </h4>

              <p>
                Se sugieren según los roles,
                pero puede agregar o quitar
                cualquiera antes de crear
                el usuario.
              </p>
            </div>
          </div>

          <div
            id="permisosCreacionUsuario"
            class="usuario-permission-grid"
          >
            ${renderizarOpcionesPermisos()}
          </div>
        </section>

        <div class="usuario-dialog-actions">
          <button class="usuarios-secondary-button" type="button" data-action="cerrar-dialogo">Cancelar</button>
          <button class="usuarios-primary-button" type="submit">Crear usuario</button>
        </div>
      </form>
    `;

    renderizarIconos();
    if (!dialogo.open) dialogo.showModal();
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

    dialogoContenido.innerHTML = `
      <form id="usuarioForm" class="usuario-form" data-user-id="${usuario.id}">
        <div class="usuario-dialog-header">
          <div>
            <h3>Editar usuario</h3>
            <p>Actualice sus datos administrativos, roles y permisos.</p>
          </div>
          <button class="usuarios-close-button" type="button" data-action="cerrar-dialogo" aria-label="Cerrar">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>

        <div
          class="usuario-dialog-feedback hidden"
          role="status"
        ></div>

        ${camposUsuario(usuario)}

        <section class="usuario-role-manager">
          <h4>Roles asignados</h4>
          <div class="usuario-assigned-roles">
            ${rolesUsuario.length
              ? rolesUsuario.map((rol) => `
                  <span class="usuarios-role-badge is-removable">
                    ${escapeHtml(rol.nombre)}
                    <button
                      type="button"
                      data-action="revocar-rol"
                      data-user-id="${usuario.id}"
                      data-role-id="${rol.id ?? ''}"
                      aria-label="Revocar ${escapeHtml(rol.nombre)}"
                      ${rol.id == null ? 'disabled' : ''}
                    >×</button>
                  </span>
                `).join('')
              : '<span class="usuarios-no-role">Sin rol asignado</span>'}
          </div>

          <div class="usuario-add-role">
            <select id="rolParaAsignar" ${rolesDisponibles.length ? '' : 'disabled'}>
              ${rolesDisponibles.length
                ? rolesDisponibles.map((rol) => `
                    <option value="${escapeHtml(rol.nombre)}">${escapeHtml(rol.nombre)}</option>
                  `).join('')
                : '<option>Todos los roles están asignados</option>'}
            </select>
            <button
              class="usuarios-secondary-button"
              type="button"
              data-action="asignar-rol"
              data-user-id="${usuario.id}"
              ${rolesDisponibles.length ? '' : 'disabled'}
            >Agregar rol</button>
          </div>
        </section>

        ${renderizarGestorPermisos(
          usuario,
          permisosUsuario,
        )}

        <div class="usuario-dialog-actions">
          <button class="usuarios-secondary-button" type="button" data-action="cerrar-dialogo">Cancelar</button>
          <button class="usuarios-primary-button" type="submit">Guardar cambios</button>
        </div>
      </form>
    `;

    renderizarIconos();
    if (!dialogo.open) dialogo.showModal();
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
    if (event.target.id !== 'usuariosBuscar') return;
    estado.filtro = event.target.value;
    renderizarTabla();
  });

  pagina.addEventListener('change', (event) => {
    if (
      event.target.name === 'roles' &&
      dialogo?.open &&
      !dialogoContenido.querySelector('#usuarioForm')?.dataset.userId
    ) {
      aplicarPlantillaCreacion();
    }
  });

  pagina.addEventListener('submit', async (event) => {
    if (event.target.id !== 'usuarioForm') return;
    event.preventDefault();

    const formulario = event.target;
    const boton = formulario.querySelector('[type="submit"]');
    const datos = new FormData(formulario);
    const id = Number(formulario.dataset.userId);

    const usuario = {
      cedula: datos.get('cedula').trim(),
      nombres: datos.get('nombres').trim(),
      apellido1: datos.get('apellido1').trim(),
      apellido2: datos.get('apellido2').trim() || null,
      correo: datos.get('correo').trim(),
    };

    if (!formulario.reportValidity()) return;

    try {
      boton.disabled = true;

      if (id) {
        mensajeResultado(
          await actualizarUsuario(id, usuario),
          'No fue posible actualizar el usuario.',
        );
        mostrarFeedback('Usuario actualizado correctamente.');
      } else {
        const roles = datos.getAll('roles');
        if (!roles.length) {
          throw new Error('Seleccione al menos un rol.');
        }

        const permisos = datos.getAll('permisos');

        mensajeResultado(
          await crearUsuario({
            ...usuario,
            password: datos.get('password'),
            roles,
            permisos: roles.includes(ROLES.ADMIN_GLOBAL)
              ? []
              : permisos,
          }),
          'No fue posible crear el usuario.',
        );
        mostrarFeedback('Usuario creado correctamente.');
      }

      dialogo.close();
      await cargarUsuarios(false);
    } catch (error) {
      mostrarFeedback(error.message, 'error');
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

  dialogo.addEventListener('click', (event) => {
    if (event.target === dialogo) dialogo.close();
  });

  try {
    await Promise.all([
      cargarRoles(),
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
