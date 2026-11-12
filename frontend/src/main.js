import { app, BrowserWindow, ipcMain, net, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import started from "electron-squirrel-startup";

import { registrarPlanImportacionIpc } from "./electron/ipc/plan-importacion.ipc.js";
import { registrarEstudiantesImportacionIpc } from "./electron/ipc/estudiantes-importacion.ipc.js";
import { validarUrlExternaFormulario } from './utils/validar-url-formulario.js';
import { fetchBackendSeguro, normalizarUrlBackend, resolverUrlBackend, verificarIdentidadBackend } from './electron/backend-identity.js';
import { crearEstadoSesionAutenticada, invalidarSesionPor401, registrarCambiosContextoAutenticado } from './electron/ipc/auth-session-state.js';
import {
  construirRutaConFiltros,
  normalizarMensajeBackend,
  normalizarPayloadColeccion,
} from './electron/ipc-helpers.js';

function leerConfigProyecto() {
  const posiblesRutas = [
    path.resolve(process.cwd(), '../backend/.env'),
    path.resolve(process.cwd(), 'backend/.env'),
    path.resolve(app.getAppPath(), '../backend/.env'),
    path.resolve(app.getAppPath(), '../../backend/.env'),
  ];
  for (const ruta of posiblesRutas) {
    try {
      if (fs.existsSync(ruta)) {
        const contenido = fs.readFileSync(ruta, 'utf8');
        const matchUrl = contenido.match(/^SGPA_API_URL\s*=\s*(.+)/m);
        if (matchUrl && matchUrl[1].trim()) {
          return { url: matchUrl[1].trim() };
        }
        const matchPort = contenido.match(/^PORT\s*=\s*(\d+)/m);
        if (matchPort) {
          return { port: Number(matchPort[1]) };
        }
      }
    } catch {}
  }
  return null;
}

let apiUrl = normalizarUrlBackend(process.env.SGPA_API_URL || "http://127.0.0.1:3000");
const EXPECTED_DATABASE = process.env.SGPA_EXPECTED_DATABASE || 'sgpa';

async function asegurarBackendConectado() {
  try {
    await verificarIdentidadBackend(
      (url, requestOptions) => net.fetch(url, requestOptions),
      apiUrl,
      EXPECTED_DATABASE,
    );
    return apiUrl;
  } catch {
    const resuelta = await resolverUrlBackend(
      (url, requestOptions) => net.fetch(url, requestOptions),
      {
        urlActual: apiUrl,
        expectedDatabase: EXPECTED_DATABASE,
        leerConfigProyecto,
      },
    );
    apiUrl = resuelta;
    return apiUrl;
  }
}

const consultarBackend = async (route, options) => {
  await asegurarBackendConectado();
  return fetchBackendSeguro(
    (url, requestOptions) => net.fetch(url, requestOptions),
    apiUrl,
    EXPECTED_DATABASE,
    route,
    options,
  );
};



const estadoSesion = crearEstadoSesionAutenticada();

const HOSTS_OAUTH_GOOGLE_PERMITIDOS = new Set(["accounts.google.com"]);

function validarUrlExternaGoogle(valor, hostsPermitidos) {
  let url;

  try {
    url = new URL(valor);
  } catch {
    throw new Error("La URL externa proporcionada no es válida.");
  }

  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !hostsPermitidos.has(url.hostname.toLowerCase())
  ) {
    throw new Error("La URL externa no pertenece a un dominio permitido de Google.");
  }

  return url.toString();
}

function resolverUrlPublicaFormulario(responderUri) {
  if (!responderUri || typeof responderUri !== 'string') {
    throw new Error('URI de respuesta inválida.');
  }

  const uri = responderUri.trim();
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  const baseUrl = process.env.SGPA_PUBLIC_URL || apiUrl;
  const pathNormalizado = uri.startsWith('/') ? uri : `/${uri}`;
  return `${baseUrl.replace(/\/+$/, '')}${pathNormalizado}`;
}

async function ejecutarPeticionAutenticada(ruta, opciones = {}) {
  const contextoSesion = opciones.contextoSesion || estadoSesion.capturarSesion();
  if (!contextoSesion || !estadoSesion.sigueVigente(contextoSesion)) {
    return {
      ok: false,
      status: 401,
      message: "No existe una sesión activa.",
    };
  }

  const tokenUsado = contextoSesion.token;
  const { method = "GET", body } = opciones;
  const headers = {
    Authorization: `Bearer ${tokenUsado}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await consultarBackend(ruta, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        if (invalidarSesionPor401(estadoSesion, contextoSesion, response.status)) {
          BrowserWindow.getAllWindows().forEach((ventana) =>
            ventana.webContents.send('auth:invalidada'));
        }
      }

      return {
        ok: false,
        status: response.status,
        message: normalizarMensajeBackend(data, "No fue posible realizar la operación."),
      };
    }

    return {
      ok: true,
      data,
    };
  } catch (error) {
    console.error(`Error solicitando ${method} ${ruta}.`);

    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el sistema. Verifique que el servidor esté disponible.",
    };
  }
}

registrarPlanImportacionIpc({
  ejecutarPeticionAutenticada,
});
registrarEstudiantesImportacionIpc({
  ejecutarPeticionAutenticada,
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}


ipcMain.handle("auth:login", async (_event, credenciales) => {
  const contextoLogin = estadoSesion.iniciarLogin();
  try {
    const response = await consultarBackend('/auth/login', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correo: credenciales.correo,
        password: credenciales.password,
      }),
    });

    const data = await response.json();

    if (!estadoSesion.loginSigueVigente(contextoLogin)) {
      return { ok: false, status: 409, message: 'La sesión cambió durante el inicio de sesión. Vuelva a intentarlo.' };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: data.message || "No fue posible iniciar sesión",
      };
    }

    if (!estadoSesion.confirmarLogin(contextoLogin, data.accessToken)) {
      return { ok: false, status: 409, message: 'La sesión cambió durante el inicio de sesión. Vuelva a intentarlo.' };
    }

    return {
      ok: true,
      usuario: data.usuario,
    };
  } catch (error) {
    if (!estadoSesion.loginSigueVigente(contextoLogin)) {
      return { ok: false, status: 409, message: 'La sesión cambió durante el inicio de sesión. Vuelva a intentarlo.' };
    }
    console.error("Error al conectar con el backend durante el inicio de sesión.");
    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el sistema. Verifique que el servidor esté disponible.",
    };
  }
});

registrarCambiosContextoAutenticado(ipcMain, estadoSesion, ejecutarPeticionAutenticada);

ipcMain.handle("app:verificar-identidad", async () => {
  try {
    await asegurarBackendConectado();
    const data = await verificarIdentidadBackend(
      (url, requestOptions) => net.fetch(url, requestOptions), apiUrl, EXPECTED_DATABASE);
    return {
      ok: true,
      identidad: data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el sistema. Verifique que el servidor esté disponible.",
    };
  }
});

ipcMain.handle('app:backend-config', () => ({ url: apiUrl }));
ipcMain.handle('app:configurar-backend', async (_event, value) => {
  if (estadoSesion.obtenerToken()) return { ok: false, message: 'Cierre la sesión antes de cambiar el servidor.' };
  try {
    const candidate = normalizarUrlBackend(value);
    const identidad = await verificarIdentidadBackend(
      (url, requestOptions) => net.fetch(url, requestOptions), candidate, EXPECTED_DATABASE);
    apiUrl = candidate;
    return { ok: true, url: candidate, identidad };
  } catch (error) {
    return { ok: false, message: `Conexión rechazada: ${error.message}` };
  }
});

ipcMain.handle("auth:recuperar-password", async (_event, datos) => {
  try {
    const response = await consultarBackend('/auth/recuperar-password', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correo: datos.correo,
      }),
    });

    const data = await response.json();
    const message = normalizarMensajeBackend(data);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: message || "No fue posible solicitar la recuperación.",
      };
    }

    return {
      ok: true,
      message:
        message ||
        "Si el correo está registrado, recibirás un código de recuperación.",
    };
  } catch (error) {
    console.error("Error al solicitar recuperación de contraseña:", error);
    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el sistema. Verifique que el servidor esté disponible.",
    };
  }
});

ipcMain.handle("auth:restablecer-password", async (_event, datos) => {
  try {
    const response = await consultarBackend('/auth/restablecer-password', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correo: datos.correo,
        codigo: datos.codigo,
        password: datos.password,
      }),
    });

    const data = await response.json();
    const message = normalizarMensajeBackend(data);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: message || "No fue posible restablecer la contraseña.",
      };
    }

    return {
      ok: true,
      message: message || "La contraseña se actualizó correctamente.",
    };
  } catch (error) {
    console.error("Error al restablecer contraseña:", error);
    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el sistema. Verifique que el servidor esté disponible.",
    };
  }
});

ipcMain.handle("auth:perfil", async () => {
  const contextoSesion = estadoSesion.capturarSesion();
  if (!contextoSesion) {
    return {
      ok: false,
      message: "No existe una sesión activa.",
    };
  }

  try {
    const tokenUsado = contextoSesion.token;
    const response = await consultarBackend('/auth/perfil', {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenUsado}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (invalidarSesionPor401(estadoSesion, contextoSesion, response.status)) {
        BrowserWindow.getAllWindows().forEach((ventana) =>
          ventana.webContents.send('auth:invalidada'));
      }
      return {
        ok: false,
        status: response.status,
        message: data.message || "La sesión no es válida.",
      };
    }

    return {
      ok: true,
      usuario: data,
    };
  } catch (error) {
    console.error("Error al consultar el perfil de sesión.");
    return {
      ok: false,
      message: "No se pudo conectar con el servidor.",
    };
  }
});

ipcMain.handle("auth:logout", () => {
  estadoSesion.cerrarSesion();
  return {
    ok: true,
  };
});

ipcMain.handle("usuarios:listar", async () => {
  const resultado = await ejecutarPeticionAutenticada("/usuarios");

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    usuarios: resultado.data,
  };
});

ipcMain.handle("usuarios:obtener", async (_event, id) => {
  return ejecutarPeticionAutenticada(`/usuarios/${id}`);
});

ipcMain.handle("usuarios:crear", async (_event, datos) => {
  return ejecutarPeticionAutenticada("/usuarios", {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle("usuarios:actualizar", async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/usuarios/${id}`, {
    method: "PATCH",
    body: datos,
  });
});

