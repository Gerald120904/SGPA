export async function validarPlanEstudio(planId) {
  if (!window.sgpa || typeof window.sgpa.validarPlanEstudio !== "function") {
    throw new Error("La API de validación del plan no está disponible.");
  }

  return window.sgpa.validarPlanEstudio(planId);
}
