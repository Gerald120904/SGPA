/**
 * Crea un gestor de suscripciones y eventos DOM con limpieza determinista.
 * Compatible tanto con DOM nativo (AbortController) como con mocks mínimos en Node.
 */
export function crearGestorEventos() {
  const controller =
    typeof AbortController === 'function'
      ? new AbortController()
      : {
          signal: { aborted: false },
          abort() {
            this.signal.aborted = true;
          },
        };

  let limpiezas = [];
  let destruido = false;

  function escuchar(target, tipo, handler, opciones = false) {
    if (
      destruido ||
      !target ||
      typeof target.addEventListener !== 'function' ||
      typeof handler !== 'function'
    ) {
      return () => {};
    }

    let nodo = target;
    let listener = handler;
    const capture =
      typeof opciones === 'object' && opciones !== null
        ? Boolean(opciones.capture)
        : Boolean(opciones);

    const wrapped = (event) => {
      if (destruido || controller.signal?.aborted) {
        return undefined;
      }
      return listener(event);
    };

    try {
      const addOptions =
        typeof opciones === 'object' && opciones !== null
          ? { ...opciones, signal: controller.signal }
          : capture
            ? { capture: true, signal: controller.signal }
            : { signal: controller.signal };
      nodo.addEventListener(tipo, wrapped, addOptions);
    } catch (_) {
      nodo.addEventListener(tipo, wrapped, capture);
    }

    let removido = false;
    const quitar = () => {
      if (removido) return;
      removido = true;
      if (nodo && typeof nodo.removeEventListener === 'function') {
        try {
          if (capture) {
            nodo.removeEventListener(tipo, wrapped, true);
          } else {
            nodo.removeEventListener(tipo, wrapped);
          }
        } catch (_) {}
      }
      nodo = null;
      listener = null;
    };

    limpiezas.push(quitar);
    return quitar;
  }

  function registrarLimpieza(fn) {
    if (destruido || typeof fn !== 'function') {
      return;
    }
    limpiezas.push(fn);
  }

  function destruir() {
    if (destruido) return;
    destruido = true;

    try {
      controller.abort?.();
    } catch (_) {}

    const pendientes = limpiezas;
    limpiezas = [];

    for (const limpiar of pendientes) {
      try {
        limpiar();
      } catch (_) {}
    }
  }

  return {
    signal: controller.signal,
    get destruido() {
      return destruido;
    },
    escuchar,
    registrarLimpieza,
    destruir,
  };
}
