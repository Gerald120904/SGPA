import {
  formatearRol,
  obtenerRolActivo,
  obtenerEspaciosDisponibles,
  cambiarRolActivo,
} from '../app/session.js';
import { escapeHtml } from '../utils/html.js';
import { crearGestorEventos } from '../utils/event-lifecycle.js';

let selectorActivoInstancia = null;

/**
 * Devuelve el nombre del ícono Lucide asociado al rol indicado.
 */
export function obtenerIconoRol(rol) {
  switch (rol) {
    case 'ADMIN_GLOBAL':
      return 'shield-check';
    case 'COORDINADOR':
      return 'briefcase';
    case 'PROFESOR':
      return 'graduation-cap';
    case 'ASISTENTE_ESTUDIANTIL':
      return 'user-cog';
    default:
      return 'user-cog';
  }
}

/**
 * Renderiza el selector institucional de rol activo alojado en Topbar.
 */
export function SelectorRolActivo({ usuario }) {
  const rolActivo = obtenerRolActivo(usuario) || usuario?.rolActivo || null;
  const espacios = obtenerEspaciosDisponibles(usuario);
  const tieneVariosRoles = espacios.length > 1;
  const nombreRolFormateado = rolActivo ? formatearRol(rolActivo) : 'Sin rol activo';
  const iconoRolActivo = obtenerIconoRol(rolActivo);

  return `
      <!-- =============================================== -->
      <!-- SELECTOR INSTITUCIONAL DE ROL ACTIVO -->
      <!-- =============================================== -->

      <div
        class="sidebar-role-container"
        id="sidebarRoleContainer"
        data-rol-activo="${escapeHtml(rolActivo || '')}"
      >

        <!-- Control select semántico/accesible para compatibilidad -->
        <select
          id="selectEspacioActivo"
          class="sr-only"
          aria-hidden="true"
          tabindex="-1"
          style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;"
        >
          ${espacios
            .map(
              (espacio) => `
            <option value="${escapeHtml(espacio)}" ${espacio === rolActivo ? 'selected' : ''}>
              ${escapeHtml(formatearRol(espacio))}
            </option>
          `,
            )
            .join('')}
        </select>

        <!-- Vista Expandida: selector institucional discreto -->
        <div class="role-selector-expanded">

          <div class="role-selector-header-row">
            <span class="role-selector-label" id="roleSelectorLabel">
              Rol activo
            </span>

            ${
              tieneVariosRoles
                ? `
              <span class="role-selector-badge" title="${espacios.length} roles disponibles">
                ${espacios.length} roles
              </span>
            `
                : ''
            }
          </div>

          <button
            id="btnRolActivoExpanded"
            class="role-selector-trigger ${tieneVariosRoles ? '' : 'is-single'}"
            type="button"
            aria-haspopup="${tieneVariosRoles ? 'listbox' : 'false'}"
            aria-expanded="false"
            aria-labelledby="roleSelectorLabel btnRolActivoExpanded"
            ${tieneVariosRoles ? 'title="Cambiar rol activo"' : `title="Rol activo: ${escapeHtml(nombreRolFormateado)}"`}
          >

            <span class="role-trigger-icon-wrap" aria-hidden="true">
              <i data-lucide="${iconoRolActivo}"></i>
            </span>

            <span class="role-trigger-content">
              <span class="role-trigger-name" title="${escapeHtml(nombreRolFormateado)}">
                ${escapeHtml(nombreRolFormateado)}
              </span>

              ${
                tieneVariosRoles
                  ? `
                <span class="role-trigger-action">
                  Cambiar rol
                </span>
              `
                  : `
                <span class="role-trigger-meta">
                  Rol asignado
                </span>
              `
              }
            </span>

            ${
              tieneVariosRoles
                ? `
              <span class="role-trigger-chevron" aria-hidden="true">
                <i data-lucide="chevron-down"></i>
              </span>
            `
                : ''
            }

          </button>

        </div>


        <!-- Vista Contraída: ícono compacto para menú flotante -->
        <div class="role-selector-collapsed">

          <button
            id="btnRolActivoCollapsed"
            class="role-selector-compact-btn ${tieneVariosRoles ? '' : 'is-single'}"
            type="button"
            aria-haspopup="${tieneVariosRoles ? 'listbox' : 'false'}"
            aria-expanded="false"
            aria-label="Rol activo: ${escapeHtml(nombreRolFormateado)}${tieneVariosRoles ? '. Cambiar rol' : ''}"
            title="Rol activo: ${escapeHtml(nombreRolFormateado)}${tieneVariosRoles ? ' (clic para cambiar)' : ''}"
          >
            <i data-lucide="${iconoRolActivo}" aria-hidden="true"></i>
          </button>

        </div>


        <!-- Menú flotante / Desplegable de roles -->
        ${
          tieneVariosRoles
            ? `
        <div
          id="menuRolesFlotante"
          class="role-dropdown-menu dropdown-expanded"
          role="listbox"
          aria-label="Roles asignados disponibles"
          tabindex="-1"
          hidden
        >

          <div class="role-menu-header">
            <span class="role-menu-title">
              Cambiar rol activo
            </span>
            <span class="role-menu-subtitle">
              Seleccione el espacio de trabajo
            </span>
          </div>

          <div class="role-menu-list">
            ${espacios
              .map((espacio) => {
                const esActivo = espacio === rolActivo;
                const nombreEspacio = formatearRol(espacio);
                const iconoEspacio = obtenerIconoRol(espacio);

                return `
                <button
                  type="button"
                  role="option"
                  class="role-menu-item ${esActivo ? 'active' : ''}"
                  data-rol="${escapeHtml(espacio)}"
                  aria-selected="${esActivo ? 'true' : 'false'}"
                  aria-label="${escapeHtml(nombreEspacio)}${esActivo ? ' (Rol actual)' : ''}"
                  tabindex="-1"
                >

                  <span class="role-item-icon ${esActivo ? 'active' : ''}" aria-hidden="true">
                    <i data-lucide="${iconoEspacio}"></i>
                  </span>

                  <div class="role-item-text">
                    <strong class="role-item-title">
                      ${escapeHtml(nombreEspacio)}
                    </strong>
                    <span class="role-item-desc">
                      ${esActivo ? 'Rol actual en uso' : 'Cambiar a este espacio'}
                    </span>
                  </div>

                  ${
                    esActivo
                      ? `
                    <span class="role-item-check" aria-hidden="true" title="Rol actual">
                      <i data-lucide="check"></i>
                    </span>
                  `
                      : ''
                  }

                </button>
              `;
              })
              .join('')}
          </div>

        </div>
        `
            : ''
        }

      </div>
  `;
}

