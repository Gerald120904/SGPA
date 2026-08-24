export async function seleccionarExcelPlan() {
  if (!window.sgpa || typeof window.sgpa.seleccionarExcelPlan !== "function") {
    throw new Error("La API para importar Excel no está disponible.");
  }

  return window.sgpa.seleccionarExcelPlan();
}

export async function validarImportacionPlan(planId, datos) {
  if (
    !window.sgpa ||
    typeof window.sgpa.validarImportacionPlan !== "function"
  ) {
    throw new Error("La API de validación de importación no está disponible.");
  }

  return window.sgpa.validarImportacionPlan(planId, datos);
}

export async function ejecutarImportacionPlanCompleta(planId, datos) {
  if (
    !window.sgpa ||
    typeof window.sgpa.ejecutarImportacionPlan !== "function"
  ) {
    throw new Error("La API para ejecutar la importación no está disponible.");
  }

  return window.sgpa.ejecutarImportacionPlan(planId, datos);
}

export async function guardarPlantillaExcelPlan() {
  if (
    !window.sgpa ||
    typeof window.sgpa.guardarPlantillaExcelPlan !== "function"
  ) {
    throw new Error(
      "La API para generar la plantilla Excel no está disponible.",
    );
  }

  return window.sgpa.guardarPlantillaExcelPlan();
}
