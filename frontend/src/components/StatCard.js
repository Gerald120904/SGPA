export function StatCard({
  icon,
  title,
  value = '—',
  description = ''
}) {

  return `
    <article class="stat-card">

      <div class="stat-icon">

        <i
          data-lucide="${icon}"
          aria-hidden="true"
        ></i>

      </div>


      <div>

        <span>
          ${title}
        </span>

        <strong>
          ${value}
        </strong>

        <small>
          ${description}
        </small>

      </div>

    </article>
  `;

}