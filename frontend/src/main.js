import { app, BrowserWindow, ipcMain, net } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

import { registrarPlanImportacionIpc } from "./electron/ipc/plan-importacion.ipc.js";

const API_URL = "http://127.0.0.1:3000";
let accessToken = null;


async function ejecutarPeticionAutenticada(ruta, opciones = {}) {
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      message: "No existe una sesión activa.",
    };
  }

  const { method = "GET", body } = opciones;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await net.fetch(`${API_URL}${ruta}`, {
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
        accessToken = null;
      }

      const mensaje = Array.isArray(data?.message)
        ? data.message.join(". ")
        : data?.message;

      return {
        ok: false,
        status: response.status,
        message: mensaje || "No fue posible realizar la operación.",
      };
    }

    return {
      ok: true,
      data,
    };
  } catch (error) {
    console.error(`Error solicitando ${method} ${ruta}:`, error);

    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el servidor del SGPA.",
    };
  }
}

registrarPlanImportacionIpc({
  ejecutarPeticionAutenticada,
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}


ipcMain.handle("auth:login", async (_event, credenciales) => {
  try {
    const response = await net.fetch(`${API_URL}/auth/login`, {
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

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: data.message || "No fue posible iniciar sesión",
      };
    }

    accessToken = data.accessToken;

    return {
      ok: true,
      usuario: data.usuario,
    };
  } catch (error) {
    console.error("Error al conectar con el backend:", error);
    return {
      ok: false,
      status: 0,
      message: "No se pudo conectar con el servidor del SGPA.",
    };
  }
});

ipcMain.handle("auth:recuperar-password", async (_event, datos) => {
  try {
    const response = await net.fetch(`${API_URL}/auth/recuperar-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correo: datos.correo,
      }),
    });

    const data = await response.json();
    const message = Array.isArray(data.message)
      ? data.message.join(". ")
      : data.message;

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
      message: "No se pudo conectar con el servidor del SGPA.",
    };
  }
});

ipcMain.handle("auth:restablecer-password", async (_event, datos) => {
  try {
    const response = await net.fetch(`${API_URL}/auth/restablecer-password`, {
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
    const message = Array.isArray(data.message)
      ? data.message.join(". ")
      : data.message;

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
      message: "No se pudo conectar con el servidor del SGPA.",
    };
  }
});

ipcMain.handle("auth:perfil", async () => {
  if (!accessToken) {
    return {
      ok: false,
      message: "No existe una sesión activa.",
    };
  }

  try {
    const response = await net.fetch(`${API_URL}/auth/perfil`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      accessToken = null;
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
    console.error(error);
    return {
      ok: false,
      message: "No se pudo conectar con el servidor.",
    };
  }
});

ipcMain.handle("auth:logout", () => {
  accessToken = null;
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

ipcMain.handle("usuarios:revocar-rol", async (_event, usuarioId, rolId) => {
  return ejecutarPeticionAutenticada(`/usuarios/${usuarioId}/roles/${rolId}`, {
    method: "DELETE",
  });
});

ipcMain.handle("roles:listar", async () => {
  return ejecutarPeticionAutenticada("/roles");
});

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

ipcMain.handle(
  "cursos:asignaturas-disponibles",
  async (_event, filtros = {}) => {
    const params = new URLSearchParams();

    if (filtros.carreraId) {
      params.set("carreraId", String(filtros.carreraId));
    }

    if (filtros.planId) {
      params.set("planId", String(filtros.planId));
    }

    if (filtros.nivel) {
      params.set("nivel", String(filtros.nivel));
    }

    if (filtros.ciclo) {
      params.set("ciclo", String(filtros.ciclo));
    }

    const query = params.toString();

    const resultado = await ejecutarPeticionAutenticada(
      `/cursos/asignaturas-disponibles${query ? `?${query}` : ""}`,
    );

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

ipcMain.handle("planes-estudio:cambiar-estado", async (_event, id, activo) => {
  return ejecutarPeticionAutenticada(`/planes-estudio/${id}/estado`, {
    method: "PATCH",
    body: { activo },
  });
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
    const params = new URLSearchParams();

    Object.entries(filtros).forEach(
      ([clave, valor]) => {
        if (
          valor !== undefined &&
          valor !== null &&
          valor !== ''
        ) {
          params.set(
            clave,
            String(valor),
          );
        }
      },
    );

    const query = params.toString();

    const resultado =
      await ejecutarPeticionAutenticada(
        `/profesores${query ? `?${query}` : ''}`,
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
    const params =
      new URLSearchParams();

    Object.entries(filtros).forEach(
      ([clave, valor]) => {
        if (
          valor !== undefined &&
          valor !== null &&
          valor !== ''
        ) {
          params.set(
            clave,
            String(valor),
          );
        }
      },
    );

    const query =
      params.toString();

    const resultado =
      await ejecutarPeticionAutenticada(
        `/aulas${query ? `?${query}` : ''}`,
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
