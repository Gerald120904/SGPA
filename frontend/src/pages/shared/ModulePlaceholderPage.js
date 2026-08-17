import {
  ModulePlaceholder
} from '../../components/ModulePlaceholder.js';


export function ModulePlaceholderPage({
  titulo
}) {

  return `
    <section class="module-view">

      ${ModulePlaceholder(
        titulo
      )}

    </section>
  `;

}