function resolverElementoSelector(scope, id) {
  if (scope && typeof scope.querySelector === 'function') {
    const encontrado = scope.querySelector(`#${id}`);
    if (encontrado) return encontrado;
  }
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

/**
 * Inicializa el comportamiento interactivo del selector de rol activo.
 * Limpia cualquier instancia previa para evitar listeners globales acumulados.
 */
export function iniciarSelectorRol({
  onCambiarRol,
  onError,
  container = null,
  gestionarResize = true,
} = {}) {
  selectorActivoInstancia?.destruir();

  const gestor = crearGestorEventos();
  const doc = typeof document !== 'undefined' ? document : null;
  const win = typeof window !== 'undefined' ? window : null;

  let btnExpanded = resolverElementoSelector(container, 'btnRolActivoExpanded');
  let btnCollapsed = resolverElementoSelector(container, 'btnRolActivoCollapsed');
  let menu = resolverElementoSelector(container, 'menuRolesFlotante');
  let roleContainer = resolverElementoSelector(container, 'sidebarRoleContainer');
  let selectEspacio = resolverElementoSelector(container, 'selectEspacioActivo');

  let ultimoBotonDisparador = null;
  let focusTimer = null;
  let enProceso = false;

  function limpiarTimerFoco() {
    if (focusTimer !== null) {
      clearTimeout(focusTimer);
      focusTimer = null;
    }
  }

  function notificarError(mensaje) {
    if (typeof onError === 'function') {
      onError(mensaje);
      return;
    }
    if (typeof globalThis.alert === 'function') {
      globalThis.alert(mensaje);
    }
  }

  function posicionarMenu() {
    if (!menu || gestor.destruido) return;
    menu.classList.remove('dropdown-collapsed');
    menu.classList.add('dropdown-expanded');
    if (menu.style) {
      menu.style.position = 'absolute';
      menu.style.top = 'calc(100% + 6px)';
      menu.style.left = 'auto';
      menu.style.right = '0';
      menu.style.width = 'min(280px, calc(100vw - 24px))';
    }
  }

  function cerrarMenu() {
    limpiarTimerFoco();
    if (!menu || gestor.destruido) return;
    menu.setAttribute('hidden', '');
    btnExpanded?.setAttribute('aria-expanded', 'false');
    btnCollapsed?.setAttribute('aria-expanded', 'false');
  }

  function abrirMenu(disparador) {
    if (!menu || gestor.destruido) return;
    limpiarTimerFoco();
    ultimoBotonDisparador = disparador || null;
    posicionarMenu();
    menu.removeAttribute('hidden');
    disparador?.setAttribute('aria-expanded', 'true');

    const opcionActiva =
      menu.querySelector?.('.role-menu-item.active') ||
      menu.querySelector?.('.role-menu-item');

    if (opcionActiva && typeof opcionActiva.focus === 'function') {
      focusTimer = setTimeout(() => {
        focusTimer = null;
        if (!gestor.destruido && menu && !menu.hasAttribute('hidden')) {
          opcionActiva.focus();
        }
      }, 15);
    }
  }

  function toggleMenu(disparador) {
    if (!menu || gestor.destruido) return;
    const estaAbierto = !menu.hasAttribute('hidden');
    if (estaAbierto) {
      cerrarMenu();
    } else {
      abrirMenu(disparador);
    }
  }

  function bindTrigger(boton) {
    if (!boton || boton.classList?.contains('is-single')) return;

    gestor.escuchar(boton, 'click', (e) => {
      e?.stopPropagation?.();
      toggleMenu(boton);
    });

    gestor.escuchar(boton, 'keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirMenu(boton);
      }
    });
  }

  async function seleccionarRol(nuevoRol) {
    if (gestor.destruido || enProceso) return;

    const rolActual = roleContainer?.dataset?.rolActivo;
    if (!nuevoRol || nuevoRol === rolActual) {
      cerrarMenu();
      ultimoBotonDisparador?.focus?.();
      return;
    }

    enProceso = true;
    if (btnExpanded) btnExpanded.disabled = true;
    if (btnCollapsed) btnCollapsed.disabled = true;

    try {
      if (selectEspacio) {
        selectEspacio.value = nuevoRol;
      }

      const ok = await cambiarRolActivo(nuevoRol, undefined, {
        vigente: () => !gestor.destruido,
      });
      if (gestor.destruido) return;

      if (ok) {
        cerrarMenu();
        if (typeof onCambiarRol === 'function') {
          await onCambiarRol(nuevoRol);
        }
      } else {
        cerrarMenu();
        if (btnExpanded) btnExpanded.disabled = false;
        if (btnCollapsed) btnCollapsed.disabled = false;
        notificarError('No fue posible cambiar al rol seleccionado.');
      }
    } catch (err) {
      if (gestor.destruido) return;
      cerrarMenu();
      if (btnExpanded) btnExpanded.disabled = false;
      if (btnCollapsed) btnCollapsed.disabled = false;
      notificarError(err?.message || 'Error al cambiar de rol activo.');
    } finally {
      enProceso = false;
    }
  }

  bindTrigger(btnExpanded);
  bindTrigger(btnCollapsed);

  if (menu) {
    const opciones = Array.from(menu.querySelectorAll?.('.role-menu-item') || []);
    opciones.forEach((item) => {
      gestor.escuchar(item, 'click', async (e) => {
        e?.stopPropagation?.();
        const rol = item.dataset?.rol;
        await seleccionarRol(rol);
      });
    });

    gestor.escuchar(menu, 'keydown', async (e) => {
      const items = Array.from(menu?.querySelectorAll?.('.role-menu-item') || []);
      const activeElement = doc?.activeElement || null;
      const currentIndex = items.indexOf(activeElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length > 0) {
          items[(currentIndex + 1) % items.length]?.focus?.();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
          items[(currentIndex - 1 + items.length) % items.length]?.focus?.();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus?.();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus?.();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const rol = activeElement?.dataset?.rol;
        if (rol) {
          await seleccionarRol(rol);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cerrarMenu();
        ultimoBotonDisparador?.focus?.();
      } else if (e.key === 'Tab') {
        cerrarMenu();
      }
    });
  }

  if (menu && doc) {
    gestor.escuchar(doc, 'click', (e) => {
      if (!menu || menu.hasAttribute('hidden')) return;

      if (
        !menu.contains?.(e?.target) &&
        !btnExpanded?.contains?.(e?.target) &&
        !btnCollapsed?.contains?.(e?.target)
      ) {
        cerrarMenu();
      }
    });
  }

  if (menu && gestionarResize && win) {
    gestor.escuchar(win, 'resize', () => {
      if (menu && !menu.hasAttribute('hidden')) {
        posicionarMenu();
      }
    });
  }

  const instancia = {
    abrirMenu,
    cerrarMenu,
    posicionarMenu,
    estaAbierto: () => Boolean(menu && !menu.hasAttribute('hidden')),
    destruir() {
      limpiarTimerFoco();
      gestor.destruir();
      if (selectorActivoInstancia === instancia) {
        selectorActivoInstancia = null;
      }
      btnExpanded = null;
      btnCollapsed = null;
      menu = null;
      roleContainer = null;
      selectEspacio = null;
      ultimoBotonDisparador = null;
    },
  };

  gestor.registrarLimpieza(() => {
    limpiarTimerFoco();
    if (selectorActivoInstancia === instancia) {
      selectorActivoInstancia = null;
    }
    btnExpanded = null;
    btnCollapsed = null;
    menu = null;
    roleContainer = null;
    selectEspacio = null;
    ultimoBotonDisparador = null;
  });

  selectorActivoInstancia = instancia;
  return instancia;
}
