import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/pages/formularios-estudiantes/FormulariosEstudiantesPage.js', import.meta.url), 'utf8');
const conectarSource = source.slice(
  source.indexOf('async function conectarGoogle()'),
  source.indexOf('async function desconectarGoogle()'),
);

async function conectar(resultado, error) {
  const avisos = [];
  const context = vm.createContext({
    conectarGoogleFormularios: async () => {
      if (error) throw error;
      return resultado;
    },
    mostrarExito: (aviso) => avisos.push({ tipo: 'exito', ...aviso }),
    mostrarError: (aviso) => avisos.push({ tipo: 'error', ...aviso }),
  });
  await vm.runInContext(`${conectarSource}\nconectarGoogle()`, context);
  return avisos;
}

test('muestra el error del backend cuando no se abre la autorización', async () => {
  const avisos = await conectar({ ok: false, message: 'Configuración de Google incompleta' });
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].tipo, 'error');
  assert.equal(avisos[0].mensaje, 'Configuración de Google incompleta');
});

test('solo anuncia la apertura cuando Electron la confirma', async () => {
  for (const resultado of [undefined, { ok: true }, { ok: true, abierto: false }]) {
    assert.equal((await conectar(resultado))[0].tipo, 'error');
  }
  assert.equal((await conectar({ ok: true, abierto: true }))[0].tipo, 'exito');
});

test('muestra los errores al abrir el navegador', async () => {
  const avisos = await conectar(undefined, new Error('No se pudo abrir el navegador'));
  assert.equal(avisos[0].tipo, 'error');
  assert.equal(avisos[0].mensaje, 'No se pudo abrir el navegador');
});
