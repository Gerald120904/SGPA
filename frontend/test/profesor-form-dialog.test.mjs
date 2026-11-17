import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abrirFormularioAtestado,
  abrirFormularioProyecto,
} from '../src/pages/profesores/ProfesorFormDialog.js';

test('ProfesorFormDialog — abrirFormularioAtestado monta formulario con opciones y fechas según tipo', () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    showModal: () => {},
    close: () => {},
    addEventListener: () => {},
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'profesorRevisionDialog') return dialog;
      if (id === 'profesorRevisionDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  // Creación
  abrirFormularioAtestado();
  assert.match(content.innerHTML, /Nuevo atestado/);
  assert.match(content.innerHTML, /id="atestadoTipo"/);
  assert.match(content.innerHTML, /id="atestadoNombre"/);

  // Edición con tipo de experiencia
  abrirFormularioAtestado({
    atestado: {
      id: 12,
      tipo: 'EXPERIENCIA_DOCENTE',
      nombre: 'Profesor de Cátedra',
      institucion: 'UNA',
      fechaInicio: '2022-02-01',
      fechaFin: '2024-11-30',
    },
  });
  assert.match(content.innerHTML, /Editar atestado/);
  assert.match(content.innerHTML, /Profesor de Cátedra/);
  assert.match(content.innerHTML, /2022-02-01/);
});

test('ProfesorFormDialog — abrirFormularioProyecto monta formulario para registro de actividades académicas', () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    showModal: () => {},
    close: () => {},
    addEventListener: () => {},
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'profesorRevisionDialog') return dialog;
      if (id === 'profesorRevisionDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  abrirFormularioProyecto({
    proyecto: {
      id: 4,
      nombre: 'Laboratorio de Ciberseguridad',
      unidad: 'Escuela de Informática',
      rol: 'Coordinador',
    },
  });

  assert.match(content.innerHTML, /Editar proyecto \/ laboratorio/);
  assert.match(content.innerHTML, /Laboratorio de Ciberseguridad/);
  assert.match(content.innerHTML, /Escuela de Informática/);
});

test('ProfesorFormDialog — sanitización de fechas en atributos value (estándar, vacíos y caracteres especiales)', () => {
  const content = { innerHTML: '', querySelectorAll: () => [] };
  const dialog = {
    showModal: () => {},
    close: () => {},
    addEventListener: () => {},
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'profesorRevisionDialog') return dialog;
      if (id === 'profesorRevisionDialogContent') return content;
      return null;
    },
    querySelectorAll: () => [],
  };

  // 1. Fechas vacías / nulas / indefinidas
  abrirFormularioAtestado({
    atestado: {
      id: 20,
      tipo: 'EXPERIENCIA_DOCENTE',
      nombre: 'Docente Sin Fechas',
      institucion: 'UNA',
      fechaInicio: null,
      fechaFin: undefined,
      fechaObtencion: '',
    },
  });
  assert.match(content.innerHTML, /id="atestadoFechaInicio"[^>]*value=""/);
  assert.match(content.innerHTML, /id="atestadoFechaFin"[^>]*value=""/);
  assert.match(content.innerHTML, /id="atestadoFechaObtencion"[^>]*value=""/);

  // 2. Fechas con caracteres especiales o inyección de atributos
  abrirFormularioAtestado({
    atestado: {
      id: 21,
      tipo: 'TITULO',
      nombre: 'Licenciatura',
      institucion: 'UNA',
      fechaObtencion: '2024-05-15" onfocus="alert(1)" data-hack="<script>',
    },
  });
  // Debe escapar comillas y corchetes angulares, impidiendo inyección
  assert.doesNotMatch(content.innerHTML, /<script>/);
  assert.match(content.innerHTML, /2024-05-15&quot; onfocus=&quot;alert\(1\)&quot; data-hack=&quot;&lt;script&gt;/);

  // 3. Fechas en proyectos con caracteres especiales y estándar
  abrirFormularioProyecto({
    proyecto: {
      id: 22,
      nombre: 'Proyecto Test Fechas',
      fechaInicio: '2023-01-01',
      fechaFin: '2023-12-31"><img src=x onerror=alert(1)>',
    },
  });
  assert.match(content.innerHTML, /id="proyectoFechaInicio"[^>]*value="2023-01-01"/);
  assert.doesNotMatch(content.innerHTML, /<img[^>]*onerror/);
  assert.match(content.innerHTML, /2023-12-31&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;/);
});
