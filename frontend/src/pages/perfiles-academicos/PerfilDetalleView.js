/**
 * SGPA — Vista de detalle, áreas, requisitos y cursos habilitados de Perfiles Académicos.
 * FRONTEND-ORDER-003
 */

import { StatusBadge } from '../../components/StatusBadge.js';
import { escapeHtml } from '../../utils/html.js';
import {
  clasificarAreasPerfil,
  clasificarRequisitosPerfil,
  formatearEtiquetaTipo,
  formatearFechaPerfil,
} from './perfiles-academicos.helpers.js';

function datoOficial(etiqueta, valor) {
  return `<div><dt>${escapeHtml(etiqueta)}</dt><dd>${escapeHtml(valor || 'No registrado')}</dd></div>`;
}

function seccionLista(titulo, icono, elementos, vacio) {
  return `
    <section class="perfil-section">
      <header>
        <div>
          <span>Áreas del perfil</span>
          <h3>
            <i data-lucide="${icono}" aria-hidden="true"></i>
            ${escapeHtml(titulo)}
          </h3>
        </div>

        ${StatusBadge({
          label: `${elementos.length}`,
          tone: 'neutral',
        })}
      </header>

      ${
        elementos.length
          ? `
            <ul>
              ${elementos
                .map((item) => `<li>${escapeHtml(item.descripcion)}</li>`)
                .join('')}
            </ul>
          `
          : `<p class="perfil-empty">${escapeHtml(vacio)}</p>`
      }
    </section>
  `;
}

function seccionRequisitos(titulo, elementos, obligatorio = null) {
  return `
    <section class="perfil-section">
      <header>
        <div>
          <span>Requisitos del perfil</span>
          <h3>${escapeHtml(titulo)}</h3>
        </div>

        ${
          typeof obligatorio === 'boolean'
            ? StatusBadge({
                label: obligatorio ? 'OBLIGATORIO' : 'FACULTATIVO',
                tone: obligatorio ? 'warning' : 'info',
              })
            : StatusBadge({
                label: `${elementos.length}`,
                tone: 'neutral',
              })
        }
      </header>

      ${
        elementos.length
          ? `
            <div class="perfil-requirements">
              ${elementos
                .map(
                  (item) => `
                    <article>
                      <div class="perfil-requirement-heading">
                        <strong>${escapeHtml(formatearEtiquetaTipo(item.tipo))}</strong>

                        ${
                          obligatorio === null
                            ? StatusBadge({
                                label: item.obligatorio ? 'OBLIGATORIO' : 'FACULTATIVO',
                                tone: item.obligatorio ? 'warning' : 'info',
                              })
                            : ''
                        }
                      </div>

                      <p>${escapeHtml(item.descripcion)}</p>
                    </article>
                  `,
                )
                .join('')}
            </div>
          `
          : '<p class="perfil-empty">No hay elementos registrados.</p>'
      }
    </section>
  `;
}

function botonEditarSeccion(atributo, texto) {
  return `<div class="perfil-section-action"><button class="sgpa-button sgpa-button-secondary sgpa-button-sm" type="button" ${atributo}><i data-lucide="pencil" aria-hidden="true"></i>${escapeHtml(texto)}</button></div>`;
}

