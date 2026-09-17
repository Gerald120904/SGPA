import ExcelJS from "exceljs";

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
  return String(celda?.text ?? "").trim();
}

function normalizarCodigo(valor) {
  return String(valor ?? "")
    .trim()
    .toUpperCase();
}

function leerHoja(workbook, nombre, cabecerasEsperadas) {
  const hoja = workbook.getWorksheet(nombre);
  if (!hoja) throw new Error(`El archivo no contiene la hoja "${nombre}".`);
  const cabeceras = cabecerasEsperadas.map((_item, indice) =>
    normalizarCodigo(texto(hoja.getRow(1).getCell(indice + 1))),
  );
  if (cabeceras.join("|") !== cabecerasEsperadas.join("|")) {
    throw new Error(
      `La hoja "${nombre}" debe usar, en orden, las columnas: ${cabecerasEsperadas.join(", ")}.`,
    );
  }
  const filas = [];
  hoja.eachRow({ includeEmpty: false }, (row, numero) => {
    if (numero === 1) return;
    const valores = cabecerasEsperadas.map((_item, indice) =>
      texto(row.getCell(indice + 1)),
    );
    if (valores.some(Boolean)) filas.push({ fila: numero, valores });
  });
  return filas;
}

export async function leerArchivoEstudiantesExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const filasEstudiantes = leerHoja(
    workbook,
    "ESTUDIANTES",
    CABECERAS_ESTUDIANTES,
  );
  const filasAprobados = leerHoja(workbook, "APROBADOS", CABECERAS_APROBADOS);
  const aprobaciones = new Map();
  for (const { fila, valores } of filasAprobados) {
    const cedula = valores[0].trim();
    const asignatura = normalizarCodigo(valores[1]);
    if (!cedula || !asignatura) {
      throw new Error(
        `La fila ${fila} de APROBADOS requiere CEDULA y ASIGNATURA.`,
      );
    }
    aprobaciones.set(cedula, [...(aprobaciones.get(cedula) ?? []), asignatura]);
  }
  const cedulas = new Set(
    filasEstudiantes.map(({ valores }) => valores[0].trim()),
  );
  const huerfana = [...aprobaciones.keys()].find(
    (cedula) => !cedulas.has(cedula),
  );
  if (huerfana) {
    throw new Error(
      `APROBADOS contiene la cédula ${huerfana}, pero no existe en ESTUDIANTES.`,
    );
  }
  return {
    estudiantes: filasEstudiantes.map(({ fila, valores }) => ({
      fila,
      cedula: valores[0].trim(),
      nombres: valores[1].trim(),
      apellido1: valores[2].trim(),
      apellido2: valores[3].trim() || null,
      correoInstitucional: valores[4].trim().toLowerCase(),
      telefono: valores[5].trim() || null,
      periodoIngresoCodigo: normalizarCodigo(valores[6]),
      asignaturasAprobadas: aprobaciones.get(valores[0].trim()) ?? [],
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
