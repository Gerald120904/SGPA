import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/pages/usuarios/MisAsistentesPage.js', import.meta.url), 'utf8');
test('muestra estado de invitación y habilita el procesamiento solo cuando el backend lo autoriza', () => {
  assert.match(source, /a\.invitacion\?\.puedeProcesar/);
  assert.match(source, /data-action="procesar-invitacion"/);
  assert.match(source, /procesandoInvitaciones\.has\(Number\(a\.id\)\)/);
  assert.match(source, /INCIERTA:/);
  assert.match(source, /procesarInvitacionAsistenteJerarquia\(id\)/);
});
