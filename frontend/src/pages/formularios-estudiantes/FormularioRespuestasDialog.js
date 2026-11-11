/**
 * SGPA — Diálogo y gestión de respuestas recibidas en Formularios de Estudiantes.
 * FRONTEND-ORDER-003
 */

import {
  listarRespuestasFormularioEstudiantes,
  aceptarSolicitudFormulario,
  rechazarSolicitudFormulario,
} from '../../services/formularios-estudiantes.service.js';
import {
  mostrarError,
  mostrarAdvertencia,
  mostrarExito,
} from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import { escapeHtml, calcularLongitudTexto } from '../../utils/html.js';
import { DataTable } from '../../components/DataTable.js';
import { FormDialog, habilitarCierreExterior } from '../../components/FormDialog.js';
import { renderizarIconos } from '../../utils/icons.js';
import {
  extraerResultadoFormularioServicio,
  obtenerResumenRespuestaEstudiante,
} from './formularios-estudiantes.helpers.js';

let generacionDialogoRespuestas = 0;

function dialogoRespuestasVigente(generacion) {
  const dialog = document.getElementById('formularioEstudianteDialog');
  return generacion === generacionDialogoRespuestas && Boolean(dialog?.open);
}

export function renderizarFilaRespuesta(respuesta) {
  const resumen = obtenerResumenRespuestaEstudiante(respuesta);

  const aprobadasHtml =
    resumen.aprobadas > 0
      ? `<span title="${escapeHtml(resumen.codigos)}" style="cursor:help;"><strong>${resumen.aprobadas}</strong> asignaturas<small style="display:block;color:var(--text-muted);font-size:0.75rem;">${escapeHtml(resumen.codigos)}</small></span>`
      : `<span class="text-muted">0 asignaturas</span>`;

  const accionesHtml = resumen.esPendiente
    ? `
      <div class="sgpa-table-actions" style="display:inline-flex;gap:4px;">
        <button
          type="button"
          class="btn btn-sm btn-primary btn-accion-aprobar-resp"
          data-id="${respuesta.id}"
          data-estudiante="${escapeHtml(resumen.nombre)}"
          title="Aprobar solicitud e incorporar materias"
        >
          <i data-lucide="check" aria-hidden="true"></i>
          Aprobar
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-danger btn-accion-rechazar-resp"
          data-id="${respuesta.id}"
          data-estudiante="${escapeHtml(resumen.nombre)}"
          title="Rechazar solicitud con motivo"
        >
          <i data-lucide="x" aria-hidden="true"></i>
          Rechazar
        </button>
      </div>
    `
    : `<span class="text-muted">—</span>`;

  return `
    <tr>
      <td>${escapeHtml(resumen.nombre)}</td>
      <td>${escapeHtml(resumen.identificacion)}</td>
      <td>${escapeHtml(resumen.correo)}</td>
      <td>${aprobadasHtml}</td>
      <td>${escapeHtml(respuesta.estado || '—')}</td>
      <td>${escapeHtml(resumen.fechaProcesado)}</td>
      <td>${escapeHtml(resumen.detalle)}</td>
      <td>${accionesHtml}</td>
    </tr>
  `;
}

async function recargarRespuestasFormulario(formulario, generacion) {
  if (!formulario?.id) return;
  try {
    const res = await listarRespuestasFormularioEstudiantes(formulario.id);
    if (!dialogoRespuestasVigente(generacion)) return;
    const data = extraerResultadoFormularioServicio(
      res,
      'No fue posible actualizar las respuestas.',
    );
    if (!Array.isArray(data)) {
      throw new Error('El servicio devolvió una lista de respuestas inválida.');
    }
    renderizarRespuestasFormulario(data, formulario, generacion);
  } catch (error) {
    if (!dialogoRespuestasVigente(generacion)) return;
    mostrarError({
      titulo: 'No fue posible actualizar las respuestas',
      mensaje: error?.message || 'Ocurrió un error al actualizar la bandeja.',
    });
  }
}

