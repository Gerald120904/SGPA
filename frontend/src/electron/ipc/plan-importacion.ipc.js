import { dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import {
  crearPlantillaExcelPlan,
  leerArchivoPlanExcel,
} from "../excel/plan-excel.js";

export function registrarPlanImportacionIpc({
  ejecutarPeticionAutenticada,
}) {
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
}

