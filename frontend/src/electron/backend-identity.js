export function validarIdentidadBackend(identity, expectedDatabase) {
  if (!identity || identity.app !== 'SGPA' || identity.database !== expectedDatabase ||
      identity.modoAislado !== (expectedDatabase === 'sgpa_isolated_audit')) {
    throw new Error('El backend no coincide con el entorno esperado.');
  }
  return identity;
}

export function normalizarUrlBackend(value) {
  if (typeof value !== 'string') throw new Error('Indique la dirección del servidor SGPA.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('La dirección del servidor no es válida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      (url.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) {
    throw new Error('Use HTTPS o una dirección HTTP local, sin ruta ni credenciales.');
  }
  return url.origin;
}

export async function verificarIdentidadBackend(fetcher, apiUrl, expectedDatabase) {
  const response = await fetcher(`${apiUrl}/auth/identidad`, { method: 'GET' });
  if (!response.ok) throw new Error(`La identidad del backend respondió HTTP ${response.status}.`);
  return validarIdentidadBackend(await response.json(), expectedDatabase);
}

export async function fetchBackendSeguro(fetcher, apiUrl, expectedDatabase, route, options) {
  await verificarIdentidadBackend(fetcher, apiUrl, expectedDatabase);
  return fetcher(`${apiUrl}${route}`, options);
}

export async function resolverUrlBackend(fetcher, {
  urlActual,
  expectedDatabase = 'sgpa',
  env = process.env,
  leerConfigProyecto,
} = {}) {
  const candidatos = [];
  const errores = [];

  const urlExplicita = env?.SGPA_API_URL || env?.SGPA_BACKEND_URL;
  if (urlExplicita) {
    try {
      const norm = normalizarUrlBackend(urlExplicita);
      if (!candidatos.includes(norm)) candidatos.push(norm);
    } catch (error) {
      errores.push(`URL configurada: ${error.message}`);
    }
  }

  if (urlActual) {
    try {
      const norm = normalizarUrlBackend(urlActual);
      if (!candidatos.includes(norm)) candidatos.push(norm);
    } catch (error) {
      errores.push(`URL actual: ${error.message}`);
    }
  }

  if (env?.PORT && !Number.isNaN(Number(env.PORT))) {
    const norm = `http://127.0.0.1:${Number(env.PORT)}`;
    if (!candidatos.includes(norm)) candidatos.push(norm);
  }

  if (typeof leerConfigProyecto === 'function') {
    try {
      const config = leerConfigProyecto();
      if (config?.url) {
        const norm = normalizarUrlBackend(config.url);
        if (!candidatos.includes(norm)) candidatos.push(norm);
      }
      if (config?.port && !Number.isNaN(Number(config.port))) {
        const norm = `http://127.0.0.1:${Number(config.port)}`;
        if (!candidatos.includes(norm)) candidatos.push(norm);
      }
    } catch (error) {
      errores.push(`Configuración del proyecto: ${error.message}`);
    }
  }

  for (const defaultUrl of ['http://127.0.0.1:3000', 'http://127.0.0.1:3301']) {
    if (!candidatos.includes(defaultUrl)) {
      candidatos.push(defaultUrl);
    }
  }

  for (const candidato of candidatos) {
    try {
      await verificarIdentidadBackend(fetcher, candidato, expectedDatabase);
      return candidato;
    } catch (error) {
      errores.push(`${candidato}: ${error.message}`);
    }
  }

  throw new Error(`No se encontró un backend SGPA válido para ${expectedDatabase}. ${errores.join(' | ')}`);
}
