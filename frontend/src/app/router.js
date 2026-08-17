/* =========================================================
   RUTA ACTUAL
   ========================================================= */

export function obtenerRutaActual() {

  const route =
    window.location.hash
      .replace('#', '')
      .trim();


  if (!route) {
    return '/dashboard';
  }


  return route.startsWith('/')
    ? route
    : `/${route}`;

}


/* =========================================================
   NAVEGAR
   ========================================================= */

export function navegar(
  route
) {

  const normalizada =
    route.startsWith('/')
      ? route
      : `/${route}`;


  const nuevoHash =
    `#${normalizada}`;


  if (
    window.location.hash ===
    nuevoHash
  ) {

    window.dispatchEvent(
      new HashChangeEvent(
        'hashchange'
      )
    );

    return;

  }


  window.location.hash =
    normalizada;

}


/* =========================================================
   REEMPLAZAR RUTA SIN GENERAR EVENTO
   ========================================================= */

export function reemplazarRuta(
  route
) {

  const normalizada =
    route.startsWith('/')
      ? route
      : `/${route}`;


  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}#${normalizada}`
  );

}


/* =========================================================
   OBSERVAR
   ========================================================= */

export function observarRutas(
  callback
) {

  const handler = () => {

    callback(
      obtenerRutaActual()
    );

  };


  window.addEventListener(
    'hashchange',
    handler
  );


  handler();


  return () => {

    window.removeEventListener(
      'hashchange',
      handler
    );

  };

}


/* =========================================================
   LIMPIAR HASH
   ========================================================= */

export function limpiarRuta() {

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  );

}