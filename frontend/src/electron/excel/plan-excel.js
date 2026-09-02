import ExcelJS from "exceljs";

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

export async function leerArchivoPlanExcel(filePath) {
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
      type: tipo,
      operator: "greaterThanOrEqual",
      formulae: [minimo],
      allowBlank: permitirVacio,
    };
  }
}

export async function crearPlantillaExcelPlan(destino) {
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
