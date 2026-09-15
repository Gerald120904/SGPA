import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { EstadoEstudiante } from './constants/estado-estudiante.constant';
import { FuenteRegistroAcademico } from './constants/fuente-registro-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import {
  EstudianteImportacionFilaDto,
  ImportarEstudiantesDto,
} from './dto/importar-estudiantes.dto';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { crearDatosResultadoImportado } from './resultado-importado.factory';

export type AccionImportacionEstudiante =
  'CREAR' | 'ACTUALIZAR' | 'SIN_CAMBIOS' | 'ERROR';

interface AprobacionResuelta {
  codigo: string;
  planAsignaturaId: number;
}

export interface CambioDatoImportacion {
  campo: string;
  actual: string | null;
  nuevo: string | null;
}

interface FilaValidada {
  fila: number;
  cedula: string;
  accion: AccionImportacionEstudiante;
  errores: string[];
  estudianteId: number | null;
  periodoIngresoId: number | null;
  datos: {
    nombres: string;
    apellido1: string;
    apellido2: string | null;
    correoInstitucional: string;
    telefono: string | null;
  };
  cambiosDatos: CambioDatoImportacion[];
  aprobacionesNuevas: AprobacionResuelta[];
}

@Injectable()
export class EstudiantesImportacionService {
  constructor(
    @InjectRepository(Estudiante)
    private readonly estudianteRepository: Repository<Estudiante>,
    @InjectRepository(HistorialAcademicoEstudiante)
    private readonly historialRepository: Repository<HistorialAcademicoEstudiante>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepository: Repository<PlanAsignatura>,
    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepository: Repository<PeriodoAcademico>,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
    private readonly dataSource: DataSource,
  ) {}

  async validar(usuarioId: number, dto: ImportarEstudiantesDto) {
    await this.validarContexto(usuarioId, dto.carreraId, dto.planEstudioId);
    const filas = await this.validarFilas(dto);
    return {
      carreraId: dto.carreraId,
      planEstudioId: dto.planEstudioId,
      resumen: this.resumir(filas),
      filas: filas.map(({ datos: _datos, ...fila }) => fila),
    };
  }

  async ejecutar(usuarioId: number, dto: ImportarEstudiantesDto) {
    return this.ejecutarConFuente(
      usuarioId,
      dto,
      FuenteRegistroAcademico.EXCEL,
    );
  }

  async ejecutarDesdeGoogleForms(
    usuarioId: number,
    dto: ImportarEstudiantesDto,
  ) {
    return this.ejecutarConFuente(
      usuarioId,
      dto,
      FuenteRegistroAcademico.GOOGLE_FORMS,
    );
  }

  private async ejecutarConFuente(
    usuarioId: number,
    dto: ImportarEstudiantesDto,
    fuente: FuenteRegistroAcademico,
  ) {
    await this.validarContexto(usuarioId, dto.carreraId, dto.planEstudioId);
    const filas = await this.validarFilas(dto);
    const procesables = filas.filter(
      (fila) => fila.accion === 'CREAR' || fila.accion === 'ACTUALIZAR',
    );
    let creados = 0;
    let actualizados = 0;
    let aprobacionesNuevas = 0;

    if (procesables.length) {
      await this.dataSource.transaction(async (manager) => {
        const estudiantes = manager.getRepository(Estudiante);
        const historiales = manager.getRepository(HistorialAcademicoEstudiante);
        for (const fila of procesables) {
          let estudianteId = fila.estudianteId;
          if (fila.accion === 'CREAR') {
            const guardado = await estudiantes.save(
              estudiantes.create({
                cedula: fila.cedula,
                ...fila.datos,
                carreraId: dto.carreraId,
                planEstudioId: dto.planEstudioId,
                periodoIngresoId: fila.periodoIngresoId!,
                estado: EstadoEstudiante.ACTIVO,
              }),
            );
            estudianteId = guardado.id;
            creados += 1;
          } else {
            await estudiantes.update(estudianteId!, fila.datos);
            actualizados += 1;
          }
          for (const aprobacion of fila.aprobacionesNuevas) {
            await this.guardarAprobacionImportada(
              historiales,
              estudianteId!,
              aprobacion.planAsignaturaId,
              usuarioId,
              fuente,
            );
            aprobacionesNuevas += 1;
          }
        }
      });
    }

    return {
      creados,
      actualizados,
      aprobacionesNuevas,
      sinCambios: filas.filter((fila) => fila.accion === 'SIN_CAMBIOS').length,
      errores: filas.filter((fila) => fila.accion === 'ERROR').length,
      filas: filas.map(({ datos: _datos, ...fila }) => fila),
    };
  }

