import { mostrarError, mostrarExito } from '../../components/AlertModal.js';

export async function ejecutarGuardadoAula({
  boton,
  dialog,
  guardar,
  mensajeResultadoInvalido,
  tituloError,
  mensajeError,
  tituloExito,
  mensajeExito,
  despuesDeGuardar,
  notificarExito = mostrarExito,
  notificarError = mostrarError,
}) {
  if (boton) boton.disabled = true;

  try {
    const resultado = await guardar();
    if (!resultado?.ok) {
      throw new Error(resultado?.message || mensajeResultadoInvalido);
    }

    dialog.close();
    notificarExito({ titulo: tituloExito, mensaje: mensajeExito });

    if (typeof despuesDeGuardar === 'function') {
      await despuesDeGuardar(resultado);
    }
  } catch (error) {
    notificarError({
      titulo: tituloError,
      mensaje: error?.message || mensajeError,
    });
  } finally {
    if (boton) boton.disabled = false;
  }
}