export function renderizarRespuestasFormulario(
  respuestas = [],
  formulario = null,
  generacion = generacionDialogoRespuestas,
) {
  if (generacion !== generacionDialogoRespuestas) return;
  const contenedor = document.getElementById('respuestasFormularioContent');
  if (!contenedor) {
    return;
  }

  const rows = respuestas.map((r) => renderizarFilaRespuesta(r)).join('');

  contenedor.innerHTML = DataTable({
    columns: [
      'Estudiante',
      'Identificación',
      'Correo',
      'Aprobadas',
      'Estado',
      'Procesada',
      'Detalle',
      'Acciones',
    ],
    rows,
    emptyMessage: 'Este formulario todavía no tiene respuestas registradas.',
    ariaLabel: 'Respuestas del formulario',
  });

  renderizarIconos();

  contenedor.querySelectorAll('.btn-accion-aprobar-resp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!dialogoRespuestasVigente(generacion)) return;
      const respuestaId = Number(btn.getAttribute('data-id'));
      const nombreEstudiante =
        btn.getAttribute('data-estudiante') || 'el estudiante';

      const confirmado = await confirmarAccion({
        titulo: 'Aprobar respuesta',
        mensaje: `¿Desea aprobar la solicitud de ${nombreEstudiante} e incorporar sus materias aprobadas al expediente?`,
        textoConfirmar: 'Aprobar respuesta',
        peligro: false,
      });

      if (!confirmado || !dialogoRespuestasVigente(generacion)) return;

      const fila = btn.closest('tr');
      if (fila) {
        fila.querySelectorAll('button').forEach((b) => (b.disabled = true));
      }

      try {
        const resultado = await aceptarSolicitudFormulario(respuestaId);
        extraerResultadoFormularioServicio(
          resultado,
          'No fue posible aprobar la solicitud.',
        );
        if (!dialogoRespuestasVigente(generacion)) return;

        mostrarExito({
          titulo: 'Solicitud aprobada',
          mensaje:
            'La respuesta fue procesada correctamente y registrada en el historial académico.',
        });

        await recargarRespuestasFormulario(formulario, generacion);
      } catch (error) {
        if (!dialogoRespuestasVigente(generacion)) return;
        mostrarError({
          titulo: 'No fue posible aprobar la respuesta',
          mensaje:
            error?.message ||
            'La respuesta requiere revisión antes de poder incorporarse.',
        });
        if (formulario?.id) {
          await recargarRespuestasFormulario(formulario, generacion);
        } else if (fila) {
          fila.querySelectorAll('button').forEach((b) => (b.disabled = false));
        }
      }
    });
  });

  contenedor.querySelectorAll('.btn-accion-rechazar-resp').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!dialogoRespuestasVigente(generacion)) return;
      const respuestaId = Number(btn.getAttribute('data-id'));
      const nombreEstudiante =
        btn.getAttribute('data-estudiante') || 'el estudiante';

      const motivo = window.prompt(
        `Ingrese el motivo del rechazo para la respuesta de ${nombreEstudiante} (obligatorio, máximo 500 caracteres):`,
      );
      if (motivo === null || !dialogoRespuestasVigente(generacion)) return;
      const motivoLimpio = motivo.trim();
      if (!motivoLimpio) {
        mostrarAdvertencia({
          titulo: 'Motivo obligatorio',
          mensaje:
            'El motivo de rechazo es obligatorio y no puede consistir únicamente en espacios en blanco.',
        });
        return;
      }
      const longitudMotivo = calcularLongitudTexto(motivoLimpio);
      if (longitudMotivo > 500) {
        mostrarAdvertencia({
          titulo: 'Límite de caracteres excedido',
          mensaje: `El motivo de rechazo no puede superar los 500 caracteres (longitud ingresada: ${longitudMotivo}).`,
        });
        return;
      }

      const fila = btn.closest('tr');
      if (fila) {
        fila.querySelectorAll('button').forEach((b) => (b.disabled = true));
      }

      try {
        const resultado = await rechazarSolicitudFormulario(
          respuestaId,
          motivoLimpio,
        );
        extraerResultadoFormularioServicio(
          resultado,
          'No fue posible rechazar la solicitud.',
        );
        if (!dialogoRespuestasVigente(generacion)) return;

        mostrarExito({
          titulo: 'Solicitud rechazada',
          mensaje: 'La respuesta fue rechazada.',
        });

        await recargarRespuestasFormulario(formulario, generacion);
      } catch (error) {
        if (!dialogoRespuestasVigente(generacion)) return;
        mostrarError({
          titulo: 'No fue posible rechazar la respuesta',
          mensaje:
            error?.message || 'Ocurrió un error al rechazar la respuesta.',
        });
        if (fila) {
          fila.querySelectorAll('button').forEach((b) => (b.disabled = false));
        }
      }
    });
  });
}

export async function abrirDialogoRespuestasFormulario(formulario) {
  const generacion = ++generacionDialogoRespuestas;
  const dialog = document.getElementById('formularioEstudianteDialog');
  const content = document.getElementById('formularioEstudianteDialogContent');

  if (!dialog || !content) {
    return;
  }

  content.innerHTML = FormDialog({
    formId: 'respuestasFormularioEstudianteForm',
    title: 'Respuestas del formulario',
    description: formulario.titulo,
    body: `
      <div id="respuestasFormularioContent">
        <div class="sgpa-table-empty" role="status">
          <strong>Cargando respuestas...</strong>
        </div>
      </div>
    `,
    cancelButtonId: 'cerrarRespuestasFormularioButton',
    cancelText: 'Cerrar',
    showFooter: true,
    layout: 'custom',
  });

  renderizarIconos();
  dialog.showModal();
  habilitarCierreExterior(dialog);

  document
    .getElementById('cerrarRespuestasFormularioButton')
    ?.addEventListener('click', () => {
      if (generacion === generacionDialogoRespuestas) {
        generacionDialogoRespuestas += 1;
      }
      dialog.close();
    });

  const invalidarAlCerrar = () => {
    if (generacion === generacionDialogoRespuestas) {
      generacionDialogoRespuestas += 1;
    }
  };
  dialog.addEventListener('cancel', invalidarAlCerrar, { once: true });
  dialog.addEventListener('close', invalidarAlCerrar, { once: true });

  try {
    const res = await listarRespuestasFormularioEstudiantes(formulario.id);
    if (!dialogoRespuestasVigente(generacion)) return;
    const data = extraerResultadoFormularioServicio(
      res,
      'No fue posible cargar las respuestas.',
    );
    const respuestas = Array.isArray(data) ? data : [];
    renderizarRespuestasFormulario(respuestas, formulario, generacion);
  } catch (error) {
    if (!dialogoRespuestasVigente(generacion)) return;
    if (generacion === generacionDialogoRespuestas) {
      generacionDialogoRespuestas += 1;
    }
    dialog.close();
    mostrarError({
      titulo: 'No fue posible cargar las respuestas',
      mensaje:
        error?.message ||
        'Ocurrió un error al consultar la bandeja de respuestas.',
    });
  }
}
