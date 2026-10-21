import { escapeHtml } from './html.js';
import { renderizarIconos } from './icons.js';

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

    const icono = peligro ? 'triangle-alert' : 'circle-help';
    const estadoClase = peligro ? 'sgpa-confirm-danger-mode' : 'sgpa-confirm-neutral-mode';
    const eyebrow = peligro ? 'Acción importante' : 'Confirmación';

    dialog.innerHTML = `
      <form method="dialog" class="sgpa-confirm-card ${estadoClase}">
        <div class="sgpa-confirm-icon-area">
          <div class="sgpa-confirm-icon-ring" aria-hidden="true">
            <i data-lucide="${icono}" aria-hidden="true"></i>
          </div>
        </div>

        <div class="sgpa-confirm-content">
          <span class="sgpa-confirm-eyebrow">${escapeHtml(eyebrow)}</span>
          <h3>${escapeHtml(titulo)}</h3>
          <p>${escapeHtml(mensaje)}</p>
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
            ${escapeHtml(textoConfirmar)}
          </button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    renderizarIconos();

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
