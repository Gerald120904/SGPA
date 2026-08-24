export function confirmarAccion({
  titulo = 'Confirmar acción',
  mensaje = '¿Desea continuar?',
  textoConfirmar = 'Confirmar',
  peligro = false,
} = {}) {
  return new Promise((resolve) => {
    const anterior = document.getElementById('sgpaConfirmDialog');

    anterior?.remove();

    const dialog = document.createElement('dialog');

    dialog.id = 'sgpaConfirmDialog';
    dialog.className = 'sgpa-confirm-dialog';

    dialog.innerHTML = `
      <form method="dialog" class="sgpa-confirm-card">
        <div class="sgpa-confirm-icon">!</div>

        <div class="sgpa-confirm-content">
          <h3>${escapar(titulo)}</h3>
          <p>${escapar(mensaje)}</p>
        </div>

        <div class="sgpa-confirm-actions">
          <button
            type="button"
            id="sgpaConfirmCancel"
            class="sgpa-confirm-cancel"
          >
            Cancelar
          </button>

          <button
            type="button"
            id="sgpaConfirmAccept"
            class="${
              peligro ? 'sgpa-confirm-danger' : 'sgpa-confirm-accept'
            }"
          >
            ${escapar(textoConfirmar)}
          </button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);

    let terminado = false;

    const finalizar = (resultado) => {
      if (terminado) {
        return;
      }

      terminado = true;

      if (dialog.open) {
        dialog.close();
      }

      dialog.remove();
      resolve(resultado);
    };

    dialog
      .querySelector('#sgpaConfirmCancel')
      ?.addEventListener('click', () => finalizar(false));

    dialog
      .querySelector('#sgpaConfirmAccept')
      ?.addEventListener('click', () => finalizar(true));

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finalizar(false);
    });

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        finalizar(false);
      }
    });

    dialog.showModal();
  });
}

function escapar(valor) {
  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
