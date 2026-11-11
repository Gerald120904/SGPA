import test from 'node:test';
import assert from 'node:assert/strict';
import { renderizarExpedientePerfil } from '../src/pages/profesores/ProfesorDetalleView.js';

test('ProfesorDetalleView — renderizarExpedientePerfil genera markup institucional y botones según modo', () => {
  const content = { innerHTML: '', onclick: null, querySelectorAll: () => [] };
  const dialog = { close: () => {} };

  global.document = {
    getElementById: (id) => {
      if (id === 'profesorExpedienteDialog') return dialog;
      if (id === 'profesorExpedienteDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  const expedienteMock = {
    perfil: { id: 5, codigo: 'PER-INFO-01', nombre: 'Programación Avanzada', numeroPerfil: 1 },
    profesor: { id: 10, nombre: 'Ana Rojas' },
    solicitud: { estado: 'PENDIENTE' },
    requisitos: [
      {
        id: 101,
        tipo: 'FORMACION_ACADEMICA',
        descripcion: 'Licenciatura en Informática',
        obligatorio: true,
        cumplimiento: { estado: 'CUMPLE', observacionProfesor: 'Título adjunto' },
        evidencias: [{ id: 1, nombre: 'Título Licenciatura', tipo: 'TITULO_ACADEMICO', estado: 'APROBADO' }],
      },
    ],
    atestadosDisponibles: [
      { id: 1, nombre: 'Título Licenciatura', tipo: 'TITULO_ACADEMICO', estado: 'APROBADO' },
    ],
  };

  // Modo 'gestion' con permiso de validación
  renderizarExpedientePerfil({
    expediente: expedienteMock,
    modo: 'gestion',
    perfilId: 5,
    puedeValidar: true,
  });

  assert.match(content.innerHTML, /PER-INFO-01/);
  assert.match(content.innerHTML, /Ana Rojas/);
  assert.match(content.innerHTML, /OBLIGATORIO/);
  assert.match(content.innerHTML, /revisar-requisito-dialog/);
  assert.match(content.innerHTML, /aprobar-perfil-desde-expediente/);

  // Modo 'profesor' (autogestión)
  renderizarExpedientePerfil({
    expediente: expedienteMock,
    modo: 'profesor',
    perfilId: 5,
    puedeValidar: false,
  });

  assert.match(content.innerHTML, /guardar-evidencias-requisito/);
  assert.doesNotMatch(content.innerHTML, /aprobar-perfil-desde-expediente/);
});
