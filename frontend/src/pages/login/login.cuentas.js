export const CLAVE_CUENTAS_RECORDADAS = 'sgpa-cuentas-recordadas';
export const CLAVE_CORREO_ANTERIOR = 'sgpa-correo-recordado';
export const MAXIMO_CUENTAS_RECORDADAS = 8;

/** Lee y normaliza las cuentas locales guardadas, incluyendo la clave histórica. */
export function obtenerCuentasRecordadas(storage = localStorage) {
  let cuentas = [];
  try {
    const guardadas = JSON.parse(storage.getItem(CLAVE_CUENTAS_RECORDADAS) || '[]');
    if (Array.isArray(guardadas)) cuentas = guardadas;
  } catch {
    cuentas = [];
  }

  const correoAnterior = storage.getItem(CLAVE_CORREO_ANTERIOR);
  if (correoAnterior) {
    cuentas.unshift(correoAnterior);
    storage.removeItem(CLAVE_CORREO_ANTERIOR);
  }

  return [...new Set(
    cuentas
      .filter((cuenta) => typeof cuenta === 'string')
      .map((cuenta) => cuenta.trim())
      .filter(Boolean),
  )].slice(0, MAXIMO_CUENTAS_RECORDADAS);
}

export function guardarCuentasRecordadas(cuentas, storage = localStorage) {
  storage.setItem(CLAVE_CUENTAS_RECORDADAS, JSON.stringify(cuentas));
}

/** Vincula el selector accesible de cuentas guardadas a esta vista de Login. */
export function inicializarSelectorCuentas({
  correoInput,
  passwordInput,
  toggle,
  menu,
  loginView,
  renderizarIconos,
  storage = localStorage,
}) {
  let cuentas = obtenerCuentasRecordadas(storage);
  let habilitado = true;
  const ocultar = () => {
    menu.classList.add('hidden');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    correoInput.setAttribute('aria-expanded', 'false');
  };
  const mostrar = () => {
    if (!habilitado || cuentas.length === 0) return;
    menu.classList.remove('hidden');
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    correoInput.setAttribute('aria-expanded', 'true');
  };
  const renderizar = () => {
    menu.replaceChildren();
    toggle.classList.toggle('hidden', cuentas.length === 0);
    for (const correo of cuentas) {
      const opcion = document.createElement('button');
      opcion.type = 'button';
      opcion.className = 'saved-account-option';
      opcion.setAttribute('role', 'option');
      opcion.setAttribute('aria-label', `Usar la cuenta ${correo}`);

      const icono = document.createElement('span');
      icono.className = 'saved-account-icon';
      icono.innerHTML = '<i data-lucide="user" aria-hidden="true"></i>';
      const textos = document.createElement('span');
      textos.className = 'saved-account-copy';
      const correoTexto = document.createElement('strong');
      correoTexto.textContent = correo;
      const detalle = document.createElement('small');
      detalle.textContent = 'Cuenta guardada';
      textos.append(correoTexto, detalle);
      const indicador = document.createElement('span');
      indicador.className = 'saved-account-indicator';
      indicador.innerHTML = '<i data-lucide="chevron-right" aria-hidden="true"></i>';
      opcion.append(icono, textos, indicador);
      opcion.addEventListener('click', () => {
        if (!habilitado) return;
        correoInput.value = correo;
        ocultar();
        passwordInput.focus();
      });
      opcion.disabled = !habilitado;
      menu.appendChild(opcion);
    }
    renderizarIconos();
  };

  renderizar();
  toggle.addEventListener('click', () => {
    if (!habilitado) return;
    if (menu.classList.contains('hidden')) mostrar();
    else ocultar();
  });
  correoInput.addEventListener('keydown', (event) => {
    if (!habilitado) return;
    if (event.key === 'ArrowDown' && cuentas.length > 0) {
      event.preventDefault();
      mostrar();
      menu.querySelector('.saved-account-option')?.focus();
    }
    if (event.key === 'Escape') ocultar();
  });
  menu.addEventListener('keydown', (event) => {
    if (!habilitado) return;
    const opciones = [...menu.querySelectorAll('.saved-account-option')];
    const indiceActual = opciones.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const desplazamiento = event.key === 'ArrowDown' ? 1 : -1;
      const siguienteIndice = (indiceActual + desplazamiento + opciones.length) % opciones.length;
      opciones[siguienteIndice]?.focus();
    }
    if (event.key === 'Escape') {
      ocultar();
      correoInput.focus();
    }
  });
  loginView.addEventListener('click', (event) => {
    if (!correoInput.closest('.account-input-container').contains(event.target)) ocultar();
  });

  function establecerHabilitado(valor) {
    habilitado = Boolean(valor);
    toggle.disabled = !habilitado;
    menu.inert = !habilitado;
    for (const opcion of menu.querySelectorAll('.saved-account-option')) {
      opcion.disabled = !habilitado;
    }
    if (!habilitado) ocultar();
  }

  return {
    ocultar,
    establecerHabilitado,
    agregar(correo) {
      cuentas = [correo, ...cuentas.filter((guardada) => guardada !== correo)]
        .slice(0, MAXIMO_CUENTAS_RECORDADAS);
      guardarCuentasRecordadas(cuentas, storage);
      renderizar();
    },
  };
}
