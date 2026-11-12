/**
 * Stateless helper utilities for normalizing Electron IPC requests,
 * query-string filters, bulk payloads, and backend response messages.
 */

/**
 * Normalizes a backend response/error `message` field (string or string[])
 * and falls back to `mensajePorDefecto` when empty or absent.
 */
export function normalizarMensajeBackend(data, mensajePorDefecto = '') {
  const mensaje = Array.isArray(data?.message)
    ? data.message.join('. ')
    : data?.message;
  return mensaje || mensajePorDefecto;
}

/**
 * Builds a backend path with an encoded query string from a filter object.
 * When `opciones.claves` is provided, only those keys are inspected in order
 * using truthy filtering (and trimmed strings for keys in `opciones.clavesTrim`);
 * otherwise all defined non-empty entries (`!== undefined`, `!== null`, `!== ''`) are serialized.
 */
export function construirRutaConFiltros(rutaBase, filtros = {}, opciones = {}) {
  const origen = filtros;
  const params = new URLSearchParams();
  const { claves = null, clavesTrim = [], codificar = true } = opciones;
  const paresSinCodificar = [];
  const trimSet = new Set(clavesTrim);
  const agregar = (clave, valor) => {
    if (codificar) params.set(clave, String(valor));
    else paresSinCodificar.push(`${clave}=${String(valor)}`);
  };

  if (Array.isArray(claves)) {
    for (const clave of claves) {
      const valor = origen[clave];
      if (trimSet.has(clave)) {
        // Preserve the previous IPC handler semantics: nullish values are
        // ignored, while a non-null value without trim() still fails as before.
        const texto = valor?.trim();
        if (texto) {
          agregar(clave, texto);
        }
      } else if (valor) {
        agregar(clave, valor);
      }
    }
  } else {
    for (const [clave, valor] of Object.entries(origen)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        agregar(clave, valor);
      }
    }
  }

  const query = codificar ? params.toString() : paresSinCodificar.join('&');
  return query ? `${rutaBase}?${query}` : rutaBase;
}

/**
 * Normalizes an array input into `{ [propiedad]: entrada }` while keeping
 * payload objects that already define `[propiedad]` untouched.
 */
export function normalizarPayloadColeccion(entrada, propiedad) {
  if (Array.isArray(entrada)) {
    return { [propiedad]: entrada };
  }
  return entrada?.[propiedad] ? entrada : { [propiedad]: entrada };
}