ipcMain.handle("usuarios:cambiar-estado", async (_event, id, activo) => {
  return ejecutarPeticionAutenticada(`/usuarios/${id}/estado`, {
    method: "PATCH",
    body: { activo },
  });
});

ipcMain.handle("usuarios:asignar-rol", async (_event, id, rol) => {
  return ejecutarPeticionAutenticada(`/usuarios/${id}/roles`, {
    method: "POST",
    body: { rol },
  });
});

ipcMain.handle('usuarios:impacto-revocacion-rol', async (_event, usuarioId, rolId) =>
  ejecutarPeticionAutenticada(`/usuarios/${usuarioId}/roles/${rolId}/impacto`));
ipcMain.handle("usuarios:revocar-rol", async (_event, usuarioId, rolId, firmaImpacto) => {
  return ejecutarPeticionAutenticada(`/usuarios/${usuarioId}/roles/${rolId}`, {
    method: "DELETE",
    body: { firmaImpacto },
  });
});

ipcMain.handle('jerarquia:mis-carreras', async () =>
  ejecutarPeticionAutenticada('/jerarquia-usuarios/mis-carreras'));

ipcMain.handle('jerarquia:mis-alcances', async () =>
  ejecutarPeticionAutenticada('/jerarquia-usuarios/mis-alcances'));

ipcMain.handle('jerarquia:asistentes-configuracion', async () =>
  ejecutarPeticionAutenticada('/jerarquia-usuarios/asistentes-configuracion'));

ipcMain.handle('jerarquia:catalogo-estudiantes', async () =>
  ejecutarPeticionAutenticada('/jerarquia-usuarios/catalogo-estudiantes'));

ipcMain.handle('jerarquia:coordinador', async (_event, id) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/coordinadores/${id}`));

ipcMain.handle('jerarquia:admin-asistente', async (_event, id) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/admin/asistentes/${id}`));
ipcMain.handle('jerarquia:impacto-admin-asistente', async (_event, id, carreras) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/admin/asistentes/${id}/impacto`, {
    method: 'POST', body: { carreras },
  }));
ipcMain.handle('jerarquia:configurar-admin-asistente', async (_event, id, carreras, firmaImpacto) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/admin/asistentes/${id}`, {
    method: 'PUT', body: { carreras, firmaImpacto },
  }));

ipcMain.handle('jerarquia:impacto-coordinador', async (_event, id, carreras) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/coordinadores/${id}/impacto`, {
    method: 'POST', body: { carreras },
  }));
ipcMain.handle('jerarquia:configurar-coordinador', async (_event, id, carreras, firmaImpacto) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/coordinadores/${id}`, {
    method: 'PUT', body: { carreras, firmaImpacto },
  }));

ipcMain.handle('jerarquia:asistentes', async () =>
  ejecutarPeticionAutenticada('/jerarquia-usuarios/asistentes'));

ipcMain.handle('jerarquia:asistente', async (_event, id) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/asistentes/${id}`));

ipcMain.handle('jerarquia:crear-asistente', async (_event, datos) =>
  ejecutarPeticionAutenticada('/jerarquia-usuarios/asistentes', {
    method: 'POST', body: datos,
  }));

ipcMain.handle('jerarquia:configurar-asistente', async (_event, id, carreras) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/asistentes/${id}`, {
    method: 'PUT', body: { carreras },
  }));

ipcMain.handle('jerarquia:procesar-invitacion-asistente', async (_event, id) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/asistentes/${id}/invitacion/procesar`, {
    method: 'POST',
  }));

ipcMain.handle('jerarquia:auditoria', async (_event, id) =>
  ejecutarPeticionAutenticada(`/jerarquia-usuarios/auditoria/${id}`));

ipcMain.handle('jerarquia:catalogo-cursos', async () =>
  ejecutarPeticionAutenticada('/jerarquia-usuarios/catalogo-cursos'));
ipcMain.handle('jerarquia:catalogo-planes', async () =>
  ejecutarPeticionAutenticada('/jerarquia-usuarios/catalogo-planes'));

ipcMain.handle('solicitudes:proponer-estudiante', async (_event, datos) =>
  ejecutarPeticionAutenticada('/solicitudes-cambio/estudiantes', {
    method: 'POST', body: datos,
  }));

ipcMain.handle('solicitudes:proponer-actualizacion-estudiante', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/estudiantes/${id}/actualizar`, {
    method: 'POST', body: datos,
  }));

ipcMain.handle('solicitudes:proponer-estado-estudiante', async (_event, id, estado) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/estudiantes/${id}/estado`, {
    method: 'POST', body: { estado },
  }));

ipcMain.handle('solicitudes:proponer-cambio-plan-estudiante', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/estudiantes/${id}/plan`, {
    method: 'POST', body: datos,
  }));

ipcMain.handle('solicitudes:proponer-resultado-estudiante', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/estudiantes/${id}/historial-academico`, {
    method: 'POST', body: datos,
  }));

ipcMain.handle('solicitudes:proponer-importacion-estudiantes', async (_event, datos) =>
  ejecutarPeticionAutenticada('/solicitudes-cambio/estudiantes/importacion', {
    method: 'POST', body: datos,
  }));

ipcMain.handle('solicitudes:proponer-reingreso-estudiante', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/estudiantes/${id}/reingreso`, {
    method: 'POST', body: datos,
  }));

ipcMain.handle('solicitudes:proponer-correccion-resultado', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/estudiantes/${id}/correccion-resultado`, {
    method: 'POST', body: datos,
  }));


ipcMain.handle('solicitudes:proponer-revision-bandeja-estudiantes', async (_event, datos) =>
  ejecutarPeticionAutenticada('/solicitudes-cambio/estudiantes/revision-bandeja', {
    method: 'POST', body: datos,
  }));

ipcMain.handle('solicitudes:propias', async () =>
  ejecutarPeticionAutenticada('/solicitudes-cambio/mis-solicitudes'));

ipcMain.handle('solicitudes:pendientes', async () =>
  ejecutarPeticionAutenticada('/solicitudes-cambio/pendientes'));

ipcMain.handle('solicitudes:aprobar', async (_event, id) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/${id}/aprobar`, { method: 'POST' }));

ipcMain.handle('solicitudes:rechazar', async (_event, id, motivo) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/${id}/rechazar`, {
    method: 'POST', body: { motivo },
  }));

ipcMain.handle('solicitudes:devolver', async (_event, id, observaciones) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/${id}/devolver`, {
    method: 'POST', body: { observaciones },
  }));

