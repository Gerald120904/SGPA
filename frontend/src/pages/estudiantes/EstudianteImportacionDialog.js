/**
 * SGPA — Diálogo modal para la importación masiva de estudiantes desde Excel.
 * FRONTEND-REF-DEEP-002
 */

import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml } from '../../utils/html.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  guardarPlantillaExcelEstudiantes,
  seleccionarExcelEstudiantes,
  validarImportacionEstudiantes,
  ejecutarImportacionEstudiantes,
} from '../../services/estudiantes-importacion.service.js';
import {
  proponerImportacionEstudiantes,
} from '../../services/solicitudes-cambio.service.js';
import {
  obtenerResumenImportacion,
  obtenerDetalleFilaImportacion,
  extraerDataResultado,
} from './estudiantes.helpers.js';

export function renderizarPreviewImportacionEstudiantes(
  preview,
  contexto,
  {
    esAsistente = false,
    onImportado = null,
    onCerrar = null,
  } = {},
) {
  const contenedor = document.getElementById('previewImportacionEstudiantes');
  if (!contenedor) {
    return;
  }

  const resumen = obtenerResumenImportacion(preview);
  const filas = Array.isArray(preview?.filas) ? preview.filas : [];

  const tablaResumen = DataTable({
    columns: ['Total', 'Crear', 'Actualizar', 'Sin cambios', 'Errores'],
    rows: `
      <tr>
        <td>${resumen.total}</td>
        <td>${resumen.creados}</td>
        <td>${resumen.actualizados}</td>
        <td>${resumen.sinCambios}</td>
        <td>${resumen.errores}</td>
      </tr>
    `,
    emptyMessage: 'No existe información de previsualización.',
    ariaLabel: 'Resumen de importación de estudiantes',
  });

  const filasTabla = filas
    .map((fila, index) => {
      const estudiante = fila.estudiante ?? fila.datos ?? fila;
      const nombre = [
        estudiante.nombres,
        estudiante.apellido1,
        estudiante.apellido2,
      ]
        .filter(Boolean)
        .join(' ');

      return `
        <tr>
          <td>${escapeHtml(String(fila.fila ?? index + 1))}</td>
          <td>${escapeHtml(estudiante.cedula || '—')}</td>
          <td>${escapeHtml(nombre || '—')}</td>
          <td>${escapeHtml(estudiante.correoInstitucional || '—')}</td>
          <td>${escapeHtml(fila.accion || '—')}</td>
          <td>${escapeHtml(obtenerDetalleFilaImportacion(fila))}</td>
        </tr>
      `;
    })
    .join('');

  const tablaFilas = DataTable({
    columns: ['Fila', 'Cédula', 'Estudiante', 'Correo', 'Acción', 'Detalle'],
    rows: filasTabla,
    emptyMessage: 'El archivo no contiene filas para importar.',
    ariaLabel: 'Previsualización de estudiantes',
  });

  const tieneErrores = resumen.errores > 0;
  const tieneCambios = resumen.creados > 0 || resumen.actualizados > 0;

  contenedor.innerHTML = `
    <h3>Resumen de importación</h3>
    ${tablaResumen}

    <h3>Detalle</h3>
    ${tablaFilas}

    ${
      tieneErrores
        ? `
      <p class="sgpa-field-help">
        ${resumen.errores} fila${
            resumen.errores === 1 ? '' : 's'
          } contiene${
            resumen.errores === 1 ? '' : 'n'
          } errores y será${
            resumen.errores === 1 ? '' : 's'
          } omitida${
            resumen.errores === 1 ? '' : 's'
          }. Las filas válidas sí pueden importarse.
      </p>
    `
        : ''
    }

    <div class="sgpa-inline-actions">
      <button
        id="ejecutarImportacionEstudiantesButton"
        type="button"
        class="sgpa-form-primary"
        ${!tieneCambios ? 'disabled' : ''}
      >
        <i data-lucide="database" aria-hidden="true"></i>
        Ejecutar importación
      </button>
    </div>
  `;

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    renderizarIconos();
  }

  document
    .getElementById('ejecutarImportacionEstudiantesButton')
    ?.addEventListener('click', async () => {
      const confirmado = await confirmarAccion({
        titulo: 'Confirmar importación',
        mensaje:
          `Se crearán ${resumen.creados} estudiantes, ` +
          `se actualizarán ${resumen.actualizados} y ` +
          `${resumen.sinCambios} se conservarán sin cambios.` +
          (resumen.errores > 0
            ? ` ${resumen.errores} fila(s) con errores serán omitidas.`
            : ''),
        textoConfirmar: 'Importar estudiantes',
        peligro: false,
      });

      if (!confirmado) {
        return;
      }

      const button = document.getElementById('ejecutarImportacionEstudiantesButton');
      if (button) {
        button.disabled = true;
      }

      try {
        const resultado = esAsistente
          ? await proponerImportacionEstudiantes({
              carreraId: contexto.carreraId,
              planEstudioId: contexto.planEstudioId,
              estudiantes: contexto.datosExcel,
            })
          : await ejecutarImportacionEstudiantes(
              {
                carreraId: contexto.carreraId,
                planEstudioId: contexto.planEstudioId,
              },
              contexto.datosExcel,
            );

        if (resultado?.ok === false) {
          throw new Error(
            resultado?.message || 'No fue posible completar la importación.',
          );
        }

        const dialog = document.getElementById('estudianteDialog');
        dialog?.close();

        if (esAsistente) {
          mostrarExito({
            titulo: 'Solicitud enviada',
            mensaje:
              'La propuesta de importación masiva de estudiantes fue enviada a su coordinador para revisión y aplicación.',
          });
        } else {
          const totalRegistros =
            resultado.data?.totalFilas ||
            resultado.totalFilas ||
            (resultado.data?.resumen
              ? resultado.data.resumen.creados + resultado.data.resumen.actualizados
              : 0);

          mostrarExito({
            titulo: 'Lote registrado en Bandeja de Revisión',
            mensaje:
              `El lote con ${totalRegistros} registro(s) fue registrado en estado PENDIENTE en la bandeja de revisión y staging. Debe ser aprobado por el coordinador antes de impactar el padrón oficial.`,
          });

          if (typeof onImportado === 'function') {
            await onImportado(contexto);
          }
        }
      } catch (error) {
        mostrarError({
          titulo: 'No fue posible importar los estudiantes',
          mensaje: error?.message || 'La importación no pudo completarse.',
        });

        if (button) {
          button.disabled = false;
        }
      }
    });
}

