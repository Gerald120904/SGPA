import test from 'node:test';
import assert from 'node:assert/strict';
import { Sidebar, obtenerIconoRol, iniciarSidebar } from '../src/components/Sidebar.js';
import { guardarSesion, limpiarSesion, obtenerRolActivo } from '../src/app/session.js';

test('Sidebar: renders institutional label "Rol activo" and currently active role', () => {
  guardarSesion({
    usuario: {
      nombres: 'Carlos Administrador',
      correo: 'admin@una.cr',
      roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
      rolActivo: 'ADMIN_GLOBAL'
    }
  });

  const html = Sidebar({
    usuario: {
      nombres: 'Carlos Administrador',
      correo: 'admin@una.cr',
      roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
      rolActivo: 'ADMIN_GLOBAL'
    },
    roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
    permisos: []
  });

  // 1. Must use "Rol activo", not "Espacio Activo"
  assert.match(html, /Rol activo/);
  assert.doesNotMatch(html, /Espacio Activo/);

  // 2. Must show current active role name
  assert.match(html, /Administrador global/);

  // 3. Must have discrete trigger button
  assert.match(html, /id="btnRolActivoExpanded"/);
  assert.match(html, /id="btnRolActivoCollapsed"/);

  // 4. Must distinguish account name from active role
  assert.match(html, /Carlos Administrador/);
  assert.match(html, /admin@una\.cr/);

  // 5. Must have accessibility attributes
  assert.match(html, /role="listbox"/);
  assert.match(html, /role="option"/);
  assert.match(html, /aria-haspopup="listbox"/);

  limpiarSesion();
});

test('Sidebar: renders Coordinador role icon and label correctly', () => {
  guardarSesion({
    usuario: {
      nombres: 'María Coordinadora',
      correo: 'coordinacion@una.cr',
      roles: ['COORDINADOR', 'PROFESOR'],
      rolActivo: 'COORDINADOR'
    }
  });

  const html = Sidebar({
    usuario: {
      nombres: 'María Coordinadora',
      correo: 'coordinacion@una.cr',
      roles: ['COORDINADOR', 'PROFESOR'],
      rolActivo: 'COORDINADOR'
    },
    roles: ['COORDINADOR', 'PROFESOR'],
    permisos: []
  });

  assert.match(html, /Coordinador/);
  assert.match(html, /data-lucide="briefcase"/);
  assert.equal(obtenerIconoRol('COORDINADOR'), 'briefcase');
  assert.equal(obtenerIconoRol('ADMIN_GLOBAL'), 'shield-check');
  assert.equal(obtenerIconoRol('PROFESOR'), 'graduation-cap');

  limpiarSesion();
});

