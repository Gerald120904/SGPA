export function QuickAccessCard({
  route,
  icon,
  title,
  description
}) {

  return `
    <button
      class="quick-card"
      data-route="${route}"
      type="button"
    >

      <div class="quick-card-icon">

        <i
          data-lucide="${icon}"
          aria-hidden="true"
        ></i>

      </div>


      <div>

        <strong>
          ${title}
        </strong>

        <span>
          ${description}
        </span>

      </div>


      <i
        data-lucide="chevron-right"
        class="quick-arrow"
        aria-hidden="true"
      ></i>

    </button>
  `;

}