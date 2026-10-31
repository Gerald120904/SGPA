import ExcelJS from "exceljs";
import fs from "node:fs/promises";

const CABECERAS_ESTUDIANTES = [
  "CEDULA",
  "NOMBRES",
  "APELLIDO1",
  "APELLIDO2",
  "CORREO_INSTITUCIONAL",
  "TELEFONO",
  "PERIODO_INGRESO",
];
const CABECERAS_APROBADOS = ["CEDULA", "ASIGNATURA"];

function texto(celda) {
  if (celda === null || celda === undefined) return "";
  if (typeof celda === "object" && "text" in celda) {
    return String(celda.text ?? "").trim();
  }
  return String(celda).trim();
}

function normalizarCodigo(valor) {
  return String(valor ?? "")
    .trim()
    .toUpperCase();
}

function normalizarCabecera(valor) {
  return String(valor ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function desglosarNombreCompleto(nombreCompleto) {
  const partes = String(nombreCompleto ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return { nombres: "", apellido1: "", apellido2: null };
  if (partes.length === 1) return { nombres: partes[0], apellido1: "No indicado", apellido2: null };
  if (partes.length === 2) return { nombres: partes[0], apellido1: partes[1], apellido2: null };
  if (partes.length === 3) return { nombres: partes[0], apellido1: partes[1], apellido2: partes[2] };
  return {
    nombres: partes.slice(0, partes.length - 2).join(" "),
    apellido1: partes[partes.length - 2],
    apellido2: partes[partes.length - 1],
  };
}

function mapearIndicesEstudiantes(cabeceras) {
  const mapa = {};
  cabeceras.forEach((c, index) => {
    const norm = normalizarCabecera(c);
    if (!norm) return;
    if (["CEDULA", "IDENTIFICACION", "ID", "DOCUMENTO"].includes(norm)) {
      if (mapa.cedula === undefined) mapa.cedula = index;
    } else if (["NOMBRES", "NOMBRE"].includes(norm)) {
      if (mapa.nombres === undefined) mapa.nombres = index;
    } else if (["APELLIDO1", "PRIMERAPELLIDO", "1ERAPELLIDO", "APELLIDOPATERNO"].includes(norm)) {
      if (mapa.apellido1 === undefined) mapa.apellido1 = index;
    } else if (["APELLIDO2", "SEGUNDOAPELLIDO", "2DOAPELLIDO", "APELLIDOMATERNO"].includes(norm)) {
      if (mapa.apellido2 === undefined) mapa.apellido2 = index;
    } else if (["NOMBRECOMPLETO", "ESTUDIANTE", "NOMBRESYAPELLIDOS", "NOMBREAPELLIDOS"].includes(norm)) {
      if (mapa.nombreCompleto === undefined) mapa.nombreCompleto = index;
    } else if (["CORREOINSTITUCIONAL", "CORREO", "EMAIL", "EMAILINSTITUCIONAL"].includes(norm)) {
      if (mapa.correoInstitucional === undefined) mapa.correoInstitucional = index;
    } else if (["TELEFONO", "TEL", "CELULAR", "MOVIL"].includes(norm)) {
      if (mapa.telefono === undefined) mapa.telefono = index;
    } else if (["PERIODOINGRESO", "PERIODO", "INGRESO", "CICLOINGRESO", "CODIGOPERIODO"].includes(norm)) {
      if (mapa.periodoIngreso === undefined) mapa.periodoIngreso = index;
    }
  });
  return mapa;
}

function mapearIndicesAprobados(cabeceras) {
  const mapa = {};
  cabeceras.forEach((c, index) => {
    const norm = normalizarCabecera(c);
    if (!norm) return;
    if (["CEDULA", "IDENTIFICACION", "ID", "DOCUMENTO"].includes(norm)) {
      if (mapa.cedula === undefined) mapa.cedula = index;
    } else if (["ASIGNATURA", "CURSO", "CODIGO", "MATERIA", "SIGLA"].includes(norm)) {
      if (mapa.asignatura === undefined) mapa.asignatura = index;
    }
  });
  return mapa;
}

function parsearFilaEstudiante(filaValores, mapa, filaNumero) {
  let cedula = mapa.cedula !== undefined ? texto(filaValores[mapa.cedula]) : "";
  let nombres = mapa.nombres !== undefined ? texto(filaValores[mapa.nombres]) : "";
  let apellido1 = mapa.apellido1 !== undefined ? texto(filaValores[mapa.apellido1]) : "";
  let apellido2 = mapa.apellido2 !== undefined ? texto(filaValores[mapa.apellido2]) : null;

  if ((!nombres || !apellido1) && mapa.nombreCompleto !== undefined) {
    const desglose = desglosarNombreCompleto(texto(filaValores[mapa.nombreCompleto]));
    if (!nombres) nombres = desglose.nombres;
    if (!apellido1) apellido1 = desglose.apellido1;
    if (!apellido2) apellido2 = desglose.apellido2;
  }

  const correoInstitucional =
    mapa.correoInstitucional !== undefined
      ? texto(filaValores[mapa.correoInstitucional]).toLowerCase()
      : "";
  const telefono =
    mapa.telefono !== undefined ? texto(filaValores[mapa.telefono]) || null : null;
  const periodoIngresoCodigo =
    mapa.periodoIngreso !== undefined
      ? normalizarCodigo(texto(filaValores[mapa.periodoIngreso]))
      : "";

  return {
    fila: filaNumero,
    cedula,
    nombres,
    apellido1,
    apellido2: apellido2 || null,
    correoInstitucional,
    telefono,
    periodoIngresoCodigo,
  };
}

async function leerCsvEstudiantes(filePath) {
  const contenido = await fs.readFile(filePath, "utf8");
  const lineas = contenido.split(/\r?\n/).filter((linea) => linea.trim().length > 0);
  if (!lineas.length) throw new Error("El archivo CSV está vacío.");

  const primera = lineas[0];
  const separador = primera.includes(";") ? ";" : primera.includes("\t") ? "\t" : ",";

  const cabeceras = lineas[0].split(separador).map(texto);
  const mapa = mapearIndicesEstudiantes(cabeceras);
  if (mapa.cedula === undefined) {
    throw new Error("El archivo CSV debe contener una columna para la cédula o identificación.");
  }

  const estudiantes = [];
  for (let i = 1; i < lineas.length; i++) {
    const valores = lineas[i].split(separador).map(texto);
    if (valores.some(Boolean)) {
      const parsed = parsearFilaEstudiante(valores, mapa, i + 1);
      parsed.asignaturasAprobadas = [];
      estudiantes.push(parsed);
    }
  }

  return { estudiantes };
}

export async function leerArchivoEstudiantesExcel(filePath) {
  if (filePath.toLowerCase().endsWith(".csv")) {
    return leerCsvEstudiantes(filePath);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // 1. Hoja de estudiantes
  let hojaEstudiantes = workbook.getWorksheet("ESTUDIANTES");
  if (!hojaEstudiantes) {
    hojaEstudiantes = workbook.worksheets.find((h) =>
      normalizarCabecera(h.name).includes("ESTUDIANTE") || normalizarCabecera(h.name).includes("ALUMNO")
    ) || workbook.worksheets[0];
  }
  if (!hojaEstudiantes) {
    throw new Error("El archivo no contiene ninguna hoja con datos de estudiantes.");
  }

  const cabecerasEstudiantes = [];
  hojaEstudiantes.getRow(1).eachCell({ includeEmpty: true }, (celda) => {
    cabecerasEstudiantes.push(texto(celda));
  });

  const mapaEst = mapearIndicesEstudiantes(cabecerasEstudiantes);
  if (mapaEst.cedula === undefined) {
    // Si no coincide flexiblemente, intentar por orden posicional estándar
    cabecerasEstudiantes.forEach((c, idx) => {
      if (idx === 0) mapaEst.cedula = 0;
      if (idx === 1) mapaEst.nombres = 1;
      if (idx === 2) mapaEst.apellido1 = 2;
      if (idx === 3) mapaEst.apellido2 = 3;
      if (idx === 4) mapaEst.correoInstitucional = 4;
      if (idx === 5) mapaEst.telefono = 5;
      if (idx === 6) mapaEst.periodoIngreso = 6;
    });
  }

  const filasEstudiantes = [];
  hojaEstudiantes.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;
    const valores = [];
    row.eachCell({ includeEmpty: true }, (celda, colNumero) => {
      valores[colNumero - 1] = texto(celda);
    });
    if (valores.some(Boolean)) {
      filasEstudiantes.push(parsearFilaEstudiante(valores, mapaEst, numero));
    }
  });

  // 2. Hoja de aprobados
  let hojaAprobados = workbook.getWorksheet("APROBADOS");
  if (!hojaAprobados) {
    hojaAprobados = workbook.worksheets.find((h) => {
      const n = normalizarCabecera(h.name);
      return n.includes("APROBAD") || n.includes("NOTA") || n.includes("MATERIA") || n.includes("ASIGNATURA") || n.includes("HISTORIAL");
    });
  }

  const aprobaciones = new Map();
  if (hojaAprobados) {
    const cabecerasAprobados = [];
    hojaAprobados.getRow(1).eachCell({ includeEmpty: true }, (celda) => {
      cabecerasAprobados.push(texto(celda));
    });
    const mapaApr = mapearIndicesAprobados(cabecerasAprobados);
    const idxCed = mapaApr.cedula !== undefined ? mapaApr.cedula : 0;
    const idxAsig = mapaApr.asignatura !== undefined ? mapaApr.asignatura : 1;

    hojaAprobados.eachRow({ includeEmpty: false }, (row, numero) => {
      if (numero === 1) return;
      const valores = [];
      row.eachCell({ includeEmpty: true }, (celda, colNumero) => {
        valores[colNumero - 1] = texto(celda);
      });
      const cedula = texto(valores[idxCed]);
      const asignatura = normalizarCodigo(valores[idxAsig]);
      if (cedula && asignatura) {
        aprobaciones.set(cedula, [...(aprobaciones.get(cedula) ?? []), asignatura]);
      }
    });
  }

  const cedulas = new Set(filasEstudiantes.map((e) => e.cedula));
  const huerfana = [...aprobaciones.keys()].find((cedula) => !cedulas.has(cedula));
  if (huerfana) {
    throw new Error(
      `APROBADOS contiene la cédula ${huerfana}, pero no existe en la lista de estudiantes.`
    );
  }

  return {
    estudiantes: filasEstudiantes.map((est) => ({
      ...est,
      asignaturasAprobadas: aprobaciones.get(est.cedula) ?? [],
    })),
  };
}

function prepararHoja(workbook, nombre, cabeceras, anchos) {
  const hoja = workbook.addWorksheet(nombre);
  hoja.columns = cabeceras.map((header, indice) => ({
    header,
    key: header,
    width: anchos[indice],
    style: { numFmt: "@" },
  }));
  const cabecera = hoja.getRow(1);
  cabecera.height = 24;
  cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecera.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };
  cabecera.alignment = { vertical: "middle", horizontal: "center" };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: cabeceras.length },
  };
  return hoja;
}

export async function crearPlantillaExcelEstudiantes(destino) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SGPA";
  workbook.title = "Plantilla de importación de estudiantes";
  workbook.subject = "Estudiantes y asignaturas aprobadas";
  prepararHoja(
    workbook,
    "ESTUDIANTES",
    CABECERAS_ESTUDIANTES,
    [18, 28, 24, 24, 36, 20, 20],
  );
  prepararHoja(workbook, "APROBADOS", CABECERAS_APROBADOS, [18, 24]);
  await workbook.xlsx.writeFile(destino);
}
