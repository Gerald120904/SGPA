/**
 * SGPA — Coordinación de guardado, corrección excepcional y transiciones de estado de Períodos Académicos.
 * FRONTEND-ORDER-003
 */

import {
  actualizarPeriodoAcademico,
  cambiarEstadoPeriodoAcademico,
  crearPeriodoAcademico,
  corregirPeriodoCerrado,
} from '../../services/periodos.service.js';
import {
  mostrarError,
  mostrarExito,
  mostrarAdvertencia,
} from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import {
  TRANSICIONES_PERIODO,
  obtenerNombreEstadoPeriodo,
} from './periodos.helpers.js';

const cambiosEstadoPendientes = new Set();

export async function ejecutarGuardadoPeriodo({
  periodo,
  editando,
  excepcional,
  datos,
  guardarButton,
  cerrarDialogo,
  recargarPeriodos,
}) {
  if (guardarButton) {
    guardarButton.disabled = true;
  }

  try {
    const resultado = excepcional
      ? await corregirPeriodoCerrado(periodo.id, datos)
      : editando
        ? await actualizarPeriodoAcademico(periodo.id, datos)
        : await crearPeriodoAcademico(datos);

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible guardar el periodo.',
      );
    }

    cerrarDialogo();

    mostrarExito({
      titulo: editando ? 'Periodo actualizado' : 'Periodo creado',
      mensaje: editando
        ? 'El periodo académico fue actualizado correctamente.'
        : 'El nuevo periodo académico fue creado en estado borrador.',
    });

    await recargarPeriodos();
  } catch (error) {
    mostrarError({
      titulo: editando
        ? 'No se pudo actualizar el periodo'
        : 'No se pudo crear el periodo',
      mensaje:
        error?.message || 'No fue posible guardar el periodo académico.',
    });
  } finally {
    if (guardarButton) {
      guardarButton.disabled = false;
    }
  }
}

export async function ejecutarCambioEstadoPeriodo({
  periodo,
  nuevoEstado,
  recargarPeriodos,
  vigente,
  operacionId,
}) {
  if (typeof vigente !== 'function' || !vigente() || operacionId == null) return;

  const informacion = Array.isArray(periodo.transicionesEstado)
    ? periodo.transicionesEstado.find((item) => item.estado === nuevoEstado)
    : null;

  if (informacion?.disponible === false) {
    mostrarAdvertencia({
      titulo: 'Acción no disponible',
      mensaje:
        informacion.motivo ||
        'Esta transición no está disponible para el periodo seleccionado.',
    });
    return;
  }

  const transicion = (TRANSICIONES_PERIODO[periodo.estado] || []).find(
    (item) => item.estado === nuevoEstado,
  );

  if (!transicion) {
    return;
  }

  const claveOperacion = `${operacionId}:${periodo.id}:${nuevoEstado}`;
  if (cambiosEstadoPendientes.has(claveOperacion)) return;
  cambiosEstadoPendientes.add(claveOperacion);

  try {
    const confirmado = await confirmarAccion({
      titulo: transicion.titulo,
      mensaje: `¿Desea cambiar "${periodo.nombre}" de ${obtenerNombreEstadoPeriodo(
        periodo.estado,
      )} a ${obtenerNombreEstadoPeriodo(nuevoEstado)}?`,
      textoConfirmar: transicion.texto,
      peligro: transicion.peligro,
    });

    if (!confirmado || !vigente()) return;

    const resultado = await cambiarEstadoPeriodoAcademico(
      periodo.id,
      nuevoEstado,
    );

    // La escritura ya fue enviada; solo se descarta su efecto visual si la vista caducó.
    if (!vigente()) return;

    if (!resultado?.ok) {
      throw new Error(
        resultado?.message || 'No fue posible cambiar el estado del periodo.',
      );
    }

    mostrarExito({
      titulo: 'Estado actualizado',
      mensaje: `El periodo quedó en estado "${obtenerNombreEstadoPeriodo(
        nuevoEstado,
      )}".`,
    });

    await recargarPeriodos();
  } catch (error) {
    if (vigente()) {
      mostrarError({
        titulo: 'No se pudo cambiar el estado',
        mensaje:
          error?.message || 'No fue posible actualizar el periodo académico.',
      });
    }
  } finally {
    cambiosEstadoPendientes.delete(claveOperacion);
  }
}
