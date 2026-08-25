import { app, BrowserWindow, dialog, ipcMain, net } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import started from "electron-squirrel-startup";

const API_URL = "http://127.0.0.1:3000";
let accessToken = null;

function normalizarCabecera(valor) {
  return String(valor ?? "")
    .trim()
    .toUpperCase();
}

function obtenerTextoCelda(celda) {
  return String(celda?.text ?? "").trim();
}

function obtenerCabecerasHoja(worksheet) {
  const fila = worksheet.getRow(1);
  const cabeceras = [];

  for (let columna = 1; columna <= worksheet.actualColumnCount; columna += 1) {
    cabeceras.push(
      normalizarCabecera(obtenerTextoCelda(fila.getCell(columna))),
    );
  }

  return cabeceras;
}

function leerHojaExcel(workbook, nombre, requeridas, obligatoria = true) {
  const worksheet = workbook.getWorksheet(nombre);
  if (!worksheet) {
    if (!obligatoria) return [];
    throw new Error(`El archivo no contiene la hoja "${nombre}".`);
  }

  const cabeceras = obtenerCabecerasHoja(worksheet);
  const faltantes = requeridas.filter(
    (cabecera) => !cabeceras.includes(cabecera),
  );
  if (faltantes.length) {
    throw new Error(
      `La hoja "${nombre}" no contiene las columnas requeridas: ${faltantes.join(", ")}.`,
    );
  }

  const filas = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const objeto = {};
    cabeceras.forEach((cabecera, indice) => {
      if (cabecera)
        objeto[cabecera] = obtenerTextoCelda(row.getCell(indice + 1));
    });
    if (Object.values(objeto).some((valor) => String(valor).trim() !== "")) {
      filas.push({ __fila: rowNumber, ...objeto });
    }
  });

  return filas;
}

async function leerArchivoPlanExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  return {
    bloques: leerHojaExcel(workbook, "BLOQUES", [
      "CODIGO",
      "NOMBRE",
      "TIPO",
      "ORDEN",
    ]),
    asignaturas: leerHojaExcel(workbook, "ASIGNATURAS", [
      "CLAVE",
      "CODIGO",
      "NOMBRE",
      "BLOQUE",
      "NIVEL",
      "CICLO",
      "ORDEN",
      "CREDITOS",
      "TIPO",
      "T",
      "P",
      "L",
      "G",
      "EI",
      "HT",
      "HD",
      "OBSERVACION_HORAS",
    ]),
    requisitos: leerHojaExcel(
      workbook,
      "REQUISITOS",
      ["ASIGNATURA_CLAVE", "RELACIONADA_CLAVE", "TIPO"],
      false,
    ),
    salidas: leerHojaExcel(
      workbook,
      "SALIDAS",
      ["CODIGO", "NOMBRE", "TIPO", "CREDITOS_REQUERIDOS", "ORDEN"],
      false,
    ),
    salidaAsignaturas: leerHojaExcel(
      workbook,
      "SALIDA_ASIGNATURAS",
      ["SALIDA_CODIGO", "ASIGNATURA_CLAVE"],
      false,
    ),
  };
}

function aplicarEstiloCabecera(worksheet) {
  const row = worksheet.getRow(1);
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
  row.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } };
  });
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

function prepararHoja(workbook, nombre, columnas) {
  const worksheet = workbook.addWorksheet(nombre);
  worksheet.columns = columnas.map((columna) => ({
    header: columna.header,
    key: columna.key,
    width: columna.width || 18,
  }));
  aplicarEstiloCabecera(worksheet);
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnas.length },
  };
  return worksheet;
}

function aplicarValidacionLista(worksheet, columna, hasta, valores) {
  for (let fila = 2; fila <= hasta; fila += 1) {
    worksheet.getCell(`${columna}${fila}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${valores.join(",")}"`],
    };
  }
}

function aplicarValidacionNumero(
  worksheet,
  columna,
  hasta,
  minimo,
  permitirVacio = false,
  tipo = "whole",
) {
  for (let fila = 2; fila <= hasta; fila += 1) {
    worksheet.getCell(`${columna}${fila}`).dataValidation = {
      type,
      operator: "greaterThanOrEqual",
      formulae: [minimo],
      allowBlank: permitirVacio,
    };
  }
}

