/**
 * SGPA — Barra de estado de Google Forms OAuth, acciones de toolbar y control de conexión.
 * FRONTEND-REFACTOR-FORMULARIOS-ESTUDIANTES-INTEGRAL-001
 */

import {
  conectarGoogleFormularios,
  desconectarGoogleFormularios,
  obtenerEstadoGoogleFormularios,
} from '../../services/formularios-estudiantes.service.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import {
  obtenerUsuario,
  obtenerVersionSesion,
  usuarioTienePermiso,
} from '../../app/session.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import { normalizarEstadoGoogle } from './formularios-estudiantes.helpers.js';

export const PERMISOS = Object.freeze({
  CREAR: 'FORMULARIOS_ESTUDIANTES_CREAR',
  GESTIONAR: 'FORMULARIOS_ESTUDIANTES_GESTIONAR',
  VER_RESPUESTAS: 'FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS',
});

export function renderizarEstadoGoogle(contexto) {
  const contenedor = document.getElementById('estadoGoogleFormularios');
  if (!contenedor) return;

  const estadoGoogle = contexto?.estado?.estadoGoogle || {};

  if (
    estadoGoogle.requiereReautenticacion ||
    estadoGoogle.estado === 'REQUIERE_REAUTENTICACION'
  ) {
    contenedor.innerHTML = `
      <div class="formularios-google-status formularios-google-disconnected">
        <span class="formularios-google-dot" aria-hidden="true"></span>
        <span>
          <strong>Google requiere reconexión</strong>
          <small>La autorización expiró o fue revocada.</small>
        </span>
      </div>
    `;
    return;
  }

  if (estadoGoogle.conectado) {
    contenedor.innerHTML = `
      <div class="formularios-google-status formularios-google-connected">
        <span class="formularios-google-dot" aria-hidden="true"></span>
        <span>
          <strong>Google conectado</strong>
        ${
          estadoGoogle.googleEmail
            ? `<small>${escapeHtml(estadoGoogle.googleEmail)}</small>`
            : ''
        }
        </span>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <div class="formularios-google-status formularios-google-disconnected">
      <span class="formularios-google-dot" aria-hidden="true"></span>
      <strong>Google no conectado</strong>
    </div>
  `;
}

export function renderizarAcciones(contexto, { onNuevoFormulario, onRecargar } = {}) {
  const contenedor = document.getElementById('accionesFormularios');
  if (!contenedor) return;

  const estadoGoogle = contexto?.estado?.estadoGoogle || {};
  const puedeCrear = usuarioTienePermiso(PERMISOS.CREAR);
  const puedeGestionar = usuarioTienePermiso(PERMISOS.GESTIONAR);

  const acciones = [];

  if (!estadoGoogle.conectado && puedeCrear) {
    acciones.push(`
      <button
        id="conectarGoogleButton"
        type="button"
        class="formularios-secondary-button"
      >
        <i
          data-lucide="link"
          aria-hidden="true"
        ></i>
        ${
          estadoGoogle.requiereReautenticacion
            ? 'Volver a conectar Google'
            : 'Conectar Google'
        }
      </button>
    `);
  }

  if (estadoGoogle.conectado && puedeGestionar) {
    acciones.push(`
      <button
        id="desconectarGoogleButton"
        type="button"
        class="formularios-secondary-button"
      >
        <i
          data-lucide="unlink"
          aria-hidden="true"
        ></i>
        Desconectar Google
      </button>
    `);
  }

  if (puedeCrear) {
    acciones.push(`
      <button
        id="nuevoFormularioButton"
        type="button"
        class="formularios-primary-button"
        title="Crear formulario de estudiantes en SGPA"
      >
        <i
          data-lucide="plus"
          aria-hidden="true"
        ></i>
        Nuevo formulario
      </button>
    `);
  }

  contenedor.innerHTML = acciones.join('');
  renderizarIconos();

  document
    .getElementById('nuevoFormularioButton')
    ?.addEventListener('click', () => {
      onNuevoFormulario?.();
    });

  document
    .getElementById('conectarGoogleButton')
    ?.addEventListener('click', () => {
      conectarGoogle(contexto);
    });

  document
    .getElementById('desconectarGoogleButton')
    ?.addEventListener('click', () => {
      desconectarGoogle(contexto, { onRecargar });
    });
}

export async function conectarGoogle(contexto) {
  try {
    const resultado = await conectarGoogleFormularios();

    if (resultado?.ok !== true || resultado?.abierto !== true) {
      throw new Error(
        resultado?.message ||
        'No fue posible abrir la autorización de Google en el navegador.'
      );
    }

    mostrarExito({
      titulo: 'Autorización de Google abierta',
      mensaje:
        'Completa la autorización en el navegador. Al volver al SGPA se actualizará el estado.',
    });
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible conectar Google',
      mensaje: error?.message || 'Inténtalo nuevamente.',
    });
  }
}

