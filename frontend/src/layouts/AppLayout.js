import {
  Sidebar
} from '../components/Sidebar.js';

import {
  Topbar
} from '../components/Topbar.js';


export function AppLayout({
  usuario,
  roles,
  permisos,
  isCollapsed = false
}) {

  return `
    <main
      id="appShell"
      class="app-shell ${isCollapsed ? 'sidebar-collapsed' : ''}"
    >

      ${Sidebar({
        usuario,
        roles,
        permisos,
        isCollapsed
      })}


      <section class="app-main">

        ${Topbar({
          usuario
        })}


        <div
          id="contentArea"
          class="content-area"
        ></div>

      </section>

    </main>
  `;
}
