import { HomePage, iniciarHomePage } from '../pages/home/HomePage.js';
import { ModulesPage } from '../pages/modules/ModulesPage.js';
import { UsuariosPage, iniciarUsuariosPage } from '../pages/usuarios/UsuariosPage.js';
import { MisAsistentesPage, iniciarMisAsistentesPage } from '../pages/usuarios/MisAsistentesPage.js';
import { CarrerasPage, iniciarCarrerasPage } from '../pages/carreras/CarrerasPage.js';
import { PlanesEstudioPage, iniciarPlanesEstudioPage } from '../pages/planes-estudio/PlanesEstudioPage.js';
import { PerfilesAcademicosPage, iniciarPerfilesAcademicosPage } from '../pages/perfiles-academicos/PerfilesAcademicosPage.js';
import { CursosPage, iniciarCursosPage } from '../pages/cursos/CursosPage.js';
import { OptativasPage, iniciarOptativasPage } from '../pages/optativas/OptativasPage.js';
import { PeriodosPage, iniciarPeriodosPage } from '../pages/periodos/PeriodosPage.js';
import {
  ProfesoresPage,
  iniciarProfesoresPage,
  destruirProfesoresPage,
} from '../pages/profesores/ProfesoresPage.js';
import { AulasPage, iniciarAulasPage } from '../pages/aulas/AulasPage.js';
import { FormulariosEstudiantesPage, iniciarFormulariosEstudiantesPage } from '../pages/formularios-estudiantes/FormulariosEstudiantesPage.js';
import { EstudiantesPage, iniciarEstudiantesPage } from '../pages/estudiantes/EstudiantesPage.js';

const PAGE_LIFECYCLES = Object.freeze({
  home: Object.freeze({ render: HomePage, initialize: iniciarHomePage }),
  dashboard: Object.freeze({ render: ModulesPage }),
  usuarios: Object.freeze({ render: UsuariosPage, initialize: iniciarUsuariosPage }),
  'mis-asistentes': Object.freeze({ render: MisAsistentesPage, initialize: iniciarMisAsistentesPage }),
  carreras: Object.freeze({ render: CarrerasPage, initialize: iniciarCarrerasPage }),
  'planes-estudio': Object.freeze({ render: PlanesEstudioPage, initialize: iniciarPlanesEstudioPage }),
  'perfiles-academicos': Object.freeze({ render: PerfilesAcademicosPage, initialize: iniciarPerfilesAcademicosPage }),
  cursos: Object.freeze({ render: CursosPage, initialize: iniciarCursosPage }),
  optativas: Object.freeze({ render: OptativasPage, initialize: iniciarOptativasPage }),
  periodos: Object.freeze({ render: PeriodosPage, initialize: iniciarPeriodosPage }),
  profesores: Object.freeze({
    render: ProfesoresPage,
    initialize: iniciarProfesoresPage,
    destroy: destruirProfesoresPage,
  }),
  aulas: Object.freeze({ render: AulasPage, initialize: iniciarAulasPage }),
  'formularios-estudiantes': Object.freeze({ render: FormulariosEstudiantesPage, initialize: iniciarFormulariosEstudiantesPage }),
  estudiantes: Object.freeze({ render: EstudiantesPage, initialize: iniciarEstudiantesPage }),
});

/** Devuelve el renderizador y el inicializador asociados a un módulo implementado. */
export function obtenerCicloVidaPagina(moduleId) {
  return Object.hasOwn(PAGE_LIFECYCLES, moduleId)
    ? PAGE_LIFECYCLES[moduleId]
    : null;
}

/** Lista los módulos con página implementada, principalmente para verificación. */
export function obtenerIdsPaginasImplementadas() {
  return Object.keys(PAGE_LIFECYCLES);
}
