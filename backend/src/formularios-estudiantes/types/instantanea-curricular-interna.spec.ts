import { BadRequestException } from '@nestjs/common';
import { TipoRequisito } from '../../planes-estudio/constants/tipo-requisito.constant';
import {
  catalogoDesdeInstantanea,
  InstantaneaCurricularInterna,
  validarSeleccionInstantanea,
} from './instantanea-curricular-interna.type';

describe('instantánea curricular interna publicada', () => {
  const publicada: InstantaneaCurricularInterna = {
    version: 3,
    plan: { id: 7, nombre: 'Plan publicado', codigo: 'QA-7', carreraId: 2 },
    asignaturas: [
      { id: 10, planEstudioId: 7, cursoId: 100, codigo: 'PROG-I', nombre: 'Programación I', nivel: 1, ciclo: 1, activo: true },
      { id: 11, planEstudioId: 7, cursoId: 101, codigo: 'PROG-II', nombre: 'Programación II', nivel: 1, ciclo: 2, activo: true },
    ],
    requisitos: [{ id: 1, asignaturaId: 11, requisitoAsignaturaId: 10, tipo: TipoRequisito.REQUISITO }],
  };

  it('conserva años, ciclos y prerrequisitos aunque la versión vigente del plan cambie', () => {
    const planVigente = JSON.parse(JSON.stringify(publicada)) as InstantaneaCurricularInterna;
    planVigente.asignaturas[1].ciclo = 1;
    planVigente.requisitos = [];

    const catalogo = catalogoDesdeInstantanea(publicada);
    expect(catalogo.map((nivel) => nivel.ciclos.map((ciclo) => ciclo.ciclo))).toEqual([[1, 2]]);
    expect(catalogo[0].ciclos[1].asignaturas[0]).toMatchObject({
      asignaturaId: 11,
      bloqueadaPorRequisitos: true,
    });
    expect(() => validarSeleccionInstantanea(publicada, [11])).toThrow(BadRequestException);
    expect(validarSeleccionInstantanea(publicada, [10, 11]).aprobadasValidas).toEqual([10, 11]);
  });
});