ipcMain.handle('solicitudes:cancelar', async (_event, id, motivo) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/${id}/cancelar`, {
    method: 'POST', body: { motivo },
  }));

ipcMain.handle('solicitudes:editar', async (_event, id, datosPropuestos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/${id}/editar`, {
    method: 'PATCH', body: { datosPropuestos },
  }));

ipcMain.handle('solicitudes:reasignar', async (_event, id, nuevoCoordinadorId) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/${id}/reasignar`, {
    method: 'PATCH', body: { nuevoCoordinadorId },
  }));

ipcMain.handle('notificaciones:listar', async (_event, soloNoLeidas) =>
  ejecutarPeticionAutenticada(`/notificaciones${soloNoLeidas ? '?soloNoLeidas=true' : ''}`));

ipcMain.handle('notificaciones:contar-no-leidas', async () =>
  ejecutarPeticionAutenticada('/notificaciones/no-leidas/conteo'));

ipcMain.handle('notificaciones:marcar-leida', async (_event, id) =>
  ejecutarPeticionAutenticada(`/notificaciones/${id}/leida`, { method: 'PATCH' }));

ipcMain.handle('notificaciones:marcar-todas-leidas', async () =>
  ejecutarPeticionAutenticada('/notificaciones/marcar-todas-leidas', { method: 'PATCH' }));

ipcMain.handle('equivalencias:crear', async (_event, datos) =>
  ejecutarPeticionAutenticada('/planes-estudio/equivalencias', { method: 'POST', body: datos }));

ipcMain.handle('equivalencias:listar-planes', async (_event, planOrigenId, planDestinoId) =>
  ejecutarPeticionAutenticada(`/planes-estudio/equivalencias?planOrigenId=${planOrigenId}&planDestinoId=${planDestinoId}`));

ipcMain.handle('equivalencias:sugerir', async (_event, estudianteId, nuevoPlanId) =>
  ejecutarPeticionAutenticada(`/planes-estudio/equivalencias/sugerencias/${estudianteId}?planNuevoId=${nuevoPlanId}`));

ipcMain.handle('equivalencias:aplicar', async (_event, estudianteId, datos) => {
  if (!Number.isInteger(estudianteId) || estudianteId <= 0 ||
      !datos || typeof datos !== 'object' || !Array.isArray(datos.equivalenciaIds) ||
      datos.equivalenciaIds.length === 0 ||
      !datos.equivalenciaIds.every((id) => Number.isInteger(id) && id > 0)) {
    return { ok: false, status: 400, message: 'Estudiante y equivalencias válidas son obligatorios.' };
  }

  return ejecutarPeticionAutenticada('/planes-estudio/equivalencias/aplicar', {
    method: 'POST',
    body: { estudianteId, equivalenciaIds: datos.equivalenciaIds },
  });
});

ipcMain.handle('equivalencias:eliminar', async (_event, id) =>
  ejecutarPeticionAutenticada(`/planes-estudio/equivalencias/${id}`, { method: 'DELETE' }));

ipcMain.handle('perfiles-academicos:copiar-cursos', async (_event, perfilId, perfilOrigenId) =>
  ejecutarPeticionAutenticada(`/perfiles-academicos/${perfilId}/copiar-cursos/${perfilOrigenId}`, { method: 'POST' }));

ipcMain.handle("roles:listar", async () => {
  return ejecutarPeticionAutenticada("/roles");
});

/* =========================================================
   PERMISOS
   ========================================================= */

ipcMain.handle(
  "permisos:catalogo",
  async () => {
    const resultado =
      await ejecutarPeticionAutenticada(
        "/permisos/catalogo",
      );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      permisos: resultado.data,
    };
  },
);


ipcMain.handle(
  "permisos:usuario",
  async (_event, usuarioId) => {
    const resultado =
      await ejecutarPeticionAutenticada(
        `/permisos/usuarios/${usuarioId}`,
      );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      permisos: resultado.data,
    };
  },
);


ipcMain.handle(
  "permisos:reemplazar",
  async (
    _event,
    usuarioId,
    permisos,
  ) => {
    const resultado =
      await ejecutarPeticionAutenticada(
        `/permisos/usuarios/${usuarioId}`,
        {
          method: "PUT",
          body: {
            permisos,
          },
        },
      );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      permisos: resultado.data,
    };
  },
);


ipcMain.handle(
  'permisos:plantillas',
  async () => {

    const resultado =
      await ejecutarPeticionAutenticada(
        '/permisos/plantillas-roles',
      );


    if (!resultado.ok) {
      return resultado;
    }


    return {
      ok: true,
      plantillas:
        resultado.data,
    };

  },
);

/* =========================================================
   CARRERAS
   ========================================================= */

ipcMain.handle("carreras:listar", async () => {
  const resultado = await ejecutarPeticionAutenticada("/carreras");

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    carreras: resultado.data,
  };
});

ipcMain.handle("carreras:obtener", async (_event, id) => {
  return ejecutarPeticionAutenticada(`/carreras/${id}`);
});

ipcMain.handle("carreras:crear", async (_event, datos) => {
  return ejecutarPeticionAutenticada("/carreras", {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle("carreras:actualizar", async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/carreras/${id}`, {
    method: "PATCH",
    body: datos,
  });
});

ipcMain.handle("carreras:cambiar-estado", async (_event, id, activo) => {
  return ejecutarPeticionAutenticada(`/carreras/${id}/estado`, {
    method: "PATCH",
    body: { activo },
  });
});

/* =========================================================
   PERFILES ACADÉMICOS
   ========================================================= */

ipcMain.handle("perfiles-academicos:listar", async () => {
  return ejecutarPeticionAutenticada("/perfiles-academicos");
});

ipcMain.handle("perfiles-academicos:obtener", async (_event, id) => {
  return ejecutarPeticionAutenticada(`/perfiles-academicos/${id}`);
});

