import { escapeHtml } from '../utils/html.js';

export function ModuleCard({ module }) {
  const title = module.navLabel || module.title || 'Módulo';
  const description = module.description || '';
  const badge = module.section && module.section !== 'Gestión académica'
    ? escapeHtml(module.section)
    : '';

  return `
    <button
      class="system-module-card"
      data-route="${module.route}"
      data-module="${module.id}"
      type="button"
      aria-label="Abrir ${escapeHtml(title)}"
    >
      <div class="system-module-card-top">
        <div class="system-module-card-icon">
          <i data-lucide="${escapeHtml(module.icon || 'circle')}" aria-hidden="true"></i>
        </div>
        ${badge ? `<span class="system-module-card-badge">${badge}</span>` : ''}
      </div>

      <div class="system-module-card-content">
        <strong>${escapeHtml(title)}</strong>
        ${description ? `<p>${escapeHtml(description)}</p>` : ''}
      </div>

      <span class="system-module-card-action">
        <span>Abrir módulo</span>
        <i data-lucide="arrow-right" aria-hidden="true"></i>
      </span>
    </button>
  `;
}
