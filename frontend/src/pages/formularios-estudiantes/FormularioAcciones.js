/**
 * SGPA — Coordinación de operaciones de ciclo de vida y enlaces seguros de Formularios de Estudiantes.
 * FRONTEND-ORDER-003
 */

import {
  sincronizarFormularioEstudiantes,
  cerrarFormularioEstudiantes,
  abrirEnlaceFormularioEstudiantes,
  publicarFormularioEstudiantes,
  regenerarTokenFormularioEstudiantes,
  obtenerUrlPublicaFormulario,
  obtenerTicketVistaPreviaFormulario,
} from '../../services/formularios-estudiantes.service.js';
import { mostrarError, mostrarExito } from '../../components/AlertModal.js';
import { confirmarAccion } from '../../utils/confirm.js';
import {
  extraerResultadoFormularioServicio,
  resolverUrlVistaPreviaFormulario,
} from './formularios-estudiantes.helpers.js';

export async function copiarEnlaceFormulario(formulario) {
  if (!formulario.responderUri) {
    mostrarError({
      titulo: 'Enlace no disponible',
      mensaje: 'Este formulario no posee un enlace de respuesta disponible.',
    });
    return;
  }

  try {
    const resultado = extraerResultadoFormularioServicio(
      await obtenerUrlPublicaFormulario(formulario.responderUri),
      'No fue posible validar el enlace del formulario.',
    );
    const enlaceResuelto =
      typeof resultado === 'string' ? resultado : resultado?.url;
    if (!enlaceResuelto) {
      throw new Error('El servicio no devolvió un enlace público válido.');
    }

    await navigator.clipboard.writeText(enlaceResuelto);

    mostrarExito({
      titulo: 'Enlace copiado',
      mensaje: 'El enlace del formulario fue copiado al portapapeles.',
    });
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible copiar el enlace',
      mensaje: error?.message || 'No se pudo acceder al portapapeles.',
    });
  }
}

export async function abrirVistaPreviaFormulario(formulario) {
  if (!formulario?.id) return;

  try {
    const ticketRes = extraerResultadoFormularioServicio(
      await obtenerTicketVistaPreviaFormulario(formulario.id),
      'No fue posible generar un acceso seguro para la vista previa.',
    );
    const previewUrl = resolverUrlVistaPreviaFormulario(formulario, ticketRes);
    if (!previewUrl) {
      throw new Error('El servicio no devolvió el enlace seguro de vista previa.');
    }
    await abrirEnlaceFormularioEstudiantes(previewUrl);
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible abrir la vista previa',
      mensaje:
        error?.message || 'No se pudo generar un acceso seguro para la vista previa.',
    });
  }
}

export async function sincronizarFormularioAction(
  formulario,
  button,
  recargarFormularios,
) {
  button.disabled = true;

  try {
    const res = await sincronizarFormularioEstudiantes(formulario.id);
    const resultado = extraerResultadoFormularioServicio(
      res,
      'No fue posible sincronizar las respuestas.',
    );

    mostrarExito({
      titulo: 'Respuestas sincronizadas',
      mensaje:
        `Google reportó ${resultado.recibidasGoogle ?? 0} respuestas. ` +
        `${resultado.nuevas ?? 0} nuevas, ` +
        `${resultado.ignoradasExistentes ?? 0} ya existentes, ` +
        `${resultado.errores ?? 0} con error.`,
    });

    await recargarFormularios();
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible sincronizar',
      mensaje: error?.message || 'Ocurrió un error al consultar Google Forms.',
    });
  } finally {
    button.disabled = false;
  }
}