ipcMain.handle("perfiles-academicos:crear", async (_event, datos) => {
  return ejecutarPeticionAutenticada("/perfiles-academicos", {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle("perfiles-academicos:actualizar", async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/perfiles-academicos/${id}`, {
    method: "PATCH",
    body: datos,
  });
});

ipcMain.handle(
  "perfiles-academicos:cambiar-estado",
  async (_event, id, activo) => {
    return ejecutarPeticionAutenticada(`/perfiles-academicos/${id}/estado`, {
      method: "PATCH",
      body: { activo },
    });
  },
);

ipcMain.handle("perfiles-academicos:areas:listar", async (_event, id) => {
  return ejecutarPeticionAutenticada(`/perfiles-academicos/${id}/areas`);
});

ipcMain.handle(
  "perfiles-academicos:areas:guardar",
  async (_event, id, areas) => {
    return ejecutarPeticionAutenticada(`/perfiles-academicos/${id}/areas`, {
      method: "PUT",
      body: { areas },
    });
  },
);

ipcMain.handle("perfiles-academicos:requisitos:listar", async (_event, id) => {
  return ejecutarPeticionAutenticada(`/perfiles-academicos/${id}/requisitos`);
});

ipcMain.handle(
  "perfiles-academicos:requisitos:guardar",
  async (_event, id, requisitos) => {
    return ejecutarPeticionAutenticada(
      `/perfiles-academicos/${id}/requisitos`,
      { method: "PUT", body: { requisitos } },
    );
  },
);

ipcMain.handle(
  "perfiles-academicos:cursos:listar",
  async (_event, perfilId) => {
    return ejecutarPeticionAutenticada(
      `/perfiles-academicos/${perfilId}/cursos`,
    );
  },
);

ipcMain.handle(
  "perfiles-academicos:cursos:asociar",
  async (_event, perfilId, cursoId) => {
    return ejecutarPeticionAutenticada(
      `/perfiles-academicos/${perfilId}/cursos/${cursoId}`,
      { method: "POST" },
    );
  },
);

ipcMain.handle(
  "perfiles-academicos:cursos:desasociar",
  async (_event, perfilId, cursoId) => {
    return ejecutarPeticionAutenticada(
      `/perfiles-academicos/${perfilId}/cursos/${cursoId}`,
      { method: "DELETE" },
    );
  },
);

/* =========================================================
   CURSOS
   ========================================================= */

ipcMain.handle("cursos:listar", async () => {
  const resultado = await ejecutarPeticionAutenticada("/cursos");

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    cursos: resultado.data,
  };
});

ipcMain.handle('optativas:listar', async () => {
  const resultado = await ejecutarPeticionAutenticada('/optativas');
  return resultado.ok ? { ok: true, optativas: resultado.data } : resultado;
});
ipcMain.handle('optativas:carreras-elegibles', async () => {
  const resultado = await ejecutarPeticionAutenticada('/optativas/carreras-elegibles');
  return resultado.ok ? { ok: true, carreras: resultado.data } : resultado;
});
ipcMain.handle('optativas:crear', async (_event, datos) =>
  ejecutarPeticionAutenticada('/optativas', { method: 'POST', body: datos }));
ipcMain.handle('optativas:actualizar', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/optativas/${id}`, { method: 'PATCH', body: datos }));
ipcMain.handle('optativas:cambiar-estado', async (_event, id, activo) =>
  ejecutarPeticionAutenticada(`/optativas/${id}/estado`, { method: 'PATCH', body: { activo } }));

ipcMain.handle(
  "cursos:asignaturas-disponibles",
  async (_event, filtros = {}) => {
    const ruta = construirRutaConFiltros(
      "/cursos/asignaturas-disponibles",
      filtros,
      { claves: ["carreraId", "planId", "nivel", "ciclo"] },
    );

    const resultado = await ejecutarPeticionAutenticada(ruta);

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      asignaturas: resultado.data,
    };
  },
);

ipcMain.handle("cursos:obtener", async (_event, id) => {
  return ejecutarPeticionAutenticada(`/cursos/${id}`);
});

ipcMain.handle("cursos:crear", async (_event, datos) => {
  return ejecutarPeticionAutenticada("/cursos", {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle("cursos:actualizar", async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/cursos/${id}`, {
    method: "PATCH",
    body: datos,
  });
});

ipcMain.handle("cursos:cambiar-estado", async (_event, id, activo) => {
  return ejecutarPeticionAutenticada(`/cursos/${id}/estado`, {
    method: "PATCH",
    body: { activo },
  });
});

ipcMain.handle('solicitudes:proponer-curso', async (_event, datos) =>
  ejecutarPeticionAutenticada('/solicitudes-cambio/cursos', { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-actualizacion-curso', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/cursos/${id}/actualizar`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-estado-curso', async (_event, id, activo) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/cursos/${id}/estado`, { method: 'POST', body: { activo } }));
ipcMain.handle('solicitudes:proponer-requisito-curso', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/cursos/${id}/requisitos`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-eliminar-requisito-curso', async (_event, id, relacionId) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/cursos/${id}/requisitos/${relacionId}/eliminar`, { method: 'POST' }));
ipcMain.handle('solicitudes:proponer-plan', async (_event, datos) =>
  ejecutarPeticionAutenticada('/solicitudes-cambio/planes-estudio', { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-actualizacion-plan', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${id}/actualizar`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-estado-plan', async (_event, id, activo, motivo) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${id}/estado`, { method: 'POST', body: { activo, motivo } }));
ipcMain.handle('solicitudes:proponer-asignatura-plan', async (_event, planId, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/asignaturas`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-actualizacion-asignatura-plan', async (_event, planId, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/asignaturas/${id}/actualizar`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-estado-asignatura-plan', async (_event, planId, id, activo) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/asignaturas/${id}/estado`, { method: 'POST', body: { activo } }));
ipcMain.handle('solicitudes:proponer-carga-masiva-asignaturas-plan', async (_event, planId, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/asignaturas/carga-masiva`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-requisito-plan', async (_event, planId, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/requisitos`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-eliminar-requisito-plan', async (_event, planId, id) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/requisitos/${id}/eliminar`, { method: 'POST' }));
ipcMain.handle('solicitudes:proponer-carga-masiva-requisitos-plan', async (_event, planId, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/requisitos/carga-masiva`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-salida-plan', async (_event, planId, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/salidas-academicas`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-actualizacion-salida-plan', async (_event, planId, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/salidas-academicas/${id}/actualizar`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-estado-salida-plan', async (_event, planId, id, activo) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/salidas-academicas/${id}/estado`, { method: 'POST', body: { activo } }));
ipcMain.handle('solicitudes:proponer-asignar-asignaturas-salida-plan', async (_event, planId, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/salidas-academicas/${id}/asignaturas`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-guardar-regla-optativa-plan', async (_event, planId, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/regla-optativas`, { method: 'PUT', body: datos }));
ipcMain.handle('solicitudes:proponer-eliminar-regla-optativa-plan', async (_event, planId) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/regla-optativas/eliminar`, { method: 'POST' }));
ipcMain.handle('solicitudes:proponer-importar-plan', async (_event, planId, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/planes-estudio/${planId}/importacion`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-optativa', async (_event, datos) =>
  ejecutarPeticionAutenticada('/solicitudes-cambio/optativas', { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-actualizacion-optativa', async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/optativas/${id}/actualizar`, { method: 'POST', body: datos }));
ipcMain.handle('solicitudes:proponer-estado-optativa', async (_event, id, activo) =>
  ejecutarPeticionAutenticada(`/solicitudes-cambio/optativas/${id}/estado`, { method: 'POST', body: { activo } }));

ipcMain.handle("cursos:requisitos:listar", async (_event, cursoId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/cursos/${cursoId}/requisitos`,
  );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    requisitos: resultado.data,
  };
});

ipcMain.handle("cursos:requisitos:crear", async (_event, cursoId, datos) => {
  return ejecutarPeticionAutenticada(`/cursos/${cursoId}/requisitos`, {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle(
  "cursos:requisitos:eliminar",
  async (_event, cursoId, requisitoId) => {
    return ejecutarPeticionAutenticada(
      `/cursos/${cursoId}/requisitos/${requisitoId}`,
      {
        method: "DELETE",
      },
    );
  },
);

/* =========================================================
   PERIODOS ACADÉMICOS
   ========================================================= */

ipcMain.handle("periodos:listar", async () => {
  const resultado =
    await ejecutarPeticionAutenticada(
      "/periodos-academicos",
    );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    periodos: resultado.data,
  };
});

ipcMain.handle(
  "periodos:obtener",
  async (_event, id) => {
    return ejecutarPeticionAutenticada(
      `/periodos-academicos/${id}`,
    );
  },
);

ipcMain.handle(
  "periodos:crear",
  async (_event, datos) => {
    return ejecutarPeticionAutenticada(
      "/periodos-academicos",
      {
        method: "POST",
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  "periodos:actualizar",
  async (_event, id, datos) => {
    return ejecutarPeticionAutenticada(
      `/periodos-academicos/${id}`,
      {
        method: "PATCH",
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  "periodos:corregir-cerrado",
  async (_event, id, datos) => ejecutarPeticionAutenticada(
    `/periodos-academicos/${id}/correccion-excepcional`,
    { method: "PATCH", body: datos },
  ),
);

ipcMain.handle(
  "periodos:cambiar-estado",
  async (_event, id, estado) => {
    return ejecutarPeticionAutenticada(
      `/periodos-academicos/${id}/estado`,
      {
        method: "PATCH",
        body: {
          estado,
        },
      },
    );
  },
);

/* =========================================================
   PLANES DE ESTUDIO
   ========================================================= */

ipcMain.handle("planes-estudio:listar", async () => {
  const resultado = await ejecutarPeticionAutenticada("/planes-estudio");

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    planes: resultado.data,
  };
});

ipcMain.handle("planes-estudio:obtener", async (_event, id) => {
  return ejecutarPeticionAutenticada(`/planes-estudio/${id}`);
});

ipcMain.handle("planes-estudio:crear", async (_event, datos) => {
  return ejecutarPeticionAutenticada("/planes-estudio", {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle("planes-estudio:actualizar", async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/planes-estudio/${id}`, {
    method: "PATCH",
    body: datos,
  });
});

ipcMain.handle("planes-estudio:cambiar-estado", async (_event, id, activo, motivo) => {
  const body = typeof activo === "object" && activo !== null ? activo : { activo, motivo };
  return ejecutarPeticionAutenticada(`/planes-estudio/${id}/estado`, {
    method: "PATCH",
    body,
  });
});

ipcMain.handle("planes-estudio:crear-version", async (_event, id, datos) =>
  ejecutarPeticionAutenticada(`/planes-estudio/${id}/versiones`, { method: "POST", body: datos }));

ipcMain.handle("planes-estudio:activar-version", async (_event, id, versionId, motivo) =>
  ejecutarPeticionAutenticada(`/planes-estudio/${id}/versiones/${versionId}/activar`, {
    method: "POST", body: { motivo },
  }));

/* =========================================================
   REGLA DE OPTATIVAS DEL PLAN
   ========================================================= */

ipcMain.handle("plan-reglas-optativas:obtener", async (_event, planId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/regla-optativas`,
  );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    regla: resultado.data?.regla ?? null,
    cantidadEspaciosOptativos:
      Number(resultado.data?.cantidadEspaciosOptativos || 0),
  };
});

ipcMain.handle(
  "plan-reglas-optativas:guardar",
  async (_event, planId, datos) => {
    const resultado = await ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/regla-optativas`,
      {
        method: "PUT",
        body: datos,
      },
    );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      regla: resultado.data,
    };
  },
);

ipcMain.handle("plan-reglas-optativas:eliminar", async (_event, planId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/regla-optativas`,
    {
      method: "DELETE",
    },
  );

  if (!resultado.ok) {
    return resultado;
  }

  return { ok: true };
});

/* =========================================================
   ASIGNATURAS DE PLAN
   ========================================================= */

ipcMain.handle("plan-asignaturas:listar", async (_event, planId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/asignaturas`,
  );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    asignaturas: resultado.data,
  };
});

ipcMain.handle("plan-asignaturas:obtener", async (_event, planId, id) => {
  return ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/asignaturas/${id}`,
  );
});

ipcMain.handle("plan-asignaturas:crear", async (_event, planId, datos) => {
  return ejecutarPeticionAutenticada(`/planes-estudio/${planId}/asignaturas`, {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle(
  "plan-asignaturas:carga-masiva",
  async (_event, planId, datos) => {
    const resultado = await ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/asignaturas/carga-masiva`,
      {
        method: "POST",
        body: datos,
      },
    );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      total: resultado.data.total,
      asignaturas: resultado.data.asignaturas,
    };
  },
);

ipcMain.handle(
  "plan-asignaturas:actualizar",
  async (_event, planId, id, datos) => {
    return ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/asignaturas/${id}`,
      {
        method: "PATCH",
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  "plan-asignaturas:cambiar-estado",
  async (_event, planId, id, activo) => {
    return ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/asignaturas/${id}/estado`,
      {
        method: "PATCH",
        body: { activo },
      },
    );
  },
);

/* =========================================================
   REQUISITOS DEL PLAN
   ========================================================= */

ipcMain.handle("plan-requisitos:listar", async (_event, planId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/requisitos`,
  );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    requisitos: resultado.data,
  };
});

ipcMain.handle("plan-requisitos:crear", async (_event, planId, datos) => {
  return ejecutarPeticionAutenticada(`/planes-estudio/${planId}/requisitos`, {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle(
  "plan-requisitos:carga-masiva",
  async (_event, planId, datos) => {
    const resultado = await ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/requisitos/carga-masiva`,
      {
        method: "POST",
        body: datos,
      },
    );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      total: resultado.data.total,
    };
  },
);

ipcMain.handle("plan-requisitos:eliminar", async (_event, planId, id) => {
  return ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/requisitos/${id}`,
    {
      method: "DELETE",
    },
  );
});

/* =========================================================
   SALIDAS ACADÉMICAS
   ========================================================= */

ipcMain.handle("salidas-academicas:listar", async (_event, planId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/salidas-academicas`,
  );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    salidas: resultado.data,
  };
});