async function crearPlantillaExcelPlan(destino) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SGPA";
  workbook.title = "Plantilla de Plan de Estudio";
  workbook.subject = "Importación de mallas curriculares SGPA";

  const bloques = prepararHoja(workbook, "BLOQUES", [
    { header: "CODIGO", key: "codigo" },
    { header: "NOMBRE", key: "nombre", width: 36 },
    { header: "TIPO", key: "tipo", width: 22 },
    { header: "ORDEN", key: "orden", width: 12 },
    { header: "DESCRIPCION", key: "descripcion", width: 45 },
  ]);
  bloques.addRow({
    codigo: "TC",
    nombre: "Tronco común",
    tipo: "TRONCO_COMUN",
    orden: 1,
    descripcion: "Fila de ejemplo. Puede eliminarla.",
  });
  aplicarValidacionLista(bloques, "C", 300, [
    "TRONCO_COMUN",
    "ENFASIS",
    "SALIDA_LATERAL",
    "GRADO",
    "OTRO",
  ]);

  const asignaturas = prepararHoja(workbook, "ASIGNATURAS", [
    { header: "CLAVE", key: "clave", width: 18 },
    { header: "CODIGO", key: "codigo", width: 20 },
    { header: "NOMBRE", key: "nombre", width: 36 },
    { header: "BLOQUE", key: "bloque", width: 18 },
    { header: "NIVEL", key: "nivel", width: 10 },
    { header: "CICLO", key: "ciclo", width: 10 },
    { header: "ORDEN", key: "orden", width: 10 },
    { header: "CREDITOS", key: "creditos", width: 12 },
    { header: "TIPO", key: "tipo", width: 16 },
    { header: "T", key: "t", width: 8 },
    { header: "P", key: "p", width: 8 },
    { header: "L", key: "l", width: 8 },
    { header: "G", key: "g", width: 8 },
    { header: "EI", key: "ei", width: 8 },
    { header: "HT", key: "ht", width: 8 },
    { header: "HD", key: "hd", width: 8 },
    { header: "OBSERVACION_HORAS", key: "observacionHoras", width: 38 },
  ]);
  asignaturas.addRows([
    {
      clave: "EIF101",
      codigo: "EIF101",
      nombre: "Fundamentos de Informática",
      bloque: "TC",
      nivel: 1,
      ciclo: 1,
      orden: 1,
      creditos: 4,
      tipo: "OBLIGATORIA",
      t: 3,
      p: 1,
      l: 0,
      ei: 6,
      ht: 10,
      hd: 4,
      observacionHoras: "Fila de ejemplo. Puede eliminarla.",
    },
    {
      clave: "EIF102",
      codigo: "EIF102",
      nombre: "Programación I",
      bloque: "TC",
      nivel: 1,
      ciclo: 1,
      orden: 2,
      creditos: 4,
      tipo: "OBLIGATORIA",
    },
    {
      clave: "OPT-01",
      codigo: "OPT-01",
      nombre: "Optativa",
      bloque: "TC",
      nivel: 2,
      ciclo: 1,
      orden: 1,
      creditos: 3,
      tipo: "OPTATIVA",
    },
  ]);
  aplicarValidacionLista(asignaturas, "I", 600, [
    "OBLIGATORIA",
    "OPTATIVA",
    "OTRA",
  ]);
  for (const columna of ["E", "F", "G"])
    aplicarValidacionNumero(asignaturas, columna, 600, 1);
  aplicarValidacionNumero(asignaturas, "H", 600, 0);
  for (const columna of ["J", "K", "L", "M", "N", "O", "P"])
    aplicarValidacionNumero(asignaturas, columna, 600, 0, true, "decimal");

  const requisitos = prepararHoja(workbook, "REQUISITOS", [
    { header: "ASIGNATURA_CLAVE", key: "asignatura", width: 22 },
    { header: "RELACIONADA_CLAVE", key: "relacionada", width: 22 },
    { header: "TIPO", key: "tipo" },
  ]);
  requisitos.addRow({
    asignatura: "EIF102",
    relacionada: "EIF101",
    tipo: "REQUISITO",
  });
  aplicarValidacionLista(requisitos, "C", 1000, ["REQUISITO", "CORREQUISITO"]);

  const salidas = prepararHoja(workbook, "SALIDAS", [
    { header: "CODIGO", key: "codigo" },
    { header: "NOMBRE", key: "nombre", width: 40 },
    { header: "TIPO", key: "tipo", width: 20 },
    { header: "CREDITOS_REQUERIDOS", key: "creditos", width: 24 },
    { header: "ORDEN", key: "orden", width: 12 },
    { header: "DESCRIPCION", key: "descripcion", width: 45 },
  ]);
  salidas.addRows([
    {
      codigo: "DIP",
      nombre: "Diplomado",
      tipo: "DIPLOMADO",
      creditos: 88,
      orden: 1,
      descripcion: "Ejemplo de título intermedio.",
    },
    {
      codigo: "BACH",
      nombre: "Bachillerato",
      tipo: "BACHILLERATO",
      creditos: 140,
      orden: 2,
    },
  ]);
  aplicarValidacionLista(salidas, "C", 200, [
    "DIPLOMADO",
    "BACHILLERATO",
    "LICENCIATURA",
    "CERTIFICADO",
    "OTRO",
  ]);
  aplicarValidacionNumero(salidas, "D", 200, 1);
  aplicarValidacionNumero(salidas, "E", 200, 1);

  const salidaAsignaturas = prepararHoja(workbook, "SALIDA_ASIGNATURAS", [
    { header: "SALIDA_CODIGO", key: "salida", width: 22 },
    { header: "ASIGNATURA_CLAVE", key: "asignatura", width: 24 },
  ]);
  salidaAsignaturas.addRows([
    { salida: "DIP", asignatura: "EIF101" },
    { salida: "BACH", asignatura: "EIF101" },
    { salida: "BACH", asignatura: "EIF102" },
  ]);

  const instrucciones = workbook.addWorksheet("INSTRUCCIONES");
  instrucciones.columns = [{ width: 28 }, { width: 85 }];
  instrucciones.addRows([
    ["PLANTILLA SGPA", "Importación completa de un plan de estudio"],
    ["", ""],
    [
      "BLOQUES",
      "Define tronco común, énfasis u otras agrupaciones estructurales.",
    ],
    [
      "ASIGNATURAS",
      "CLAVE identifica cada asignatura dentro del archivo y se utiliza para requisitos y salidas. CODIGO y NOMBRE corresponden a la información curricular de la asignatura dentro del plan.",
    ],
    [
      "Asignaturas",
      "Todas las asignaturas se crean primero dentro del plan de estudio. No es necesario que exista previamente un curso en el catálogo de SGPA.",
    ],
    [
      "REQUISITOS",
      "ASIGNATURA_CLAVE exige la relación; RELACIONADA_CLAVE es el requisito o correquisito.",
    ],
    [
      "SALIDAS",
      "Representa títulos o salidas académicas, por ejemplo Diplomado o Bachillerato.",
    ],
    [
      "SALIDA_ASIGNATURAS",
      "Una asignatura puede pertenecer a varias salidas académicas.",
    ],
    ["", ""],
    [
      "IMPORTANTE",
      "Las filas incluidas son ejemplos. Bórrelas antes de cargar el plan real.",
    ],
    [
      "IMPORTANTE",
      "La importación completa requiere que el plan de destino esté vacío.",
    ],
  ]);
  instrucciones.getRow(1).font = { bold: true, size: 14 };
  instrucciones.orderNo = 0;
  await workbook.xlsx.writeFile(destino);
}

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

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