export async function abrirImportacionEstudiantes({
  carrera,
  plan,
  esAsistente = false,
  configurarTamanoDialog = null,
  onImportado = null,
} = {}) {
  if (!carrera || !plan) {
    mostrarError({
      titulo: 'Seleccione un plan',
      mensaje:
        'Debe seleccionar una carrera y un plan de estudio antes de importar estudiantes.',
    });
    return;
  }

  const dialog = document.getElementById('estudianteDialog');
  const content = document.getElementById('estudianteDialogContent');

  if (!dialog || !content) {
    return;
  }

  try {
    let datosExcel = null;
    let nombreArchivo = null;
    let previewActual = null;

    content.innerHTML = FormDialog({
      formId: 'importarEstudiantesExcelForm',
      title: 'Importar estudiantes desde Excel',
      description:
        'Cargue el archivo Excel con los estudiantes del plan y revise la previsualización antes de importar.',
      layout: 'custom',
      cancelButtonId: 'cancelarImportacionEstudiantes',
      cancelText: 'Cerrar',
      showFooter: true,
      body: `
        <div class="sgpa-form-wide sgpa-form-summary-grid">
          <label>
            <span>Carrera</span>
            <input
              type="text"
              value="${escapeHtml(carrera.nombre)}"
              readonly
            >
          </label>

          <label>
            <span>Plan de estudio</span>
            <input
              type="text"
              value="${escapeHtml(
                `${plan.codigo} - ${plan.nombre}`,
              )}"
              readonly
            >
          </label>
        </div>

        <div class="sgpa-form-wide sgpa-upload-actions">
          <button
            id="descargarPlantillaEstudiantesButton"
            type="button"
            class="sgpa-form-secondary"
          >
            <i data-lucide="download" aria-hidden="true"></i>
            Descargar plantilla
          </button>

          <button
            id="seleccionarExcelEstudiantesButton"
            type="button"
            class="sgpa-form-secondary"
          >
            <i data-lucide="file-up" aria-hidden="true"></i>
            Seleccionar archivo Excel
          </button>

          <span
            id="archivoEstudiantesSeleccionado"
            class="sgpa-field-help"
          >
            Ningún archivo seleccionado.
          </span>
        </div>

        <div class="sgpa-form-wide">
          <button
            id="previsualizarImportacionEstudiantesButton"
            type="button"
            class="sgpa-form-primary"
            disabled
          >
            <i data-lucide="scan-search" aria-hidden="true"></i>
            Previsualizar importación
          </button>
        </div>

        <div
          id="previewImportacionEstudiantes"
          class="sgpa-form-wide"
        ></div>
      `,
    });

    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
      renderizarIconos();
    }

    if (typeof configurarTamanoDialog === 'function') {
      configurarTamanoDialog(dialog, 'lg');
    }

    dialog.showModal();
    habilitarCierreExterior(dialog);

    const previewButton = document.getElementById(
      'previsualizarImportacionEstudiantesButton',
    );
    const previewContainer = document.getElementById(
      'previewImportacionEstudiantes',
    );
    const archivoLabel = document.getElementById(
      'archivoEstudiantesSeleccionado',
    );

    const actualizarEstadoPreview = () => {
      if (!previewButton) return;
      previewButton.disabled = !datosExcel;
    };

    const limpiarPreview = () => {
      previewActual = null;
      if (previewContainer) {
        previewContainer.innerHTML = '';
      }
    };

    document
      .getElementById('descargarPlantillaEstudiantesButton')
      ?.addEventListener('click', async () => {
        try {
          const resultado = await guardarPlantillaExcelEstudiantes();
          if (resultado?.cancelado === true) return;
          if (resultado?.ok === false) {
            throw new Error(
              resultado?.message || 'No fue posible guardar la plantilla.',
            );
          }
          mostrarExito({
            titulo: 'Plantilla guardada',
            mensaje: 'La plantilla de estudiantes fue generada correctamente.',
          });
        } catch (error) {
          mostrarError({
            titulo: 'No fue posible guardar la plantilla',
            mensaje: error?.message || 'Ocurrió un error al generar el archivo Excel.',
          });
        }
      });

    document
      .getElementById('seleccionarExcelEstudiantesButton')
      ?.addEventListener('click', async () => {
        try {
          const resultado = await seleccionarExcelEstudiantes();
          if (!resultado || resultado.cancelado === true) return;
          if (resultado.ok === false) {
            throw new Error(
              resultado.message || 'No fue posible leer el archivo Excel.',
            );
          }

          datosExcel = resultado.datos;
          nombreArchivo =
            resultado.nombreArchivo ||
            resultado.nombre ||
            resultado.archivo ||
            'Archivo Excel';

          if (!datosExcel) {
            throw new Error(
              'El archivo seleccionado no produjo datos válidos.',
            );
          }

          if (archivoLabel) {
            archivoLabel.textContent = nombreArchivo;
          }

          limpiarPreview();
          actualizarEstadoPreview();
        } catch (error) {
          datosExcel = null;
          nombreArchivo = null;
          actualizarEstadoPreview();
          mostrarError({
            titulo: 'No fue posible cargar el Excel',
            mensaje: error?.message || 'Revise el archivo seleccionado.',
          });
        }
      });

    previewButton?.addEventListener('click', async () => {
      const contexto = {
        carreraId: carrera.id,
        planEstudioId: plan.id,
      };

      if (!datosExcel) return;
      previewButton.disabled = true;

      try {
        const resultado = await validarImportacionEstudiantes(
          contexto,
          datosExcel,
        );

        if (resultado?.ok === false) {
          throw new Error(
            resultado?.message || 'La importación no pudo validarse.',
          );
        }

        previewActual = extraerDataResultado(resultado);

        renderizarPreviewImportacionEstudiantes(
          previewActual,
          {
            carreraId: contexto.carreraId,
            planEstudioId: contexto.planEstudioId,
            datosExcel,
          },
          {
            esAsistente,
            onImportado,
            onCerrar: () => dialog.close(),
          },
        );
      } catch (error) {
        previewActual = null;
        if (previewContainer) {
          previewContainer.innerHTML = '';
        }
        mostrarError({
          titulo: 'No fue posible previsualizar la importación',
          mensaje: error?.message || 'Revise el archivo y los datos seleccionados.',
        });
      } finally {
        actualizarEstadoPreview();
      }
    });

    document
      .getElementById('cancelarImportacionEstudiantes')
      ?.addEventListener('click', () => dialog.close());
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible preparar la importación',
      mensaje: error?.message || 'Ocurrió un error al preparar la importación.',
    });
  }
}
