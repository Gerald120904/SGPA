import {
  listarUsuarios,
  obtenerUsuario as obtenerUsuarioDetalle,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  asignarRolUsuario,
  previsualizarRevocacionRol,
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
import { obtenerVersionSesion } from '../../app/session.js';
import { obtenerCoordinadorJerarquia, obtenerAsistenteAdminJerarquia,
  previsualizarCoordinadorJerarquia, previsualizarAsistenteAdminJerarquia,
  configurarCoordinadorJerarquia, configurarAsistenteAdminJerarquia,
  listarAuditoriaJerarquia } from '../../services/jerarquia.service.js';

import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import {
  nombreVisibleRol,
  normalizarRolesUsuario as obtenerRoles,
  obtenerNombreCompletoUsuario as obtenerNombreCompleto,
  mensajeResultado,
  obtenerPermisosSugeridosRoles as calcularPermisosSugeridosRoles,
  construirMensajeRevocacionRol,
  construirMensajeImpactoJerarquia,
  obtenerEstadoSeleccionPermisosCarrera,
  establecerSeleccionPermisosCarrera,
  filtrarListaUsuarios,
} from './usuarios.helpers.js';
import { renderizarCatalogoUsuarios } from './UsuariosCatalogo.js';
import { construirDialogoJerarquiaUsuario } from './UsuarioJerarquiaDialog.js';
import { construirDialogoConsultaAccesos } from './UsuarioAccesosDialog.js';
import {
  construirDialogoCreacionUsuario,
  construirDialogoEdicionUsuario,
} from './UsuarioFormDialog.js';

export {
  nombreVisibleRol,
  obtenerEstadoSeleccionPermisosCarrera,
  establecerSeleccionPermisosCarrera,
  filtrarListaUsuarios,
  construirMensajeRevocacionRol,
};

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

export async function iniciarUsuariosPage() {
  const pagina = document.getElementById('usuariosPage');

  if (!pagina) {
    return;
  }

  const instancia = ++instanciaActual;
  const versionSesion = obtenerVersionSesion();
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
    document.getElementById('usuariosPage') === pagina &&
    obtenerVersionSesion() === versionSesion
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

  function obtenerPermisosSugeridosRoles(roles) {
    return calcularPermisosSugeridosRoles(roles, estado.plantillasPermisos);
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

    const { resumenHtml, contadorTexto, tablaHtml } = renderizarCatalogoUsuarios({
      usuarios: estado.usuarios,
      filtro: estado.filtro,
    });

    const resumen = pagina.querySelector('#usuariosResumen');
    if (resumen) {
      resumen.innerHTML = resumenHtml;
    }

    const contador = pagina.querySelector('#usuariosContador');
    if (contador) {
      contador.textContent = contadorTexto;
    }

    contenido.innerHTML = tablaHtml;
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

  function renderizarDialogoCreacion() {
    mostrarFormularioUsuario(construirDialogoCreacionUsuario({
      roles: estado.roles,
      limites: LIMITES_USUARIO,
      carreras: estado.carreras,
      permisosCatalogo: estado.permisosCatalogo,
    }));
  }

  function renderizarDialogoJerarquia(usuario, configuracion, auditoria = [], esAsistente = false) {
    const dialogo = construirDialogoJerarquiaUsuario({
      usuario,
      configuracion,
      auditoria,
      esAsistente,
      carreras: estado.carreras,
      permisosCatalogo: estado.permisosCatalogo,
      obtenerNombreCompleto,
    });
    mostrarFormularioUsuario(dialogo);
    dialogoContenido.querySelectorAll('.usuarios-alcance')
      .forEach(actualizarSeleccionTodosPermisosCarrera);
    dialogoContenido.querySelector('#jerarquiaForm').dataset.adminAsistente = dialogo.esAsistente ? 'true' : 'false';
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

  function renderizarDialogoEdicion(usuario, permisosUsuario = []) {
    const nombresAsignados = new Set(obtenerRoles(usuario).map((rol) => rol.nombre));
    mostrarFormularioUsuario(construirDialogoEdicionUsuario({
      usuario,
      permisosUsuario,
      rolesDisponiblesCatalogo: estado.roles.filter((rol) => !nombresAsignados.has(rol.nombre)),
      carreras: estado.carreras,
      permisosCatalogo: estado.permisosCatalogo,
      limites: LIMITES_USUARIO,
    }));
  }

  // PBI-87: consulta de roles y permisos en solo lectura.
  // Reutiliza los endpoints actuales y el FormDialog; no cambia permisos.
  function mostrarConsultaAccesos(usuario, permisosUsuario = [], alcance = null, errorAlcance = '') {
    mostrarFormularioUsuario(
      construirDialogoConsultaAccesos({
        usuario,
        permisosUsuario,
        alcance,
        errorAlcance,
        carreras: estado.carreras,
      }),
    );
  }

  async function abrirConsultaAccesos(id) {
    ocultarFeedback();
    const [resultadoUsuario, resultadoPermisos] = await Promise.all([
      obtenerUsuarioDetalle(id),
      listarPermisosUsuario(id),
    ]);
    const usuario = mensajeResultado(resultadoUsuario, 'No fue posible consultar el usuario.').data;
    const permisos = mensajeResultado(resultadoPermisos, 'No fue posible consultar los permisos.').permisos;
    if (!sigueActiva()) return;

    const esCoordinador = obtenerRoles(usuario).some((rol) => rol.nombre === ROLES.COORDINADOR);
    let alcance = null;
    let errorAlcance = '';
    if (esCoordinador) {
      try {
        const resultado = mensajeResultado(
          await obtenerCoordinadorJerarquia(id),
          'No fue posible consultar el alcance académico.',
        );
        alcance = resultado.data;
      } catch (error) {
        errorAlcance = error?.message || 'Error de consulta';
      }
    }
    if (!sigueActiva()) return;
    mostrarConsultaAccesos(usuario, permisos, alcance, errorAlcance);
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
    if (!sigueActiva()) return;
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
    if (!sigueActiva()) return;
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
      const usuarioId = Number(formulario.dataset.userId);
      const esAsistente = formulario.dataset.adminAsistente === 'true';
      const impacto = mensajeResultado(await (esAsistente
        ? previsualizarAsistenteAdminJerarquia(usuarioId, carreras)
        : previsualizarCoordinadorJerarquia(usuarioId, carreras)),
        'No fue posible calcular el impacto de la revocación.').data;
      if (!sigueActiva()) return;
      const usuario = estado.usuarios.find((item) => Number(item.id) === usuarioId);
      const nombreObjetivo = usuario?.nombres || (esAsistente ? 'este asistente' : 'este coordinador');
      const resumen = construirMensajeImpactoJerarquia(impacto, nombreObjetivo, estado.carreras);
      const confirmado = await confirmarAccion({ titulo: 'Impacto del cambio de permisos',
        mensaje: resumen, textoConfirmar: 'Continuar', peligro: impacto.revocados.length > 0 });
      if (!confirmado || !sigueActiva()) return;
      mensajeResultado(
        await (esAsistente
          ? configurarAsistenteAdminJerarquia(usuarioId, carreras, impacto.firma)
          : configurarCoordinadorJerarquia(usuarioId, carreras, impacto.firma)),
        'No fue posible guardar el alcance del coordinador.',
      );
      if (!sigueActiva()) return;
      dialogo.close();
      mostrarFeedback('Carreras y permisos actualizados.');
    } catch (error) {
      if (sigueActiva()) mostrarFeedback(error.message, 'error');
    } finally {
      boton.disabled = false;
    }
  });

  pagina.addEventListener('click', async (event) => {
    const boton = event.target.closest('[data-action]');
    if (!boton) return;
    if (!sigueActiva()) return;

    const accion = boton.dataset.action;
    const id = Number(boton.dataset.userId);

    if (accion === 'cerrar-dialogo') {
      dialogo.close();
      return;
    }

    if (accion === 'ver-roles-permisos') {
      try {
        boton.disabled = true;
        await abrirConsultaAccesos(id);
      } catch (error) {
        if (sigueActiva()) mostrarFeedback(error.message, 'error');
      } finally {
        if (boton.isConnected) boton.disabled = false;
      }
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

    if (accion === 'configurar-asistente-admin') {
      try {
        boton.disabled = true;
        const [configuracion, auditoria] = await Promise.all([
          obtenerAsistenteAdminJerarquia(id), listarAuditoriaJerarquia(id),
        ]);
        const datos = mensajeResultado(configuracion, 'No fue posible consultar el alcance del asistente.');
        if (!sigueActiva()) return;
        const usuario = estado.usuarios.find((item) => Number(item.id) === id);
        renderizarDialogoJerarquia(usuario, datos.data, auditoria.ok ? auditoria.data : [], true);
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

      if (!confirmado || !sigueActiva()) return;

      try {
        boton.disabled = true;
        mensajeResultado(
          await cambiarEstadoUsuario(id, !activo),
          `No fue posible ${verbo} el usuario.`,
        );
        if (!sigueActiva()) return;
        mostrarFeedback(`Usuario ${activo ? 'desactivado' : 'activado'} correctamente.`);
        await cargarUsuarios(false);
      } catch (error) {
        if (sigueActiva()) mostrarFeedback(error.message, 'error');
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

      let impacto;
      try {
        impacto = mensajeResultado(await previsualizarRevocacionRol(id, rolId),
          'No fue posible calcular el impacto de la revocación.').data;
      } catch (error) {
        if (sigueActiva()) mostrarFeedback(error.message, 'error');
        return;
      }
      if (!sigueActiva()) return;

      const confirmado = await confirmarAccion({
        titulo: 'Revocar rol',
        mensaje: construirMensajeRevocacionRol(impacto, estado.carreras),
        textoConfirmar: 'Revocar',
        peligro: true,
      });

      if (!confirmado || !sigueActiva()) return;

      try {
        boton.disabled = true;
        mensajeResultado(
          await revocarRolUsuario(id, rolId, impacto.firma),
          'No fue posible revocar el rol.',
        );
        if (!sigueActiva()) return;
        await actualizarVistaYDialogo(id);
        mostrarFeedback('Rol revocado correctamente.');
      } catch (error) {
        if (sigueActiva()) mostrarFeedback(error.message, 'error');
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

/** Invalida respuestas tardías al abandonar Usuarios. */
export function destruirUsuariosPage() {
  instanciaActual += 1;
}
