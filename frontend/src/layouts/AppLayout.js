import {
  Sidebar
} from '../components/Sidebar.js';

import {
  Topbar
} from '../components/Topbar.js';


export function AppLayout({
  usuario,
  roles
}) {

  return `
    <main
      id="appShell"
      class="app-shell"
    >

      ${Sidebar({
        usuario,
        roles
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