export async function publicarFormularioAction(
  formulario,
  button,
  recargarFormularios,
) {
  const aceptado = await confirmarAccion({
    titulo: 'Publicar formulario',
    mensaje: `¿Desea publicar el formulario "${formulario.titulo}"? Quedará disponible inmediatamente para recibir respuestas de los estudiantes mediante su enlace público institucional.`,
    textoConfirmar: 'Publicar formulario',
    peligro: false,
  });

  if (!aceptado) return;

  button.disabled = true;

  try {
    const res = await publicarFormularioEstudiantes(formulario.id);
    extraerResultadoFormularioServicio(
      res,
      'No fue posible publicar el formulario.',
    );

    mostrarExito({
      titulo: 'Formulario publicado',
      mensaje: `El formulario "${formulario.titulo}" ahora está disponible públicamente.`,
    });

    await recargarFormularios();
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible publicar el formulario',
      mensaje: error?.message || 'Ocurrió un error al publicar el formulario.',
    });
  } finally {
    button.disabled = false;
  }
}

export async function regenerarTokenFormularioAction(
  formulario,
  button,
  recargarFormularios,
) {
  const aceptado = await confirmarAccion({
    titulo: 'Regenerar enlace público',
    mensaje: `Al regenerar el enlace del formulario "${formulario.titulo}", el enlace anterior quedará INVALIDADO de inmediato y los estudiantes requerirán el nuevo enlace para responder. ¿Desea continuar?`,
    textoConfirmar: 'Regenerar enlace',
    peligro: true,
  });

  if (!aceptado) return;

  button.disabled = true;

  try {
    const res = await regenerarTokenFormularioEstudiantes(formulario.id);
    extraerResultadoFormularioServicio(
      res,
      'No fue posible regenerar el enlace público.',
    );

    mostrarExito({
      titulo: 'Enlace regenerado',
      mensaje:
        'Se generó un nuevo enlace público. El enlace anterior ya no aceptará respuestas.',
    });

    await recargarFormularios();
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible regenerar el enlace',
      mensaje:
        error?.message || 'Ocurrió un error al regenerar el enlace público.',
    });
  } finally {
    button.disabled = false;
  }
}

export async function cerrarFormularioAction(
  formulario,
  button,
  recargarFormularios,
) {
  const esInterno = formulario.proveedor === 'INTERNO';
  const aceptado = await confirmarAccion({
    titulo: 'Cerrar formulario',
    mensaje: esInterno
      ? `El formulario institucional "${formulario.titulo}" dejará de aceptar respuestas de estudiantes de inmediato. Las respuestas registradas se conservarán.`
      : `El formulario "${formulario.titulo}" dejará de aceptar nuevas respuestas. Las respuestas existentes se conservarán.`,
    textoConfirmar: 'Cerrar formulario',
    peligro: true,
  });

  if (!aceptado) {
    return;
  }

  button.disabled = true;

  try {
    const res = await cerrarFormularioEstudiantes(formulario.id);
    extraerResultadoFormularioServicio(
      res,
      'No fue posible cerrar el formulario.',
    );

    let sincronizacionFinal = null;
    if (!esInterno) {
      try {
        const resultadoSync = await sincronizarFormularioEstudiantes(
          formulario.id,
        );
        if (resultadoSync && resultadoSync.ok !== false) {
          sincronizacionFinal = resultadoSync.data ?? resultadoSync;
        }
      } catch (error) {
        console.error(
          'El formulario se cerró, pero falló la sincronización final:',
          error,
        );
      }
    }

    mostrarExito({
      titulo: 'Formulario cerrado',
      mensaje: esInterno
        ? `El formulario institucional "${formulario.titulo}" fue cerrado y ya no acepta respuestas.`
        : sincronizacionFinal
          ? 'Google Forms dejó de aceptar nuevas respuestas. ' +
            `La sincronización final detectó ${sincronizacionFinal.nuevas ?? 0} respuesta(s) nueva(s).`
          : 'Google Forms dejó de aceptar nuevas respuestas. ' +
            'La información existente permanece disponible.',
    });

    await recargarFormularios();
  } catch (error) {
    mostrarError({
      titulo: 'No fue posible cerrar el formulario',
      mensaje: error?.message || 'Ocurrió un error al cerrar el formulario.',
    });
  } finally {
    button.disabled = false;
  }
}