  private async validarContexto(
    usuarioId: number,
    carreraId: number,
    planEstudioId: number,
  ) {
    const carrera = await this.carreraRepository.findOne({
      where: { id: carreraId },
    });
    if (!carrera) throw new BadRequestException('La carrera no existe.');
    if (!carrera.activo)
      throw new BadRequestException('La carrera se encuentra inactiva.');
    if (
      !(await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        carreraId,
      ))
    ) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }
    const plan = await this.planRepository.findOne({
      where: { id: planEstudioId },
    });
    if (!plan) throw new BadRequestException('El plan de estudio no existe.');
    if (!plan.activo)
      throw new BadRequestException(
        'El plan de estudio se encuentra inactivo.',
      );
    if (plan.carreraId !== carreraId)
      throw new BadRequestException(
        'El plan de estudio no pertenece a la carrera indicada.',
      );
  }

  private async validarFilas(dto: ImportarEstudiantesDto) {
    const normalizadas = dto.estudiantes.map((fila) =>
      this.normalizarFila(fila),
    );
    const cedulas = normalizadas.map((fila) => fila.cedula);
    const correos = normalizadas.map((fila) => fila.datos.correoInstitucional);
    const codigosPeriodo = normalizadas.map(
      (fila) => fila.periodoIngresoCodigo,
    );
    const [periodos, estudiantes, asignaturas] = await Promise.all([
      codigosPeriodo.length
        ? this.periodoRepository.find({ where: { codigo: In(codigosPeriodo) } })
        : [],
      cedulas.length
        ? this.estudianteRepository.find({
            where: [
              { cedula: In(cedulas) },
              { correoInstitucional: In(correos) },
            ],
          })
        : [],
      this.planAsignaturaRepository.find({
        where: { planEstudioId: dto.planEstudioId, activo: true },
        relations: { curso: true },
      }),
    ]);
    const existentesIds = estudiantes.map((item) => item.id);
    const historiales = existentesIds.length
      ? await this.historialRepository.find({
          where: {
            estudianteId: In(existentesIds),
            resultado: ResultadoAcademico.APROBADO,
          },
          relations: { planAsignatura: true },
        })
      : [];
    const periodosPorCodigo = new Map(
      periodos.map((item) => [this.normalizarCodigo(item.codigo), item]),
    );
    const porCedula = new Map(estudiantes.map((item) => [item.cedula, item]));
    const porCorreo = new Map(
      estudiantes.map((item) => [item.correoInstitucional.toLowerCase(), item]),
    );
    const conteoCedulas = this.contar(cedulas);
    const conteoCorreos = this.contar(correos);
    const resolucion = this.crearResolucionAsignaturas(asignaturas);

    return normalizadas.map((fila): FilaValidada => {
      const errores: string[] = [];
      const existente = porCedula.get(fila.cedula);
      const existentePorCorreo = porCorreo.get(fila.datos.correoInstitucional);
      const periodo = periodosPorCodigo.get(fila.periodoIngresoCodigo);
      if ((conteoCedulas.get(fila.cedula) ?? 0) > 1)
        errores.push('La cédula está repetida dentro del archivo.');
      if ((conteoCorreos.get(fila.datos.correoInstitucional) ?? 0) > 1)
        errores.push(
          'El correo institucional está repetido dentro del archivo.',
        );
      if (!periodo) errores.push('El código del período de ingreso no existe.');
      if (existentePorCorreo && existentePorCorreo.cedula !== fila.cedula)
        errores.push('El correo institucional pertenece a otra cédula.');
      if (
        existente &&
        (existente.carreraId !== dto.carreraId ||
          existente.planEstudioId !== dto.planEstudioId)
      ) {
        errores.push(
          'El estudiante ya pertenece a otra carrera o plan; requiere revisión manual.',
        );
      }
      if (existente && periodo && existente.periodoIngresoId !== periodo.id)
        errores.push(
          'El período de ingreso difiere del registrado; requiere revisión manual.',
        );

      const codigosVistos = new Set<string>();
      const candidatas: AprobacionResuelta[] = [];
      for (const codigo of fila.asignaturasAprobadas) {
        if (codigosVistos.has(codigo)) {
          errores.push(`La asignatura aprobada ${codigo} está repetida.`);
          continue;
        }
        codigosVistos.add(codigo);
        const coincidencias = resolucion.get(codigo) ?? [];
        if (!coincidencias.length) {
          errores.push(`La asignatura ${codigo} no pertenece al plan.`);
        } else if (coincidencias.length > 1) {
          errores.push(`La asignatura ${codigo} es ambigua dentro del plan.`);
        } else {
          candidatas.push({ codigo, planAsignaturaId: coincidencias[0].id });
        }
      }

      const aprobadasEstudiante = existente
        ? historiales.filter((item) => item.estudianteId === existente.id)
        : [];
      const aprobacionesNuevas = candidatas.filter((candidata) => {
        const asignatura = asignaturas.find(
          (item) => item.id === candidata.planAsignaturaId,
        )!;
        return !aprobadasEstudiante.some(
          (historial) =>
            historial.planAsignaturaId === asignatura.id ||
            (asignatura.cursoId !== null &&
              historial.planAsignatura?.cursoId === asignatura.cursoId),
        );
      });
      const camposPersonales = [
        'nombres',
        'apellido1',
        'apellido2',
        'correoInstitucional',
        'telefono',
      ] as const;
      const cambiosDatos: CambioDatoImportacion[] = existente
        ? camposPersonales
            .filter((campo) => (existente[campo] ?? null) !== fila.datos[campo])
            .map((campo) => ({
              campo,
              actual: existente[campo] ?? null,
              nuevo: fila.datos[campo],
            }))
        : [];
      const datosCambian = cambiosDatos.length > 0;
      const accion: AccionImportacionEstudiante = errores.length
        ? 'ERROR'
        : !existente
          ? 'CREAR'
          : datosCambian || aprobacionesNuevas.length
            ? 'ACTUALIZAR'
            : 'SIN_CAMBIOS';
      return {
        fila: fila.fila,
        cedula: fila.cedula,
        accion,
        errores,
        estudianteId: existente?.id ?? null,
        periodoIngresoId: periodo?.id ?? null,
        datos: fila.datos,
        cambiosDatos,
        aprobacionesNuevas,
      };
    });
  }

  private normalizarFila(fila: EstudianteImportacionFilaDto) {
    return {
      fila: fila.fila,
      cedula: fila.cedula.trim(),
      periodoIngresoCodigo: this.normalizarCodigo(fila.periodoIngresoCodigo),
      asignaturasAprobadas: fila.asignaturasAprobadas
        .map((codigo) => this.normalizarCodigo(codigo))
        .filter(Boolean),
      datos: {
        nombres: fila.nombres.trim(),
        apellido1: fila.apellido1.trim(),
        apellido2: fila.apellido2?.trim() || null,
        correoInstitucional: fila.correoInstitucional.trim().toLowerCase(),
        telefono: fila.telefono?.trim() || null,
      },
    };
  }

  private crearResolucionAsignaturas(asignaturas: PlanAsignatura[]) {
    const reales = new Map<string, PlanAsignatura[]>();
    const referencias = new Map<string, PlanAsignatura[]>();
    for (const asignatura of asignaturas) {
      if (asignatura.cursoId !== null && asignatura.curso?.codigo) {
        this.agregar(
          reales,
          this.normalizarCodigo(asignatura.curso.codigo),
          asignatura,
        );
      } else if (asignatura.codigoReferencia) {
        this.agregar(
          referencias,
          this.normalizarCodigo(asignatura.codigoReferencia),
          asignatura,
        );
      }
    }
    const resultado = new Map(referencias);
    for (const [codigo, coincidencias] of reales)
      resultado.set(codigo, coincidencias);
    return resultado;
  }

  private agregar(
    mapa: Map<string, PlanAsignatura[]>,
    codigo: string,
    asignatura: PlanAsignatura,
  ) {
    mapa.set(codigo, [...(mapa.get(codigo) ?? []), asignatura]);
  }

  private contar(valores: string[]) {
    const resultado = new Map<string, number>();
    for (const valor of valores)
      resultado.set(valor, (resultado.get(valor) ?? 0) + 1);
    return resultado;
  }

  private normalizarCodigo(valor: string) {
    return valor.trim().toUpperCase();
  }

  private resumir(filas: FilaValidada[]) {
    return {
      total: filas.length,
      crear: filas.filter((fila) => fila.accion === 'CREAR').length,
      actualizar: filas.filter((fila) => fila.accion === 'ACTUALIZAR').length,
      sinCambios: filas.filter((fila) => fila.accion === 'SIN_CAMBIOS').length,
      errores: filas.filter((fila) => fila.accion === 'ERROR').length,
      aprobacionesNuevas: filas.reduce(
        (total, fila) => total + fila.aprobacionesNuevas.length,
        0,
      ),
    };
  }

  private async guardarAprobacionImportada(
    repository: Repository<HistorialAcademicoEstudiante>,
    estudianteId: number,
    planAsignaturaId: number,
    usuarioId: number,
    fuente: FuenteRegistroAcademico,
  ) {
    await repository.save(
      repository.create(
        crearDatosResultadoImportado({
          estudianteId,
          planAsignaturaId,
          periodoId: null,
          resultado: ResultadoAcademico.APROBADO,
          fuenteRegistro: fuente,
          registradoPorUsuarioId: usuarioId,
        }),
      ),
    );
  }
}
