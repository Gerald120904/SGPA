import { EstudiantesService } from './estudiantes.service';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { CursoOptativo } from '../optativas/entities/curso-optativo.entity';
import { ReglaOptativaPlan } from '../planes-estudio/entities/regla-optativa-plan.entity';
import { TipoPlanAsignatura } from '../planes-estudio/constants/tipo-plan-asignatura.constant';
import { TipoOptativa } from '../optativas/constants/tipo-optativa.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { OrigenAcademico } from './constants/origen-academico.constant';

describe('reconocimiento individual de optativas', () => {
  it('conserva intentos y reconoce créditos una sola vez', async () => {
    const registros: HistorialAcademicoEstudiante[] = [];
    const estudiante = { id: 7, carreraId: 1, planEstudioId: 10, periodoIngreso: { anio: 2025, ciclo: 1 }, estado: 'ACTIVO' };
    const estudiantes = { findOne: jest.fn().mockResolvedValue(estudiante) };
    const espacios = { findOne: jest.fn().mockResolvedValue({ id: 20, planEstudioId: 10, activo: true, tipo: TipoPlanAsignatura.OPTATIVA, creditos: 3 }) };
    const periodos = { findOne: jest.fn().mockResolvedValue({ id: 1, anio: 2025, ciclo: 1 }) };
    const optativas = { findOne: jest.fn().mockResolvedValue({ id: 45, activo: true, tipo: TipoOptativa.DISCIPLINARIA, carreraOrigenId: 1, curso: { codigo: 'OPT-45', nombre: 'Optativa real', activo: true } }) };
    const reglas = { findOne: jest.fn().mockResolvedValue({ cantidadDisciplinarias: 1, cantidadAbiertas: 0, cantidadSede: 0 }) };
    const historial = {
      find: jest.fn().mockImplementation(async () => registros),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        const saved = { ...value, id: registros.length + 1 } as HistorialAcademicoEstudiante;
        registros.push(saved);
        return saved;
      }),
    };
    const manager = { getRepository: (entity: unknown) => entity === Estudiante ? estudiantes
      : entity === CursoOptativo ? optativas : entity === ReglaOptativaPlan ? reglas : historial };
    const dataSource = { transaction: (fn: (manager: unknown) => unknown) => fn(manager) };
    const alcance = { tipoCuentaJerarquica: jest.fn().mockResolvedValue(null), puedeEjecutar: jest.fn().mockResolvedValue(true) };
    const estructura = { tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true) };
    const service = new EstudiantesService(
      estudiantes as never, historial as never, {} as never, {} as never, {} as never,
      espacios as never, {} as never, periodos as never, estructura as never,
      dataSource as never, alcance as never,
    );
    const base = { planAsignaturaId: 20, cursoOptativoId: 45, periodoId: 1, origenAcademico: OrigenAcademico.CURSADO };
    const fallido = await service.registrarResultado(3, 7, { ...base, resultado: ResultadoAcademico.REPROBADO });
    const aprobado = await service.registrarResultado(3, 7, { ...base, resultado: ResultadoAcademico.APROBADO });
    const repetido = await service.registrarResultado(3, 7, { ...base, resultado: ResultadoAcademico.APROBADO });
    estudiante.planEstudioId = 11;
    espacios.findOne.mockResolvedValue({ id: 21, planEstudioId: 11, activo: true, tipo: TipoPlanAsignatura.OPTATIVA, creditos: 3 });
    const otroPlan = await service.registrarResultado(3, 7, {
      ...base, planAsignaturaId: 21, resultado: ResultadoAcademico.APROBADO,
    });
    expect(fallido.reconocimientoOptativo).toBe('NO_RECONOCIDO');
    expect(aprobado.reconocimientoOptativo).toBe('RECONOCIDO');
    expect(aprobado.codigoOptativaReal).toBe('OPT-45');
    expect(repetido.reconocimientoOptativo).toBe('NO_RECONOCIDO');
    expect(otroPlan.reconocimientoOptativo).toBe('NO_RECONOCIDO');
    expect(registros.reduce((total, item) => total + (item.creditosReconocidos || 0), 0)).toBe(3);
  });
});
