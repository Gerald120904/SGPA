function exigirApi(nombre) {
  if (!window.sgpa || typeof window.sgpa[nombre] !== "function") {
    throw new Error("La API de importación de estudiantes no está disponible.");
  }
  return window.sgpa[nombre];
}

export function seleccionarExcelEstudiantes() {
  return exigirApi("seleccionarExcelEstudiantes")();
}

export function guardarPlantillaExcelEstudiantes() {
  return exigirApi("guardarPlantillaExcelEstudiantes")();
}

export function validarImportacionEstudiantes(contexto, datos) {
  return exigirApi("validarImportacionEstudiantes")(contexto, datos);
}

export function ejecutarImportacionEstudiantes(contexto, datos) {
  return exigirApi("ejecutarImportacionEstudiantes")(contexto, datos);
}