ipcMain.handle("salidas-academicas:crear", async (_event, planId, datos) => {
  return ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/salidas-academicas`,
    {
      method: "POST",
      body: datos,
    },
  );
});

ipcMain.handle(
  "salidas-academicas:actualizar",
  async (_event, planId, salidaId, datos) => {
    return ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/salidas-academicas/${salidaId}`,
      {
        method: "PATCH",
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  "salidas-academicas:cambiar-estado",
  async (_event, planId, salidaId, activo) => {
    return ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/salidas-academicas/${salidaId}/estado`,
      {
        method: "PATCH",
        body: { activo },
      },
    );
  },
);

ipcMain.handle(
  "salidas-academicas:asignaturas",
  async (_event, planId, salidaId, datos) => {
    return ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/salidas-academicas/${salidaId}/asignaturas`,
      {
        method: "PUT",
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  "salidas-academicas:evaluar",
  async (_event, salidaId, estudianteId) => {
    return ejecutarPeticionAutenticada(
      `/planes-estudio/salidas-academicas/${salidaId}/evaluar/${estudianteId}`,
    );
  },
);

/* =========================================================
   TRANSICIONES CURRICULARES
   ========================================================= */

ipcMain.handle("transiciones-curriculares:poblacion", async (_event, planOrigenId, carreraId) => {
  const query = carreraId ? `?planOrigenId=${planOrigenId}&carreraId=${carreraId}` : `?planOrigenId=${planOrigenId}`;
  return ejecutarPeticionAutenticada(`/planes-estudio/transiciones/poblacion${query}`);
});

ipcMain.handle("transiciones-curriculares:simular", async (_event, datos) => {
  return ejecutarPeticionAutenticada("/planes-estudio/transiciones/simular", {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle("transiciones-curriculares:ejecutar", async (_event, datos) => {
  return ejecutarPeticionAutenticada("/planes-estudio/transiciones/ejecutar", {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle("transiciones-curriculares:lotes", async (_event, carreraId, planOrigenId, planDestinoId) => {
  const ruta = construirRutaConFiltros(
    "/planes-estudio/transiciones/lotes",
    { carreraId, planOrigenId, planDestinoId },
    { claves: ["carreraId", "planOrigenId", "planDestinoId"], codificar: false },
  );
  return ejecutarPeticionAutenticada(ruta);
});

ipcMain.handle("convalidaciones-externas:listar", async (_event, carreraId, estado) => {
  const ruta = construirRutaConFiltros(
    "/planes-estudio/transiciones/convalidaciones-externas",
    { carreraId, estado },
    { claves: ["carreraId", "estado"] },
  );
  return ejecutarPeticionAutenticada(ruta);
});

ipcMain.handle("convalidaciones-externas:verificar-evidencia", async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/planes-estudio/transiciones/convalidaciones-externas/${Number(id)}/verificar-evidencia`, {
    method: 'POST', body: datos,
  });
});

ipcMain.handle("convalidaciones-externas:decidir", async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/planes-estudio/transiciones/convalidaciones-externas/${Number(id)}/decision`, {
    method: 'POST', body: datos,
  });
});

ipcMain.handle("convalidaciones-externas:abrir-evidencia", async (_event, referencia) => {
  let parsed;
  try { parsed = new URL(String(referencia)); } catch { return { ok: false, message: 'La referencia no es una URL válida.' }; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return { ok: false, message: 'Solo se pueden abrir referencias HTTPS institucionales.' };
  }
  const urlValidada = parsed.toString();
  await shell.openExternal(urlValidada);
  return { ok: true, abierto: true };
});

ipcMain.handle("plan-resumen:obtener", async (_event, planId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/resumen`,
  );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    resumen: resultado.data,
  };
});

ipcMain.handle("plan-validaciones:validar", async (_event, planId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/validaciones`,
  );

  if (!resultado.ok) {
    return resultado;
  }

  return { ok: true, validacion: resultado.data };
});

/* =========================================================
   BLOQUES DEL PLAN
   ========================================================= */

ipcMain.handle("bloques-plan:listar", async (_event, planId) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/bloques`,
  );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    bloques: resultado.data,
  };
});

ipcMain.handle("bloques-plan:crear", async (_event, planId, datos) => {
  return ejecutarPeticionAutenticada(`/planes-estudio/${planId}/bloques`, {
    method: "POST",
    body: datos,
  });
});

ipcMain.handle(
  "bloques-plan:actualizar",
  async (_event, planId, bloqueId, datos) => {
    return ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/bloques/${bloqueId}`,
      {
        method: "PATCH",
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  "bloques-plan:cambiar-estado",
  async (_event, planId, bloqueId, activo) => {
    return ejecutarPeticionAutenticada(
      `/planes-estudio/${planId}/bloques/${bloqueId}/estado`,
      {
        method: "PATCH",
        body: { activo },
      },
    );
  },
);

/* =========================================================
   PROFESORES
   ========================================================= */

ipcMain.handle(
  'profesores:listar',
  async (_event, filtros = {}) => {
    const resultado = await ejecutarPeticionAutenticada(
      construirRutaConFiltros('/profesores', filtros),
    );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      profesores: resultado.data,
    };
  },
);

ipcMain.handle(
  'profesores:obtener',
  async (_event, id) => {
    return ejecutarPeticionAutenticada(
      `/profesores/${id}`,
    );
  },
);

ipcMain.handle(
  'profesores:disponibilidad',
  async (
    _event,
    profesorId,
    periodoId,
  ) => {
    return ejecutarPeticionAutenticada(
      `/profesores/${profesorId}/disponibilidad/${periodoId}`,
    );
  },
);

/* =========================================================
   PROFESORES - PERFILES Y ATESTADOS
   ========================================================= */

ipcMain.handle(
  'profesores:expediente-perfil',
  async (_event, profesorId, perfilId) => {
    return ejecutarPeticionAutenticada(
      `/profesores/${profesorId}/perfiles/${perfilId}/expediente`,
    );
  },
);

ipcMain.handle(
  'profesores:revisar-requisito-perfil',
  async (
    _event,
    profesorId,
    perfilId,
    requisitoId,
    datos,
  ) => {
    return ejecutarPeticionAutenticada(
      `/profesores/${profesorId}/perfiles/${perfilId}/requisitos/${requisitoId}/revision`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:mi-expediente-perfil',
  async (_event, perfilId) => {
    return ejecutarPeticionAutenticada(
      `/profesores/mi-perfil/perfiles/${perfilId}/expediente`,
    );
  },
);

ipcMain.handle(
  'profesores:guardar-evidencias-requisito',
  async (_event, perfilId, requisitoId, datos) => {
    return ejecutarPeticionAutenticada(
      `/profesores/mi-perfil/perfiles/${perfilId}/requisitos/${requisitoId}/evidencias`,
      {
        method: 'PUT',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:revisar-perfil',
  async (
    _event,
    profesorId,
    perfilId,
    datos,
  ) => {
    return ejecutarPeticionAutenticada(
      `/profesores/${profesorId}/perfiles/${perfilId}/revision`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:inactivar-perfil',
  async (
    _event,
    profesorId,
    perfilId,
    observacion,
  ) => {
    return ejecutarPeticionAutenticada(
      `/profesores/${profesorId}/perfiles/${perfilId}/inactivar`,
      {
        method: 'PATCH',
        body: {
          observacion,
        },
      },
    );
  },
);

ipcMain.handle(
  'profesores:revisar-atestado',
  async (
    _event,
    profesorId,
    atestadoId,
    datos,
  ) => {
    return ejecutarPeticionAutenticada(
      `/profesores/${profesorId}/atestados/${atestadoId}/revision`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

/* =========================================================
   PROFESORES - AUTOGESTIÓN
   ========================================================= */

ipcMain.handle(
  'profesores:mi-perfil',
  async () => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil',
    );
  },
);

ipcMain.handle(
  'profesores:mis-carreras-disponibles',
  async () => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/carreras-disponibles',
    );
  },
);

ipcMain.handle(
  'profesores:actualizar-mis-carreras',
  async (_event, carreraIds) => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/carreras',
      {
        method: 'PUT',
        body: {
          carreraIds,
        },
      },
    );
  },
);

ipcMain.handle(
  'profesores:mis-perfiles',
  async () => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/perfiles',
    );
  },
);

ipcMain.handle(
  'profesores:perfiles-disponibles',
  async () => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/perfiles-disponibles',
    );
  },
);

ipcMain.handle(
  'profesores:solicitar-perfil',
  async (_event, perfilAcademicoId) => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/perfiles',
      {
        method: 'POST',
        body: {
          perfilAcademicoId,
        },
      },
    );
  },
);

ipcMain.handle(
  'profesores:mis-atestados',
  async () => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/atestados',
    );
  },
);

ipcMain.handle(
  'profesores:crear-atestado',
  async (_event, datos) => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/atestados',
      {
        method: 'POST',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:actualizar-atestado',
  async (_event, atestadoId, datos) => {
    return ejecutarPeticionAutenticada(
      `/profesores/mi-perfil/atestados/${atestadoId}`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:inactivar-mi-atestado',
  async (_event, atestadoId) => {
    return ejecutarPeticionAutenticada(
      `/profesores/mi-perfil/atestados/${atestadoId}/inactivar`,
      {
        method: 'PATCH',
      },
    );
  },
);

/* =========================================================
   PROFESORES - PROYECTOS / LABORATORIOS
   ========================================================= */

ipcMain.handle(
  'profesores:mis-proyectos',
  async () => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/proyectos',
    );
  },
);

ipcMain.handle(
  'profesores:crear-proyecto',
  async (_event, datos) => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-perfil/proyectos',
      {
        method: 'POST',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:actualizar-proyecto',
  async (_event, proyectoId, datos) => {
    return ejecutarPeticionAutenticada(
      `/profesores/mi-perfil/proyectos/${proyectoId}`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:cambiar-estado-proyecto',
  async (_event, proyectoId, activo) => {
    return ejecutarPeticionAutenticada(
      `/profesores/mi-perfil/proyectos/${proyectoId}/estado`,
      {
        method: 'PATCH',
        body: {
          activo,
        },
      },
    );
  },
);

/* =========================================================
   PROFESORES - MI DISPONIBILIDAD
   ========================================================= */

ipcMain.handle(
  'profesores:periodos-mi-disponibilidad',
  async () => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-disponibilidad/periodos',
    );
  },
);

ipcMain.handle(
  'profesores:consultar-mi-disponibilidad',
  async (_event, periodoId) => {
    return ejecutarPeticionAutenticada(
      `/profesores/mi-disponibilidad/${periodoId}`,
    );
  },
);

ipcMain.handle(
  'profesores:guardar-mi-disponibilidad',
  async (_event, datos) => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-disponibilidad',
      {
        method: 'PUT',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:copiar-mi-disponibilidad',
  async (_event, datos) => {
    return ejecutarPeticionAutenticada(
      '/profesores/mi-disponibilidad/copiar',
      {
        method: 'POST',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'profesores:historial-mi-disponibilidad',
  async (_event, periodoId) => {
    return ejecutarPeticionAutenticada(
      `/profesores/mi-disponibilidad/${periodoId}/historial`,
    );
  },
);

/* =========================================================
   AULAS
   ========================================================= */

ipcMain.handle(
  'aulas:listar',
  async (_event, filtros = {}) => {
    const resultado = await ejecutarPeticionAutenticada(
      construirRutaConFiltros('/aulas', filtros),
    );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      aulas: resultado.data,
    };
  },
);

ipcMain.handle(
  'aulas:obtener',
  async (_event, id) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${id}`,
    );
  },
);

ipcMain.handle(
  'aulas:crear',
  async (_event, datos) => {
    return ejecutarPeticionAutenticada(
      '/aulas',
      {
        method: 'POST',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'aulas:actualizar',
  async (_event, id, datos) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${id}`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'aulas:cambiar-estado',
  async (_event, id, activo) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${id}/estado`,
      {
        method: 'PATCH',
        body: {
          activo,
        },
      },
    );
  },
);

/* =========================================================
   AULAS - EQUIPAMIENTO
   ========================================================= */

ipcMain.handle(
  'aulas:equipamientos:listar',
  async () => {
    const resultado =
      await ejecutarPeticionAutenticada(
        '/aulas/equipamientos',
      );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      equipamientos: resultado.data,
    };
  },
);

ipcMain.handle(
  'aulas:equipamientos:crear',
  async (_event, datos) => {
    return ejecutarPeticionAutenticada(
      '/aulas/equipamientos',
      {
        method: 'POST',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'aulas:equipamientos:actualizar',
  async (_event, id, datos) => {
    return ejecutarPeticionAutenticada(
      `/aulas/equipamientos/${id}`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'aulas:equipamientos:cambiar-estado',
  async (_event, id, activo) => {
    return ejecutarPeticionAutenticada(
      `/aulas/equipamientos/${id}/estado`,
      {
        method: 'PATCH',
        body: {
          activo,
        },
      },
    );
  },
);

ipcMain.handle(
  'aulas:equipo-aula:listar',
  async (_event, aulaId) => {
    const resultado =
      await ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/equipamientos`,
      );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      equipamientos: resultado.data,
    };
  },
);

ipcMain.handle(
  'aulas:equipo-aula:asignar',
  async (_event, aulaId, datos) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/equipamientos`,
      {
        method: 'POST',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'aulas:equipo-aula:actualizar',
  async (
    _event,
    aulaId,
    equipamientoId,
    datos,
  ) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/equipamientos/${equipamientoId}`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'aulas:equipo-aula:desasignar',
  async (
    _event,
    aulaId,
    equipamientoId,
  ) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/equipamientos/${equipamientoId}`,
      {
        method: 'DELETE',
      },
    );
  },
);

ipcMain.handle(
  'aulas:equipo-aula:cambiar-estado',
  async (
    _event,
    aulaId,
    equipamientoId,
    activo,
  ) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/equipamientos/${equipamientoId}/estado`,
      {
        method: 'PATCH',
        body: {
          activo,
        },
      },
    );
  },
);

/* =========================================================
   AULAS - INDISPONIBILIDADES
   ========================================================= */

ipcMain.handle(
  'aulas:indisponibilidades:listar',
  async (_event, aulaId) => {
    const resultado =
      await ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/indisponibilidades`,
      );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      indisponibilidades: resultado.data,
    };
  },
);

ipcMain.handle(
  'aulas:indisponibilidades:obtener',
  async (_event, aulaId, id) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/indisponibilidades/${id}`,
    );
  },
);

ipcMain.handle(
  'aulas:indisponibilidades:crear',
  async (_event, aulaId, datos) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/indisponibilidades`,
      {
        method: 'POST',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'aulas:indisponibilidades:actualizar',
  async (_event, aulaId, id, datos) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/indisponibilidades/${id}`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);

ipcMain.handle(
  'aulas:indisponibilidades:cambiar-estado',
  async (
    _event,
    aulaId,
    id,
    activo,
  ) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/indisponibilidades/${id}/estado`,
      {
        method: 'PATCH',
        body: {
          activo,
        },
      },
    );
  },
);

/* =========================================================
   AULAS - RESERVAS EXTRAORDINARIAS
   ========================================================= */

ipcMain.handle(
  'aulas:reservas:listar',
  async (_event, aulaId) => {
    const resultado =
      await ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/reservas`,
      );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      reservas: resultado.data,
    };
  },
);

ipcMain.handle(
  'aulas:reservas:obtener',
  async (_event, aulaId, id) =>
    ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/reservas/${id}`,
    ),
);

ipcMain.handle(
  'aulas:reservas:crear',
  async (_event, aulaId, datos) =>
    ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/reservas`,
      {
        method: 'POST',
        body: datos,
      },
    ),
);

