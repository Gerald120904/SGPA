import { SelectorRolActivo, iniciarSelectorRol } from './RoleSelector.js';
import { cambiarCarreraActiva } from '../app/session.js';
import { escapeHtml } from '../utils/html.js';
import { crearGestorEventos } from '../utils/event-lifecycle.js';

let topbarActivaInstancia = null;

/**
 * Renderiza la barra superior institucional con el contexto de carrera activa
 * (cuando aplica) y el selector de rol activo.
 */
export function Topbar({ usuario }) {
  const carreras =
    usuario?.rolActivo === 'ASISTENTE_ESTUDIANTIL'
      ? (usuario.carrerasDisponibles || []).filter((c) => c.permisos?.length)
      : [];

  return `
    <header class="topbar">

      <!-- =============================================== -->
      <!-- SISTEMA -->
      <!-- =============================================== -->

      <div class="topbar-heading">

        <h1 class="topbar-system-title">
          Sistema de Gestión y Proyección Académica
        </h1>

        <p class="topbar-subtitle">
          Campus Nicoya
        </p>

      </div>


      <!-- =============================================== -->
      <!-- USUARIO -->
      <!-- =============================================== -->

      <div class="topbar-user">
        ${
          carreras.length > 1
            ? `<label>Carrera activa
          <select id="carreraActivaSelector" aria-label="Carrera activa">
            ${carreras
              .map(
                (c) =>
                  `<option value="${Number(c.id)}" ${Number(c.id) === Number(usuario.carreraActiva) ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`,
              )
              .join('')}
          </select></label>`
            : ''
        }

        <!-- Rol real de sesión; los nombres de usuario siguen en el pie del Sidebar -->
        <div class="topbar-role-slot">
          ${SelectorRolActivo({ usuario })}
        </div>

        <!-- Se retira el avatar superior: el usuario sigue identificado
             en el pie del Sidebar y el rol activo ocupa el extremo derecho. -->

      </div>

    </header>
  `;
}

/**
 * Inicializa los controles interactivos de la barra superior (selector de carrera
 * y selector de rol activo) garantizando limpieza al desmontar o re-inicializar.
 */
export function iniciarTopbar({
  usuario = null,
  onCambiarRol,
  onCambiarCarrera,
  onError,
  container = null,
  gestionarResize = true,
} = {}) {
  topbarActivaInstancia?.destruir();

  const gestor = crearGestorEventos();
  const doc = typeof document !== 'undefined' ? document : null;

  let selectorCarrera =
    container?.querySelector?.('#carreraActivaSelector') ||
    doc?.getElementById?.('carreraActivaSelector') ||
    null;

  const selectorRol = iniciarSelectorRol({
    onCambiarRol,
    onError,
    container,
    gestionarResize,
  });

  let carreraPrevia =
    usuario?.carreraActiva != null
      ? String(usuario.carreraActiva)
      : selectorCarrera?.value || '';
  let cambiandoCarrera = false;

  if (selectorCarrera) {
    gestor.escuchar(selectorCarrera, 'change', async (event) => {
      if (gestor.destruido || cambiandoCarrera) return;

      const target = event?.target || selectorCarrera;
      const carreraId = Number(target.value);
      cambiandoCarrera = true;
      target.disabled = true;

      try {
        const usuarioActualizado = await cambiarCarreraActiva(carreraId, {
          vigente: () => !gestor.destruido,
        });
        if (gestor.destruido) return;
        carreraPrevia = String(carreraId);
        if (typeof onCambiarCarrera === 'function') {
          await onCambiarCarrera(usuarioActualizado);
        }
      } catch (error) {
        if (gestor.destruido) return;
        target.disabled = false;
        if (carreraPrevia) {
          target.value = carreraPrevia;
        }
        const mensaje = error?.message || 'No fue posible cambiar de carrera.';
        if (typeof onError === 'function') {
          onError(mensaje);
        } else if (typeof globalThis.alert === 'function') {
          globalThis.alert(mensaje);
        }
      } finally {
        cambiandoCarrera = false;
      }
    });
  }

  const instancia = {
    cerrarMenus: () => selectorRol.cerrarMenu(),
    reposicionarMenus: () => {
      if (selectorRol.estaAbierto()) {
        selectorRol.posicionarMenu();
      }
    },
    destruir() {
      selectorRol.destruir();
      gestor.destruir();
      if (topbarActivaInstancia === instancia) {
        topbarActivaInstancia = null;
      }
      selectorCarrera = null;
    },
  };

  gestor.registrarLimpieza(() => {
    selectorRol.destruir();
    if (topbarActivaInstancia === instancia) {
      topbarActivaInstancia = null;
    }
    selectorCarrera = null;
  });

  topbarActivaInstancia = instancia;
  return instancia;
}
