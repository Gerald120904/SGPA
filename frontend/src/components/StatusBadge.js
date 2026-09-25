import {
  escapeHtml
} from '../utils/html.js';


export function StatusBadge({
  label,
  tone = 'neutral'
}) {
  const tonosPermitidos =
    new Set([
      'success',
      'neutral',
      'danger',
      'warning',
      'info'
    ]);

  const tono =
    tonosPermitidos.has(tone)
      ? tone
      : 'neutral';

  return `
    <span
      class="
        sgpa-status-badge
        sgpa-status-${tono}
      "
    >
      ${escapeHtml(label)}
    </span>
  `;
}
