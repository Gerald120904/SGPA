export function validarUrlExternaFormulario(valor, baseUrl, esProduccion = false) {
  let url;
  let base;
  try {
    url = new URL(valor);
    base = new URL(baseUrl);
  } catch {
    throw new Error('La URL proporcionada no es válida.');
  }

  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Protocolo o credenciales no permitidos en la URL.');
  }
  if (esProduccion && url.protocol !== 'https:') {
    throw new Error('En producción se requiere HTTPS para abrir enlaces públicos.');
  }
  if (url.hostname.toLowerCase() === 'docs.google.com') {
    if (url.protocol !== 'https:' || url.port) {
      throw new Error('Los formularios de Google requieren HTTPS en el puerto autorizado.');
    }
    return url.toString();
  }

  if (url.origin !== base.origin || !/^\/formularios\/p\/[0-9a-fA-F]{64}$/.test(url.pathname)) {
    throw new Error('La URL no pertenece al origen y ruta autorizados para formularios SGPA.');
  }
  return url.toString();
}
