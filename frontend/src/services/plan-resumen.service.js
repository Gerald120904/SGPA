export async function obtenerResumenPlan(planId) {
  if (!window.sgpa || typeof window.sgpa.obtenerResumenPlan !== "function") {
    throw new Error("La API del resumen del plan no está disponible.");
  }

  return window.sgpa.obtenerResumenPlan(planId);
}