test('Sidebar: collapsed mode has compact button without clipped text', () => {
  const html = Sidebar({
    usuario: {
      nombres: 'Gerald',
      roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
      rolActivo: 'ADMIN_GLOBAL'
    },
    roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
    permisos: [],
    isCollapsed: true
  });

  // Sidebar container has collapsed class
  assert.match(html, /class="sidebar\s+collapsed"/);

  // Compact button exists with role icon and accessible aria-label
  assert.match(html, /id="btnRolActivoCollapsed"/);
  assert.match(html, /class="role-selector-compact-btn/);
  assert.match(html, /aria-label="Rol activo: Administrador global\. Cambiar rol"/);

  // Toggle button reflects collapsed state
  assert.match(html, /title="Expandir barra lateral"/);
});

test('Sidebar: only displays roles actually assigned to the user', () => {
  const html = Sidebar({
    usuario: {
      nombres: 'Profesor Juan',
      correo: 'juan.profesor@una.cr',
      roles: ['PROFESOR'],
      rolActivo: 'PROFESOR'
    },
    roles: ['PROFESOR'],
    permisos: []
  });

  // Shows Profesor
  assert.match(html, /Profesor/);

  // Does NOT show unassigned roles
  assert.doesNotMatch(html, /data-rol="ADMIN_GLOBAL"/);
  assert.doesNotMatch(html, /data-rol="COORDINADOR"/);
  assert.doesNotMatch(html, /data-rol="ASISTENTE_ESTUDIANTIL"/);

  // For a single role, trigger has is-single and no dropdown menu
  assert.match(html, /class="role-selector-trigger\s+is-single"/);
  assert.doesNotMatch(html, /id="menuRolesFlotante"/);
});

test('Sidebar: floating menu correctly identifies active role with checkmark', () => {
  const html = Sidebar({
    usuario: {
      nombres: 'Usuario Multirrol',
      roles: ['ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR'],
      rolActivo: 'COORDINADOR'
    },
    roles: ['ADMIN_GLOBAL', 'COORDINADOR', 'PROFESOR'],
    permisos: []
  });

  assert.match(html, /id="menuRolesFlotante"/);

  // Active option has active class, aria-selected=true and checkmark
  assert.match(html, /data-rol="COORDINADOR"[\s\S]*?aria-selected="true"[\s\S]*?class="role-item-check"/);

  // Non-active options have aria-selected=false
  assert.match(html, /data-rol="ADMIN_GLOBAL"[\s\S]*?aria-selected="false"/);
  assert.match(html, /data-rol="PROFESOR"[\s\S]*?aria-selected="false"/);
});

test('iniciarSidebar: sidebar toggle collapses and expands sidebar and updates localStorage', () => {
  const appShell = createMockElement('appShell', 'main');
  const sidebar = createMockElement('sidebar', 'aside');
  const toggleBtn = createMockElement('sidebarToggle', 'button');
  const storage = new Map();

  globalThis.localStorage = {
    setItem: (k, v) => storage.set(k, v),
    getItem: (k) => storage.get(k) || null
  };

  const elements = { appShell, sidebar, sidebarToggle: toggleBtn };
  setupMockEnvironment(elements);

  iniciarSidebar();

  // Initially not collapsed
  assert.equal(appShell.classList.contains('sidebar-collapsed'), false);

  // Click toggle button -> collapses
  toggleBtn.dispatch('click');
  assert.equal(appShell.classList.contains('sidebar-collapsed'), true);
  assert.equal(sidebar.classList.contains('collapsed'), true);
  assert.equal(storage.get('sgpa_sidebar_collapsed'), 'true');
  assert.equal(toggleBtn.getAttribute('aria-label'), 'Expandir barra lateral');

  // Click toggle button again -> expands
  toggleBtn.dispatch('click');
  assert.equal(appShell.classList.contains('sidebar-collapsed'), false);
  assert.equal(sidebar.classList.contains('collapsed'), false);
  assert.equal(storage.get('sgpa_sidebar_collapsed'), 'false');
  assert.equal(toggleBtn.getAttribute('aria-label'), 'Contraer barra lateral');
});

test('iniciarSidebar: opens and closes role floating menu on trigger click and Escape', () => {
  const appShell = createMockElement('appShell', 'main');
  const sidebar = createMockElement('sidebar', 'aside');
  const btnExpanded = createMockElement('btnRolActivoExpanded', 'button');
  const menu = createMockElement('menuRolesFlotante', 'div');
  menu.setAttribute('hidden', '');

  const elements = {
    appShell,
    sidebar,
    btnRolActivoExpanded: btnExpanded,
    menuRolesFlotante: menu,
    sidebarRoleContainer: createMockElement('sidebarRoleContainer')
  };
  setupMockEnvironment(elements);

  iniciarSidebar();

  // Initially hidden
  assert.equal(menu.hasAttribute('hidden'), true);
  assert.equal(btnExpanded.getAttribute('aria-expanded'), null);

  // Click trigger -> opens menu
  btnExpanded.dispatch('click');
  assert.equal(menu.hasAttribute('hidden'), false);
  assert.equal(btnExpanded.getAttribute('aria-expanded'), 'true');

  // Press Escape on menu -> closes menu and restores trigger
  menu.dispatch('keydown', { key: 'Escape' });
  assert.equal(menu.hasAttribute('hidden'), true);
  assert.equal(btnExpanded.getAttribute('aria-expanded'), 'false');
});

test('iniciarSidebar: successful role switch calls backend and onCambiarRol callback', async () => {
  guardarSesion({
    usuario: {
      id: 1,
      roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
      rolActivo: 'ADMIN_GLOBAL'
    }
  });

  const appShell = createMockElement('appShell', 'main');
  const sidebar = createMockElement('sidebar', 'aside');
  const btnExpanded = createMockElement('btnRolActivoExpanded', 'button');
  const menu = createMockElement('menuRolesFlotante', 'div');
  const container = createMockElement('sidebarRoleContainer');
  container.dataset.rolActivo = 'ADMIN_GLOBAL';

  const optionCoord = createMockElement('optCoord', 'button');
  optionCoord.dataset.rol = 'COORDINADOR';

  menu.querySelectorAll = () => [optionCoord];
  menu.querySelector = () => optionCoord;

  let roleSentToBackend = null;
  globalThis.window = {
    innerWidth: 1200,
    sgpa: {
      cambiarRolActivo: async (rol) => {
        roleSentToBackend = rol;
        return {
          ok: true,
          accessToken: 'new-token',
          usuario: {
            id: 1,
            roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
            rolActivo: rol
          }
        };
      }
    }
  };

  let rolCambiadoNotificado = null;
  const elements = {
    appShell,
    sidebar,
    btnRolActivoExpanded: btnExpanded,
    menuRolesFlotante: menu,
    sidebarRoleContainer: container
  };
  setupMockEnvironment(elements);

  iniciarSidebar({
    onCambiarRol: async (nuevoRol) => {
      rolCambiadoNotificado = nuevoRol;
    }
  });

  // Click on the Coordinador option
  await optionCoord.dispatch('click');

  assert.equal(roleSentToBackend, 'COORDINADOR');
  assert.equal(rolCambiadoNotificado, 'COORDINADOR');
  assert.equal(obtenerRolActivo(), 'COORDINADOR');

  limpiarSesion();
});

test('iniciarSidebar: failed role switch preserves previous role and alerts error', async () => {
  guardarSesion({
    usuario: {
      id: 1,
      roles: ['ADMIN_GLOBAL', 'COORDINADOR'],
      rolActivo: 'ADMIN_GLOBAL'
    }
  });

  const appShell = createMockElement('appShell', 'main');
  const sidebar = createMockElement('sidebar', 'aside');
  const btnExpanded = createMockElement('btnRolActivoExpanded', 'button');
  const menu = createMockElement('menuRolesFlotante', 'div');
  const container = createMockElement('sidebarRoleContainer');
  container.dataset.rolActivo = 'ADMIN_GLOBAL';

  const optionCoord = createMockElement('optCoord', 'button');
  optionCoord.dataset.rol = 'COORDINADOR';

  menu.querySelectorAll = () => [optionCoord];
  menu.querySelector = () => optionCoord;

  let alertMessage = null;
  globalThis.alert = (msg) => { alertMessage = msg; };

  globalThis.window = {
    innerWidth: 1200,
    sgpa: {
      cambiarRolActivo: async () => {
        return {
          ok: false,
          message: 'Error de prueba: permisos insuficientes en el servidor'
        };
      }
    }
  };

  let rolCambiadoNotificado = null;
  const elements = {
    appShell,
    sidebar,
    btnRolActivoExpanded: btnExpanded,
    menuRolesFlotante: menu,
    sidebarRoleContainer: container
  };
  setupMockEnvironment(elements);

  iniciarSidebar({
    onCambiarRol: async (nuevoRol) => {
      rolCambiadoNotificado = nuevoRol;
    }
  });

  await optionCoord.dispatch('click');

  // Should have preserved previous active role
  assert.equal(obtenerRolActivo(), 'ADMIN_GLOBAL');
  assert.equal(rolCambiadoNotificado, null);
  assert.match(alertMessage, /Error de prueba/);

  limpiarSesion();
});

// Helper for Mock DOM setup
function createMockElement(id, tag = 'div', classes = []) {
  const classList = new Set(classes);
  const attributes = new Map();
  const listeners = new Map();

  const el = {
    id,
    tagName: tag.toUpperCase(),
    dataset: {},
    disabled: false,
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c),
      toggle: (c, force) => {
        const has = classList.has(c);
        const shouldHave = force !== undefined ? force : !has;
        if (shouldHave) classList.add(c); else classList.delete(c);
        return shouldHave;
      }
    },
    setAttribute: (name, val) => attributes.set(name, String(val)),
    getAttribute: (name) => attributes.get(name) || null,
    removeAttribute: (name) => attributes.delete(name),
    hasAttribute: (name) => attributes.has(name),
    addEventListener: (evt, handler) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(handler);
    },
    dispatch: async (evt, data = {}) => {
      const handlers = listeners.get(evt) || [];
      for (const h of handlers) {
        await h({ target: el, preventDefault: () => {}, stopPropagation: () => {}, ...data });
      }
    },
    getBoundingClientRect: () => ({ top: 100, right: 70, bottom: 140, left: 20, width: 50, height: 40 }),
    focus: () => { globalThis.document.activeElement = el; },
    style: {},
    contains: (target) => target === el,
    querySelector: () => null,
    querySelectorAll: () => []
  };
  return el;
}

function setupMockEnvironment(elements = {}) {
  const docListeners = new Map();
  const winListeners = new Map();

  globalThis.document = {
    activeElement: null,
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: (evt, handler) => {
      if (!docListeners.has(evt)) docListeners.set(evt, []);
      docListeners.get(evt).push(handler);
    }
  };

  if (!globalThis.window) {
    globalThis.window = {
      innerWidth: 1200,
      addEventListener: (evt, handler) => {
        if (!winListeners.has(evt)) winListeners.set(evt, []);
        winListeners.get(evt).push(handler);
      }
    };
  } else {
    globalThis.window.addEventListener = (evt, handler) => {
      if (!winListeners.has(evt)) winListeners.set(evt, []);
      winListeners.get(evt).push(handler);
    };
  }
}
