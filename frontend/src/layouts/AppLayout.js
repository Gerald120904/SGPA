import {
  Sidebar
} from '../components/Sidebar.js';

import {
  Topbar
} from '../components/Topbar.js';


export function AppLayout({
  usuario,
  rol
}) {

  return `
    <main
      id="appShell"
      class="app-shell"
    >

      ${Sidebar({
        usuario,
        rol
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