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


test('2, 3 y 4. Usuarios: validaciones actuales, invitaciones y roles amigables', () => {
  const usuariosPageCode = readFileSync(
    new URL('../src/pages/usuarios/UsuariosPage.js', import.meta.url),
    'utf8'
  );

  // Invitaciones y presentación de roles
  assert.match(usuariosPageCode, /usuario-invitacion-banner/);
  assert.match(usuariosPageCode, /Invitación por correo electrónico/);
  assert.doesNotMatch(
    usuariosPageCode,
    /Este usuario posee el rol\s+ADMIN_GLOBAL\./
  );
  assert.match(
    usuariosPageCode,
    /nombreVisibleRol\(ROLES\.ADMIN_GLOBAL\)/
  );

  // Cédula: solamente números y máximo 9 dígitos
  assert.match(
    usuariosPageCode,
    /const cedulaRegex\s*=\s*\/\^\\d\{1,9\}\$\//
  );
  assert.match(
    usuariosPageCode,
    /La cédula solo debe contener números \(máximo 9 dígitos, sin guiones\)\./
  );
  assert.match(usuariosPageCode, /cedula:\s*9\b/);

  // Restricciones de longitud de los campos
  assert.match(usuariosPageCode, /correo:\s*150\b/);
  assert.match(usuariosPageCode, /nombres:\s*60\b/);
  assert.match(usuariosPageCode, /apellido1:\s*50\b/);
  assert.match(usuariosPageCode, /apellido2:\s*50\b/);

  // Validaciones de nombres y correo
  assert.match(usuariosPageCode, /nombreRegex/);
  assert.match(usuariosPageCode, /correoRegex/);
  assert.match(
    usuariosPageCode,
    /El nombre solo debe contener letras y espacios válidos/
  );

  // Prevención de registros duplicados
  assert.match(usuariosPageCode, /cedulaDuplicada/);
  assert.match(usuariosPageCode, /correoDuplicado/);

  // Restricción de caracteres y errores visuales
  assert.match(
    usuariosPageCode,
    /anterior\.replace\(\/\\D\/g, ''\)/
  );
  assert.match(usuariosPageCode, /aria-invalid/);
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
