import {
  escapeHtml
} from '../utils/html.js';


export function SelectionCard({
  dataAttribute,
  dataValue,
  icon,
  title,
  description = '',
  details = [],
  actionText = 'Seleccionar',
  status = null
}) {
  const detalle =
    details
      .filter(Boolean)
      .map(
        (item) =>
          escapeHtml(item)
      )
      .join(' · ');

  return `
    <button
      type="button"
      class="module-card"
      ${dataAttribute}="${escapeHtml(
        dataValue
      )}"
      aria-label="${escapeHtml(
        actionText
      )}: ${escapeHtml(title)}"
    >
      <span
        class="module-card-decoration"
        aria-hidden="true"
      ></span>

      <div class="module-card-top">
        <div class="module-card-icon">
          <i
            data-lucide="${escapeHtml(
              icon
            )}"
            aria-hidden="true"
          ></i>
        </div>
      </div>

      <div class="module-card-content">
        <strong>
          ${escapeHtml(title)}
        </strong>

        ${
          detalle
            ? `
                <p>
                  ${detalle}
                </p>
              `
            : ''
        }

        ${
          description
            ? `
                <p>
                  ${escapeHtml(
                    description
                  )}
                </p>
              `
            : ''
        }

        ${
          status
            ? `
                <div class="selection-card-status">
                  ${status}
                </div>
              `
            : ''
        }
      </div>

      <div class="module-card-action">
        <span>
          ${escapeHtml(actionText)}
        </span>

        <i
          data-lucide="chevron-right"
          aria-hidden="true"
        ></i>
      </div>

      <span
        class="module-card-hover-line"
        aria-hidden="true"
      ></span>
    </button>
  `;
}