ipcMain.handle("plan-importacion:seleccionar-excel", async () => {
  try {
    const resultado = await dialog.showOpenDialog({
      title: "Seleccionar plan de estudio",
      properties: ["openFile"],
      filters: [{ name: "Archivo Excel", extensions: ["xlsx"] }],
    });

    if (resultado.canceled || !resultado.filePaths.length) {
      return { ok: false, cancelado: true };
    }

    const filePath = resultado.filePaths[0];
    const info = await fs.stat(filePath);
    const maximo = 5 * 1024 * 1024;
    if (info.size > maximo) {
      return {
        ok: false,
        message: "El archivo Excel supera el límite de 5 MB.",
      };
    }

    const datos = await leerArchivoPlanExcel(filePath);
    return { ok: true, archivo: path.basename(filePath), datos };
  } catch (error) {
    console.error("Error leyendo Excel del plan:", error);
    return {
      ok: false,
      message: error?.message || "No fue posible leer el archivo Excel.",
    };
  }
});

ipcMain.handle("plan-importacion:guardar-plantilla", async () => {
  try {
    const resultado = await dialog.showSaveDialog({
      title: "Guardar plantilla SGPA",
      defaultPath: "Plantilla_Plan_Estudio_SGPA.xlsx",
      filters: [{ name: "Archivo Excel", extensions: ["xlsx"] }],
    });
    if (resultado.canceled || !resultado.filePath) {
      return { ok: false, cancelado: true };
    }
    const destino = resultado.filePath.toLowerCase().endsWith(".xlsx")
      ? resultado.filePath
      : `${resultado.filePath}.xlsx`;
    await crearPlantillaExcelPlan(destino);
    return { ok: true, archivo: path.basename(destino) };
  } catch (error) {
    console.error("Error creando plantilla Excel:", error);
    return {
      ok: false,
      message: error?.message || "No fue posible crear la plantilla Excel.",
    };
  }
});

ipcMain.handle("plan-importacion:validar", async (_event, planId, datos) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/importacion/validar`,
    { method: "POST", body: datos },
  );

  if (!resultado.ok) return resultado;
  return { ok: true, validacion: resultado.data };
});

ipcMain.handle("plan-importacion:ejecutar", async (_event, planId, datos) => {
  const resultado = await ejecutarPeticionAutenticada(
    `/planes-estudio/${planId}/importacion/ejecutar`,
    { method: "POST", body: datos },
  );

  if (!resultado.ok) return resultado;
  return { ok: true, importacion: resultado.data };
});

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
        "Se generó un código de recuperación válido durante 15 minutos.",
      codigoDesarrollo: data.codigoDesarrollo,
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