ipcMain.handle(
  'aulas:reservas:actualizar',
  async (_event, aulaId, id, datos) =>
    ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/reservas/${id}`,
      {
        method: 'PATCH',
        body: datos,
      },
    ),
);

ipcMain.handle(
  'aulas:reservas:cambiar-estado',
  async (
    _event,
    aulaId,
    id,
    activo,
  ) =>
    ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/reservas/${id}/estado`,
      {
        method: 'PATCH',
        body: { activo },
      },
    ),
);

/* =========================================================
   AULAS - OCUPACIÓN
   ========================================================= */

ipcMain.handle(
  'aulas:ocupacion',
  async (
    _event,
    aulaId,
    filtros,
  ) => {
    const params =
      new URLSearchParams({
        fechaHoraInicio:
          filtros.fechaHoraInicio,

        fechaHoraFin:
          filtros.fechaHoraFin,
      });


    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/ocupacion?${params.toString()}`,
    );
  },
);

/* =========================================================
   AULAS - DISPONIBILIDAD BASE
   ========================================================= */

ipcMain.handle(
  'aulas:disponibilidades:listar',
  async (
    _event,
    aulaId,
    periodoId,
  ) => {
    const params =
      new URLSearchParams({
        periodoId:
          String(periodoId),
      });


    const resultado =
      await ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/disponibilidades?${params.toString()}`,
      );


    if (!resultado.ok) {
      return resultado;
    }


    return {
      ok: true,
      disponibilidades:
        resultado.data,
    };
  },
);


