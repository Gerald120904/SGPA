export function validarIdentidadBackend(identity, expectedDatabase) {
  if (!identity || identity.app !== 'SGPA' || identity.database !== expectedDatabase ||
      identity.modoAislado !== (expectedDatabase === 'sgpa_isolated_audit')) {
    throw new Error('El backend no coincide con el entorno esperado.');
  }
  return identity;
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