export function renderizarDetallePerfilHtml({
  perfil,
  areas = [],
  requisitos = [],
  puedeGestionar = false,
}) {
  const { disciplinares, estrategicas } = clasificarAreasPerfil(areas);
  const { obligatorios, facultativos, condiciones } =
    clasificarRequisitosPerfil(requisitos);
  const cursos = Array.isArray(perfil.cursos)
    ? perfil.cursos.filter((relacion) => relacion.activo !== false)
    : [];

  return `
    <button class="sgpa-button sgpa-button-secondary sgpa-back-button" type="button" data-volver-perfiles>
      <i data-lucide="arrow-left" aria-hidden="true"></i> Volver a perfiles
    </button>

    <article class="perfil-hero">
      <div>
        <div class="perfil-hero-badges">
          <span class="perfil-code-pill">${escapeHtml(perfil.codigo)}</span>
          ${StatusBadge({
            label: perfil.activo ? 'ACTIVO' : 'INACTIVO',
            tone: perfil.activo ? 'success' : 'neutral',
          })}
        </div>
        <h2>${escapeHtml(perfil.nombre)}</h2>
        <p>${escapeHtml(perfil.numeroPerfil || 'Perfil oficial sin numeración registrada')}</p>
      </div>
      ${
        puedeGestionar
          ? `
        <div class="perfil-hero-actions">
          <button
            class="sgpa-button sgpa-button-secondary"
            type="button"
            data-editar-perfil
          >
            <i data-lucide="pencil" aria-hidden="true"></i>
            Editar información
          </button>

          <button
            class="sgpa-button ${
              perfil.activo ? 'sgpa-button-danger' : 'sgpa-button-primary'
            }"
            type="button"
            data-cambiar-estado-perfil
          >
            <i
              data-lucide="${perfil.activo ? 'circle-pause' : 'circle-play'}"
              aria-hidden="true"
            ></i>
            ${perfil.activo ? 'Inactivar' : 'Activar'}
          </button>
        </div>
      `
          : ''
      }
    </article>

    ${
      perfil.utilizado
        ? `
          <div class="perfil-structure-lock" role="status">
            <div class="perfil-structure-lock-icon">
              <i data-lucide="lock" aria-hidden="true"></i>
            </div>

            <div>
              <strong>Configuración bloqueada</strong>
              <p>
                Este perfil ya fue utilizado por uno o más profesores.
                Sus áreas, requisitos y cursos se conservan para proteger
                el historial. Para definir una estructura diferente,
                cree un nuevo perfil docente.
              </p>
            </div>
          </div>
        `
        : ''
    }

    <section class="perfil-section">
      <header><div><span>Información</span><h3>Datos del perfil</h3></div></header>
      <dl class="perfil-official-grid">
        ${datoOficial('Número de perfil', perfil.numeroPerfil)}
        ${datoOficial('Consecutivo', perfil.consecutivo)}
        ${datoOficial('Acuerdo de aprobación', perfil.acuerdoAprobacion)}
        ${datoOficial('Fecha de aprobación', formatearFechaPerfil(perfil.fechaAprobacion))}
        ${datoOficial('Tipo de registro', formatearEtiquetaTipo(perfil.tipoRegistro))}
        ${datoOficial('Carrera', perfil.carrera?.nombre)}
      </dl>
    </section>

    <div class="perfil-two-columns">
      ${seccionLista('Áreas disciplinares', 'book-open', disciplinares, 'No hay áreas disciplinares registradas.')}
      ${seccionLista('Áreas estratégicas', 'target', estrategicas, 'No hay áreas estratégicas registradas.')}
    </div>
    ${
      puedeGestionar && perfil.estructuraEditable
        ? botonEditarSeccion('data-editar-areas', 'Editar áreas')
        : ''
    }

    <section class="perfil-section">
      <header>
        <div>
          <span>Asignación</span>
          <h3>Cursos habilitados</h3>
        </div>

        ${
          puedeGestionar
            ? `
              <button
                class="sgpa-button sgpa-button-secondary sgpa-button-sm"
                type="button"
                data-gestionar-cursos
                ${perfil.activo && perfil.estructuraEditable ? '' : 'disabled'}
                title="${
                  !perfil.activo
                    ? 'Active el perfil para modificar sus cursos'
                    : !perfil.estructuraEditable
                      ? 'La estructura está bloqueada porque el perfil ya fue utilizado'
                      : 'Administrar cursos habilitados'
                }"
              >
                <i data-lucide="book-plus" aria-hidden="true"></i>
                Gestionar cursos
              </button>
            `
            : ''
        }
      </header>

      <div class="perfil-chips">
        ${
          cursos.length
            ? cursos
                .map(
                  (relacion) => `
                    <span>
                      ${escapeHtml(
                        relacion.curso?.codigo || String(relacion.cursoId),
                      )}
                    </span>
                  `,
                )
                .join('')
            : '<p class="perfil-empty">No hay cursos habilitados por este perfil.</p>'
        }
      </div>
    </section>

    <div class="perfil-two-columns">
      ${seccionRequisitos('Requisitos obligatorios', obligatorios, true)}
      ${seccionRequisitos('Requisitos facultativos', facultativos, false)}
    </div>
    ${seccionRequisitos('Condiciones', condiciones, null)}
    ${
      puedeGestionar && perfil.estructuraEditable
        ? botonEditarSeccion(
            'data-editar-requisitos',
            'Editar requisitos y condiciones',
          )
        : ''
    }
  `;
}