ipcMain.handle(
  'aulas:disponibilidades:crear',
  async (
    _event,
    aulaId,
    datos,
  ) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/disponibilidades`,
      {
        method: 'POST',
        body: datos,
      },
    );
  },
);


ipcMain.handle(
  'aulas:disponibilidades:actualizar',
  async (
    _event,
    aulaId,
    id,
    datos,
  ) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/disponibilidades/${id}`,
      {
        method: 'PATCH',
        body: datos,
      },
    );
  },
);


ipcMain.handle(
  'aulas:disponibilidades:eliminar',
  async (
    _event,
    aulaId,
    id,
  ) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/disponibilidades/${id}`,
      {
        method: 'DELETE',
      },
    );
  },
);

/* =========================================================
   AULAS - BÚSQUEDA / EVALUACIÓN
   ========================================================= */

ipcMain.handle(
  'aulas:buscar-disponibles',
  async (_event, criterios) => {
    const resultado =
      await ejecutarPeticionAutenticada(
        '/aulas/buscar-disponibles',
        {
          method: 'POST',
          body: criterios,
        },
      );


    if (!resultado.ok) {
      return resultado;
    }


    return {
      ok: true,
      aulas: resultado.data,
    };
  },
);


ipcMain.handle(
  'aulas:evaluar-asignacion',
  async (
    _event,
    aulaId,
    criterios,
  ) => {
    return ejecutarPeticionAutenticada(
      `/aulas/${aulaId}/evaluar-asignacion`,
      {
        method: 'POST',
        body: criterios,
      },
    );
  },
);


/* =========================================================
   AULAS - AUDITORÍA
   ========================================================= */

ipcMain.handle(
  'aulas:auditoria:listar',
  async (_event, aulaId) => {
    const resultado =
      await ejecutarPeticionAutenticada(
        `/aulas/${aulaId}/auditoria`,
      );

    if (!resultado.ok) {
      return resultado;
    }

    return {
      ok: true,
      auditoria: resultado.data,
    };
  },
);
/* =========================================================
   FORMULARIOS DE ESTUDIANTES
   ========================================================= */

ipcMain.handle('formularios-estudiantes:listar', async () => {
  return ejecutarPeticionAutenticada('/formularios-estudiantes');
});

ipcMain.handle('formularios-estudiantes:google-estado', async () => {
  return ejecutarPeticionAutenticada('/integraciones/google/oauth/estado');
});

ipcMain.handle('formularios-estudiantes:google-conectar', async () => {
  const resultado = await ejecutarPeticionAutenticada(
    '/integraciones/google/oauth/iniciar',
    { method: 'POST' },
  );

  if (!resultado.ok) {
    return resultado;
  }

  const url = resultado.data?.url;
  const urlValidada = validarUrlExternaGoogle(
    url,
    HOSTS_OAUTH_GOOGLE_PERMITIDOS,
  );

  await shell.openExternal(urlValidada);

  return { ok: true, abierto: true };
});

ipcMain.handle('formularios-estudiantes:google-desconectar', async () => {
  return ejecutarPeticionAutenticada(
    '/integraciones/google/oauth/desconectar',
    { method: 'DELETE' },
  );
});

ipcMain.handle(
  'formularios-estudiantes:crear',
  async (_event, datos) => {
    return ejecutarPeticionAutenticada('/formularios-estudiantes', {
      method: 'POST',
      body: datos,
    });
  },
);

ipcMain.handle(
  'formularios-estudiantes:sincronizar',
  async (_event, id) => {
    return ejecutarPeticionAutenticada(
      `/formularios-estudiantes/${id}/sincronizar`,
      { method: 'POST' },
    );
  },
);

ipcMain.handle(
  'formularios-estudiantes:solicitudes',
  async (_event, filtros = {}) => {
    return ejecutarPeticionAutenticada(
      construirRutaConFiltros('/formularios-estudiantes/solicitudes', filtros, {
        claves: ['carreraId', 'planEstudioId'],
      }),
    );
  },
);

ipcMain.handle(
  'formularios-estudiantes:conteos-solicitudes',
  async (_event, carreraId) => {
    return ejecutarPeticionAutenticada(
      `/formularios-estudiantes/solicitudes/conteos?carreraId=${encodeURIComponent(carreraId)}`,
    );
  },
);

ipcMain.handle(
  'formularios-estudiantes:aceptar-solicitud',
  async (_event, respuestaId) => {
    return ejecutarPeticionAutenticada(
      `/formularios-estudiantes/respuestas/${respuestaId}/aceptar`,
      { method: 'POST' },
    );
  },
);

ipcMain.handle(
  'formularios-estudiantes:rechazar-solicitud',
  async (_event, respuestaId, motivo) => {
    return ejecutarPeticionAutenticada(
      `/formularios-estudiantes/respuestas/${respuestaId}/rechazar`,
      {
        method: 'POST',
        body: { motivo: motivo?.trim() || undefined },
      },
    );
  },
);

ipcMain.handle('formularios-estudiantes:cerrar', async (_event, id) => {
  return ejecutarPeticionAutenticada(
    `/formularios-estudiantes/${id}/cerrar`,
    { method: 'POST' },
  );
});

ipcMain.handle('formularios-estudiantes:publicar', async (_event, id) => {
  return ejecutarPeticionAutenticada(
    `/formularios-estudiantes/${id}/publicar`,
    { method: 'POST' },
  );
});

ipcMain.handle('formularios-estudiantes:regenerar-token', async (_event, id) => {
  return ejecutarPeticionAutenticada(
    `/formularios-estudiantes/${id}/regenerar-token`,
    { method: 'POST' },
  );
});

ipcMain.handle('formularios-estudiantes:respuestas', async (_event, id) => {
  return ejecutarPeticionAutenticada(
    `/formularios-estudiantes/${id}/respuestas`,
  );
});

ipcMain.handle(
  'formularios-estudiantes:ticket-vista-previa',
  async (_event, id) => {
    return ejecutarPeticionAutenticada(
      `/formularios-estudiantes/${id}/ticket-vista-previa`,
      { method: 'POST' },
    );
  },
);

ipcMain.handle(
  'formularios-estudiantes:obtener-url-publica',
  async (_event, responderUri) => {
    try {
      const url = resolverUrlPublicaFormulario(responderUri);
      return { ok: true, url };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  },
);

ipcMain.handle(
  'formularios-estudiantes:abrir-enlace',
  async (_event, url) => {
    try {
      const urlResuelta = resolverUrlPublicaFormulario(url);
      const urlValidada = validarUrlExternaFormulario(
        urlResuelta,
        process.env.SGPA_PUBLIC_URL || apiUrl,
        process.env.NODE_ENV === 'production',
      );
      await shell.openExternal(urlValidada);
      return { ok: true, url: urlValidada };
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'No fue posible abrir el enlace.',
      };
    }
  },
);

/* =========================================================
   ESTUDIANTES
   ========================================================= */

ipcMain.handle('estudiantes:conteos-carreras', async () => {
  return ejecutarPeticionAutenticada('/estudiantes/conteos/carreras');
});

ipcMain.handle('estudiantes:conteos-planes', async (_event, carreraId) => {
  return ejecutarPeticionAutenticada(
    `/estudiantes/conteos/planes?carreraId=${encodeURIComponent(carreraId)}`,
  );
});

ipcMain.handle('estudiantes:listar', async (_event, filtros = {}) => {
  const resultado = await ejecutarPeticionAutenticada(
    construirRutaConFiltros('/estudiantes', filtros, {
      claves: ['texto', 'carreraId', 'planEstudioId', 'periodoIngresoId', 'estado'],
      clavesTrim: ['texto'],
    }),
  );

  if (!resultado.ok) {
    return resultado;
  }

  return {
    ok: true,
    estudiantes: Array.isArray(resultado.data) ? resultado.data : [],
  };
});

ipcMain.handle('estudiantes:obtener', async (_event, id) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}`);
});

