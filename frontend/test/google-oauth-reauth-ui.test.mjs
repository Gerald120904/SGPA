import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pagina = readFileSync(
  new URL(
    '../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js',
    import.meta.url
  ),
  'utf8'
);

test('muestra una reconexión explícita cuando OAuth requiere reautenticación', () => {
  assert.match(pagina, /Google requiere reconexión/);
  assert.match(pagina, /Volver a conectar Google/);
  assert.match(pagina, /REQUIERE_REAUTENTICACION/);
});

test('no habilita la creación de formularios sin una conexión activa', () => {
  assert.match(
    pagina,
    /id="nuevoFormularioButton"[\s\S]*?estadoGoogle\.conectado[\s\S]*?'disabled'/
  );
});