export async function desconectarGoogle(contexto, { onRecargar } = {}) {
  if (!contexto?.esInstanciaActiva?.(contexto.generacionInstancia)) return;
  if (!usuarioTienePermiso(PERMISOS.GESTIONAR)) return;
  if (
    typeof contexto.reservarDesconexionGoogle !== 'function' ||
    typeof contexto.registrarCanceladorDesconexion !== 'function' ||
    typeof contexto.retirarCanceladorDesconexion !== 'function' ||
    typeof contexto.liberarDesconexionGoogle !== 'function' ||
    typeof contexto.marcarDesconexionGoogleEnviada !== 'function'
  ) return;

  const genInstancia = contexto.generacionInstancia;
  const usuarioInicial = obtenerUsuario();
  const versionSesionInicial = obtenerVersionSesion();
  const tokenOperacion = contexto.reservarDesconexionGoogle();
  if (!tokenOperacion) return;

  if (contexto.estado) contexto.estado.desconectandoGoogle = true;

  try {
    const confirmacion = confirmarAccion({
      titulo: 'Desconectar Google',
      mensaje:
        'La cuenta dejará de estar disponible para nuevas operaciones con Google.',
      textoConfirmar: 'Desconectar',
      peligro: true,
    });
    contexto.registrarCanceladorDesconexion(tokenOperacion, () => {
      document
        .getElementById('sgpaConfirmDialog')
        ?.querySelector('#sgpaConfirmCancel')
        ?.click();
    });
    const aceptado = await confirmacion;
    contexto.retirarCanceladorDesconexion(tokenOperacion);

    if (!aceptado) return;
    if (!contexto?.esInstanciaActiva?.(genInstancia)) return;

    const sesionSigueVigente =
      obtenerVersionSesion() === versionSesionInicial &&
      obtenerUsuario() === usuarioInicial;
    const puedeGestionarAhora = usuarioTienePermiso(PERMISOS.GESTIONAR);
    if (!sesionSigueVigente || !puedeGestionarAhora) {
      mostrarError({
        titulo: 'Permiso requerido',
        mensaje: 'Tu sesión ya no tiene permiso para desconectar Google.',
      });
      return;
    }

    // No hay ningún await entre la revalidación de sesión y el envío al backend.
    if (!contexto.marcarDesconexionGoogleEnviada(tokenOperacion)) return;
    const resultado = await desconectarGoogleFormularios();

    if (!contexto?.esInstanciaActiva?.(genInstancia)) return;

    if (resultado && resultado.ok === false) {
      throw new Error(resultado.message || 'No fue posible desconectar Google.');
    }

    if (contexto?.estado) {
      contexto.estado.estadoGoogle = {
        conectado: false,
        requiereReautenticacion: false,
        estado: 'DESCONECTADO',
        googleEmail: null,
      };
    }

    renderizarEstadoGoogle(contexto);
    renderizarAcciones(contexto, { onRecargar });

    mostrarExito({
      titulo: 'Google desconectado',
      mensaje: 'La cuenta se desvinculó correctamente.',
    });
  } catch (error) {
    if (!contexto?.esInstanciaActiva?.(genInstancia)) return;
    mostrarError({
      titulo: 'No fue posible desconectar Google',
      mensaje: error?.message || 'Inténtalo nuevamente.',
    });
  } finally {
    contexto.liberarDesconexionGoogle(tokenOperacion);
    if (contexto?.esInstanciaActiva?.(genInstancia) && contexto?.estado) {
      contexto.estado.desconectandoGoogle = false;
    }
  }
}

export async function actualizarEstadoGoogleAlFoco(contexto) {
  if (!contexto?.esInstanciaActiva?.(contexto.generacionInstancia)) return;

  const genInstancia = contexto.generacionInstancia;
  const genGoogle =
    typeof contexto.incrementarGeneracionEstadoGoogle === 'function'
      ? contexto.incrementarGeneracionEstadoGoogle()
      : 0;

  const pagina = document.getElementById('formulariosEstudiantesPage');
  if (!pagina) return;

  try {
    const google = await obtenerEstadoGoogleFormularios();

    if (!contexto.esInstanciaActiva(genInstancia)) return;
    if (
      typeof contexto.esEstadoGoogleActivo === 'function' &&
      !contexto.esEstadoGoogleActivo(genGoogle, genInstancia)
    ) {
      return;
    }

    if (!document.getElementById('formulariosEstudiantesPage')) return;

    contexto.estado.estadoGoogle = normalizarEstadoGoogle(google);
    renderizarEstadoGoogle(contexto);
    renderizarAcciones(contexto);
  } catch (error) {
    if (!contexto?.esInstanciaActiva?.(genInstancia)) return;
    if (
      typeof contexto.esEstadoGoogleActivo === 'function' &&
      !contexto.esEstadoGoogleActivo(genGoogle, genInstancia)
    ) {
      return;
    }
    console.error('No se pudo actualizar el estado de Google:', error);
  }
}