ipcMain.handle('estudiantes:actualizar', async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}`, {
    method: 'PATCH',
    body: datos,
  });
});

ipcMain.handle('estudiantes:crear', async (_event, datos) => {
  return ejecutarPeticionAutenticada('/estudiantes', {
    method: 'POST',
    body: datos,
  });
});

ipcMain.handle('estudiantes:cambiar-estado', async (_event, id, estado) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/estado`, {
    method: 'PATCH',
    body: { estado },
  });
});

ipcMain.handle('estudiantes:cambiar-plan', async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/plan`, {
    method: 'PATCH',
    body: datos,
  });
});

ipcMain.handle('estudiantes:historial-academico', async (_event, id) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/historial-academico`);
});

ipcMain.handle('estudiantes:historial-planes', async (_event, id) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/historial-planes`);
});

ipcMain.handle(
  'estudiantes:progreso',
  async (_event, id, periodoReferenciaId) => {
    const params = new URLSearchParams({
      periodoReferenciaId: String(periodoReferenciaId),
    });
    return ejecutarPeticionAutenticada(
      `/estudiantes/${id}/progreso?${params.toString()}`,
    );
  },
);

ipcMain.handle(
  'estudiantes:registrar-resultado',
  async (_event, id, datos) => {
    return ejecutarPeticionAutenticada(
      `/estudiantes/${id}/historial-academico`,
      { method: 'POST', body: datos },
    );
  },
);

ipcMain.handle('estudiantes:evaluar-graduacion', async (_event, id) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/evaluacion-graduacion`);
});

ipcMain.handle('estudiantes:confirmar-graduacion', async (_event, id, observacion) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/confirmar-graduacion`, {
    method: 'POST',
    body: { observacion },
  });
});

ipcMain.handle('estudiantes:graduar', async (_event, id, observacion) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/confirmar-graduacion`, {
    method: 'POST',
    body: { observacion },
  });
});

ipcMain.handle('estudiantes:reingreso-diagnostico', async (_event, id) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/reingreso/diagnostico`);
});

ipcMain.handle('estudiantes:reingresar', async (_event, id, datos) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/reingresar`, {
    method: 'POST',
    body: datos || {},
  });
});

ipcMain.handle('estudiantes:comparar-planes', async (_event, id, planNuevoId) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/comparar-planes?planNuevoId=${planNuevoId}`);
});

ipcMain.handle('estudiantes:corregir-resultado', async (_event, id, historialId, datos) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/historial-academico/${historialId}/corregir`, {
    method: 'PATCH',
    body: datos,
  });
});

ipcMain.handle('estudiantes:correcciones-historial', async (_event, id) => {
  return ejecutarPeticionAutenticada(`/estudiantes/${id}/historial-academico/correcciones`);
});

ipcMain.handle('estudiantes-revision:bandeja', async (_event, filtros = {}) => {
  const query = new URLSearchParams();
  for (const nombre of ['carreraId', 'planEstudioId', 'fuente', 'estado', 'texto']) {
    if (filtros[nombre] !== undefined && filtros[nombre] !== null && String(filtros[nombre]).trim() !== '') {
      query.append(nombre, String(filtros[nombre]).trim());
    }
  }
  const qStr = query.toString();
  return ejecutarPeticionAutenticada(`/estudiantes/bandeja-revision${qStr ? `?${qStr}` : ''}`);
});

ipcMain.handle('estudiantes-revision:detalle', async (_event, id) => {
  return ejecutarPeticionAutenticada(`/estudiantes/bandeja-revision/${id}`);
});

ipcMain.handle('estudiantes-revision:lote-excel', async (_event, payload) => {
  return ejecutarPeticionAutenticada('/estudiantes/bandeja-revision/lote-excel', {
    method: 'POST',
    body: payload,
  });
});

ipcMain.handle('estudiantes-revision:aprobar-masivo', async (_event, registroIds) => {
  const payload = normalizarPayloadColeccion(registroIds, 'registroIds');
  return ejecutarPeticionAutenticada('/estudiantes/bandeja-revision/aprobar-masivo', {
    method: 'POST',
    body: payload,
  });
});

ipcMain.handle('estudiantes-revision:rechazar-masivo', async (_event, rechazos) => {
  const payload = normalizarPayloadColeccion(rechazos, 'rechazos');
  return ejecutarPeticionAutenticada('/estudiantes/bandeja-revision/rechazar-masivo', {
    method: 'POST',
    body: payload,
  });
});

ipcMain.handle('estudiantes-revision:devolver', async (_event, registroIds, observacion) => {
  return ejecutarPeticionAutenticada('/estudiantes/bandeja-revision/devolver', {
    method: 'POST',
    body: { registroIds, observacion },
  });
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#f5f6f8",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
