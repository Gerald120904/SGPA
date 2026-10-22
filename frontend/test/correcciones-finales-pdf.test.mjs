import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('1. Modales de todo el SGPA: AlertModal y confirm.js tienen diseño profesional e iconografía completa', async () => {
  const alertModalCode = readFileSync(new URL('../src/components/AlertModal.js', import.meta.url), 'utf8');
  assert.match(alertModalCode, /export function mostrarExito/);
  assert.match(alertModalCode, /export function mostrarError/);
  assert.match(alertModalCode, /export function mostrarAdvertencia/);
  assert.match(alertModalCode, /export function mostrarInfo/);
  assert.match(alertModalCode, /circle-check/);
  assert.match(alertModalCode, /triangle-alert/);

  const confirmCode = readFileSync(new URL('../src/utils/confirm.js', import.meta.url), 'utf8');
  assert.doesNotMatch(confirmCode, /<div class="sgpa-confirm-icon">!<\/div>/, 'No debe usar el caracter plano ! como icono');
  assert.match(confirmCode, /data-lucide="\$\{icono\}"/);
  assert.match(confirmCode, /sgpa-confirm-eyebrow/);
  assert.match(confirmCode, /renderizarIconos\(\)/);

  const alertCss = readFileSync(new URL('../src/styles/alert-modal.css', import.meta.url), 'utf8');
  assert.match(alertCss, /\.sgpa-alert-success/);
  assert.match(alertCss, /\.sgpa-alert-error/);
  assert.match(alertCss, /\.sgpa-alert-warning/);
  assert.match(alertCss, /\.sgpa-alert-info/);
  assert.match(alertCss, /var\(--una-red, #cf2029\)/);

  const baseCss = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.match(baseCss, /\.sgpa-confirm-card/);
  assert.match(baseCss, /\.sgpa-confirm-danger-mode/);
  assert.match(baseCss, /\.sgpa-confirm-neutral-mode/);
});

test('2, 3 y 4. Usuarios: Validaciones estrictas, no textos extraños, banner de invitación y rol amigable', () => {
  const usuariosPageCode = readFileSync(new URL('../src/pages/usuarios/UsuariosPage.js', import.meta.url), 'utf8');
  assert.match(usuariosPageCode, /usuario-invitacion-banner/);
  assert.match(usuariosPageCode, /Invitación por correo electrónico/);
  assert.doesNotMatch(usuariosPageCode, /Este usuario posee el rol\s+ADMIN_GLOBAL\./);
  assert.match(usuariosPageCode, /nombreVisibleRol\(ROLES\.ADMIN_GLOBAL\)/);

  // Validaciones de caracteres
  assert.match(usuariosPageCode, /cedulaRegex/);
  assert.match(usuariosPageCode, /nombreRegex/);
  assert.match(usuariosPageCode, /correoRegex/);
  assert.match(usuariosPageCode, /La cédula solo debe contener letras, números o guiones/);
  assert.match(usuariosPageCode, /El nombre solo debe contener letras y espacios válidos/);

  const crearDtoCode = readFileSync(new URL('../../backend/src/usuarios/dto/crear-usuario.dto.ts', import.meta.url), 'utf8');
  assert.match(crearDtoCode, /@Matches\(\/\^\[a-zA-Z0-9-\]\+\$\//);
  assert.match(crearDtoCode, /@Matches\(\/\^\[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\\s'-\]\+\$\//);

  const actualizarDtoCode = readFileSync(new URL('../../backend/src/usuarios/dto/actualizar-usuario.dto.ts', import.meta.url), 'utf8');
  assert.match(actualizarDtoCode, /@Matches\(\/\^\[a-zA-Z0-9-\]\+\$\//);
});

test('5. Períodos Académicos: conserva el calendario nativo en los tres campos de fecha', () => {
  const periodosCode = readFileSync(new URL('../src/pages/periodos/PeriodosPage.js', import.meta.url), 'utf8');
  for (const id of ['periodoFechaInicio', 'periodoFechaFin', 'periodoFechaLimite']) {
    const campo = periodosCode.split(`id="${id}"`)[1]?.split('>', 1)[0] || '';
    assert.match(campo, /type="date"/);
    assert.doesNotMatch(campo, /readonly/i);
  }
  assert.doesNotMatch(periodosCode, /periodo-cal-popover|configurarSelectorFechaSGPA/);

  const periodosCss = readFileSync(new URL('../src/styles/periodos.css', import.meta.url), 'utf8');
  assert.doesNotMatch(periodosCss, /::-webkit-calendar-picker-indicator\s*\{[^}]*display:\s*none/s);
});

test('6 y 7. Formularios: Vista previa de cursos completa y animación interactiva con confirmación real', () => {
  const formulariosCode = readFileSync(new URL('../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js', import.meta.url), 'utf8');
  assert.match(formulariosCode, /escapeHtml\(asignatura\.curso\?\.nombre \|\| asignatura\.nombreReferencia/);
  assert.match(formulariosCode, /formularios-btn-spinner/);
  assert.match(formulariosCode, /formulariosCreandoNotice/);
  assert.match(formulariosCode, /estaCreando/);
  assert.match(formulariosCode, /estaPublicado/);

  const formulariosCss = readFileSync(new URL('../src/styles/formularios-estudiantes.css', import.meta.url), 'utf8');
  assert.match(formulariosCss, /\.formularios-btn-spinner/);
  assert.match(formulariosCss, /\.formularios-creando-notice/);
  assert.match(formulariosCss, /\.formularios-pulse-dot/);
});
