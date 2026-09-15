import { dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import {
  crearPlantillaExcelEstudiantes,
  leerArchivoEstudiantesExcel,
} from "../excel/estudiantes-excel.js";

const MAXIMO_EXCEL = 5 * 1024 * 1024;

export function registrarEstudiantesImportacionIpc({
  ejecutarPeticionAutenticada,
}) {
  ipcMain.handle("estudiantes-importacion:seleccionar-excel", async () => {
    try {
      const resultado = await dialog.showOpenDialog({
        title: "Seleccionar estudiantes",
        properties: ["openFile"],
        filters: [{ name: "Archivo Excel", extensions: ["xlsx"] }],
      });
      if (resultado.canceled || !resultado.filePaths.length)
        return { ok: false, cancelado: true };
      const filePath = resultado.filePaths[0];
      if ((await fs.stat(filePath)).size > MAXIMO_EXCEL) {
        return {
          ok: false,
          message: "El archivo Excel supera el límite de 5 MB.",
        };
      }
      return {
        ok: true,
        archivo: path.basename(filePath),
        datos: await leerArchivoEstudiantesExcel(filePath),
      };
    } catch (error) {
      console.error("Error leyendo Excel de estudiantes:", error);
      return {
        ok: false,
        message: error?.message || "No fue posible leer el archivo Excel.",
      };
    }
  });

  ipcMain.handle("estudiantes-importacion:guardar-plantilla", async () => {
    try {
      const resultado = await dialog.showSaveDialog({
        title: "Guardar plantilla de estudiantes SGPA",
        defaultPath: "Plantilla_Estudiantes_SGPA.xlsx",
        filters: [{ name: "Archivo Excel", extensions: ["xlsx"] }],
      });
      if (resultado.canceled || !resultado.filePath)
        return { ok: false, cancelado: true };
      const destino = resultado.filePath.toLowerCase().endsWith(".xlsx")
        ? resultado.filePath
        : `${resultado.filePath}.xlsx`;
      await crearPlantillaExcelEstudiantes(destino);
      return { ok: true, archivo: path.basename(destino) };
    } catch (error) {
      console.error("Error creando plantilla de estudiantes:", error);
      return {
        ok: false,
        message: error?.message || "No fue posible crear la plantilla Excel.",
      };
    }
  });

  for (const accion of ["validar", "ejecutar"]) {
    ipcMain.handle(
      `estudiantes-importacion:${accion}`,
      async (_event, contexto, datos) => {
        const resultado = await ejecutarPeticionAutenticada(
          `/estudiantes/importacion/excel/${accion}`,
          { method: "POST", body: { ...contexto, ...datos } },
        );
        if (!resultado.ok) return resultado;
        return {
          ok: true,
          [accion === "validar" ? "validacion" : "importacion"]: resultado.data,
        };
      },
    );
  }
}
