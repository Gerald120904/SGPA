import { escapeHtml } from '../../utils/html.js';
import { obtenerInformacionPermiso } from './usuarios.helpers.js';
import { renderizarAuditoriaJerarquiaHtml } from './UsuarioFormDialog.js';

const PERMISOS_DELEGABLES = Object.freeze([
  'ESTUDIANTES_VER',
  'ESTUDIANTES_GESTIONAR',
  'CURSOS_VER',
  'CURSOS_GESTIONAR',
  'PLANES_ESTUDIO_VER',
  'PLANES_ESTUDIO_GESTIONAR',
  'OPTATIVAS_VER',
  'OPTATIVAS_GESTIONAR',
]);

/** Construye la vista del alcance jerárquico sin decidir ni conceder permisos. */
export function construirDialogoJerarquiaUsuario({
  usuario,
  configuracion,
  auditoria = [],
  esAsistente = false,
  carreras = [],
  permisosCatalogo = [],
  obtenerNombreCompleto,
}) {
  const asignadas = new Map(
    (configuracion.carreras || []).map((carrera) => [
      Number(carrera.carreraId),
      new Set(carrera.permisos || []),
    ]),
  );
  const delegables = esAsistente
    ? new Map(
        (configuracion.delegables || []).map((carrera) => [
          Number(carrera.id),
          new Set(carrera.permisos || []),
        ]),
      )
    : null;

  return {
    formId: 'jerarquiaForm',
    userId: usuario.id,
    title: `Carreras y permisos de ${obtenerNombreCompleto(usuario)}`,
    description: esAsistente
      ? 'Seleccione únicamente carreras y permisos autorizados a su coordinador responsable.'
      : 'Seleccione las operaciones autorizadas en cada carrera. La revocación se aplica a sus asistentes.',
    body: `
      <div class="usuario-dialog-feedback hidden" role="status" aria-live="polite"></div>
      <div class="usuario-section-heading">
        <span class="usuario-section-icon"><i data-lucide="shield-check" aria-hidden="true"></i></span>
        <div><h4>Alcance académico por carrera</h4><p>Marque las carreras y los permisos que corresponden.</p></div>
      </div>
      <div class="usuarios-alcances">
        ${carreras.filter((carrera) => !esAsistente || delegables.has(Number(carrera.id))).map((carrera) => {
          const permisos = asignadas.get(Number(carrera.id)) || new Set();
          return `<fieldset class="usuarios-alcance" data-carrera-id="${carrera.id}">
            <legend>
              <label><input type="checkbox" name="jerarquia-carrera" value="${carrera.id}"
                ${asignadas.has(Number(carrera.id)) ? 'checked' : ''}>
                ${escapeHtml(carrera.nombre)} (${escapeHtml(carrera.codigo)})</label>
            </legend>
            <label class="usuarios-alcance-seleccionar-todos">
              <input type="checkbox" name="jerarquia-todos-permisos">
              <span>Seleccionar todos los permisos de esta carrera</span>
            </label>
            <div class="usuarios-alcance-permisos">
              ${permisosCatalogo.filter((permiso) =>
                PERMISOS_DELEGABLES.includes(permiso) &&
                (!esAsistente || delegables.get(Number(carrera.id))?.has(permiso))).map((permiso) => `
                <label><input type="checkbox" name="jerarquia-permiso" value="${escapeHtml(permiso)}"
                  ${permisos.has(permiso) ? 'checked' : ''}>
                  ${escapeHtml(obtenerInformacionPermiso(permiso).nombre)}</label>
              `).join('')}
            </div>
          </fieldset>`;
        }).join('')}
      </div>
      ${renderizarAuditoriaJerarquiaHtml(auditoria)}
    `,
    footerHtml: `
      <button class="sgpa-form-secondary" type="button" data-action="cerrar-dialogo">Cancelar</button>
      <button class="sgpa-form-primary" type="submit">
        <i data-lucide="save" aria-hidden="true"></i><span>Guardar alcance</span>
      </button>
    `,
    esAsistente,
  };
}
