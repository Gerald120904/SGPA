import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { EstudiantesImportacionService } from '../estudiantes/estudiantes-importacion.service';
import { ImportarEstudiantesDto } from '../estudiantes/dto/importar-estudiantes.dto';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';

export interface ResultadoAprobacionRespuesta {
  respuestaId: number;
  estado: EstadoRespuestaFormulario;
  creados: number;
  actualizados: number;
  aprobacionesNuevas: number;
}

@Injectable()
export class FormulariosEstudiantesProcesamientoService {
  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,

    @InjectRepository(RespuestaFormularioEstudiante)
    private readonly respuestaRepo: Repository<RespuestaFormularioEstudiante>,

    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepo: Repository<PeriodoAcademico>,

    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepo: Repository<PlanAsignatura>,

    private readonly estudiantesImportacionService: EstudiantesImportacionService,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
  ) {}

  async listarSolicitudes(usuarioId: number): Promise<RespuestaFormularioEstudiante[]> {
    const carrerasPermitidas =
      await this.estructuraAcademicaService.obtenerCarreraIdsConAlcance(
        usuarioId,
      );

    if (carrerasPermitidas.length === 0) {
      return [];
    }

    return await this.respuestaRepo.find({
      where: {
        estado: In([
          EstadoRespuestaFormulario.PENDIENTE,
          EstadoRespuestaFormulario.REQUIERE_REVISION,
        ]),
        formulario: {
          carreraId: In(carrerasPermitidas),
        },
      },
      relations: {
        formulario: {
          carrera: true,
          planEstudio: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async aprobarRespuesta(
    respuestaId: number,
    usuarioId: number,
  ): Promise<ResultadoAprobacionRespuesta> {
    const respuesta = await this.respuestaRepo.findOne({
      where: {
        id: respuestaId,
      },
      relations: {
        formulario: true,
      },
    });

    if (!respuesta) {
      throw new NotFoundException('La solicitud indicada no existe.');
    }

    if (
      ![
        EstadoRespuestaFormulario.PENDIENTE,
        EstadoRespuestaFormulario.REQUIERE_REVISION,
      ].includes(respuesta.estado)
    ) {
      throw new ConflictException('Esta solicitud ya fue revisada.');
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        respuesta.formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }

    const datos = respuesta.datosNormalizadosJson;

    if (!datos) {
      respuesta.estado = EstadoRespuestaFormulario.ERROR;
      respuesta.detalleError = 'La respuesta no posee datos normalizados.';
      await this.respuestaRepo.save(respuesta);
      throw new ConflictException(respuesta.detalleError);
    }

    const periodo = await this.periodoRepo.findOne({
      where: {
        id: datos.periodoIngresoId,
      },
    });

    if (!periodo) {
      respuesta.estado = EstadoRespuestaFormulario.REQUIERE_REVISION;
      respuesta.detalleError =
        'El período de ingreso asociado a la respuesta ya no existe.';
      await this.respuestaRepo.save(respuesta);
      throw new ConflictException(respuesta.detalleError);
    }

    const idsAsignaturas = datos.asignaturasAprobadas.map(
      (item) => item.planAsignaturaId,
    );

    const asignaturas = idsAsignaturas.length
      ? await this.planAsignaturaRepo.find({
          where: {
            id: In(idsAsignaturas),
          },
          relations: {
            curso: true,
          },
        })
      : [];

    const codigosCursos: string[] = [];
    const erroresAsignaturas: string[] = [];

    for (const aprobada of datos.asignaturasAprobadas) {
      const actual = asignaturas.find(
        (item) => item.id === aprobada.planAsignaturaId,
      );

      if (!actual) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} ya no existe.`,
        );
        continue;
      }

      if (actual.planEstudioId !== respuesta.formulario.planEstudioId) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} ya no pertenece al plan del formulario.`,
        );
        continue;
      }

      if (actual.cursoId === null || actual.curso === null) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} ya no posee un curso asociado.`,
        );
        continue;
      }

      if (actual.cursoId !== aprobada.cursoId) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} cambió su curso asociado.`,
        );
        continue;
      }

      codigosCursos.push(actual.curso.codigo);
    }

    if (erroresAsignaturas.length > 0) {
      respuesta.estado = EstadoRespuestaFormulario.REQUIERE_REVISION;
      respuesta.detalleError = erroresAsignaturas.join(' ');
      await this.respuestaRepo.save(respuesta);
      throw new ConflictException(respuesta.detalleError);
    }

    const nombres = [datos.primerNombre, datos.segundoNombre]
      .filter((valor): valor is string => Boolean(valor?.trim()))
      .join(' ');

    const dto: ImportarEstudiantesDto = {
      carreraId: respuesta.formulario.carreraId,
      planEstudioId: respuesta.formulario.planEstudioId,
      estudiantes: [
        {
          fila: 2,
          cedula: datos.identificacion,
          nombres,
          apellido1: datos.primerApellido,
          apellido2: datos.segundoApellido,
          correoInstitucional: datos.correoEstudiantil,
          telefono: datos.contacto,
          periodoIngresoCodigo: periodo.codigo,
          asignaturasAprobadas: codigosCursos,
        },
      ],
    };

    const resultado =
      await this.estudiantesImportacionService.ejecutarDesdeGoogleForms(
        usuarioId,
        dto,
      );

    const fila = resultado.filas[0];

    if (!fila || fila.accion === 'ERROR') {
      respuesta.estado = EstadoRespuestaFormulario.REQUIERE_REVISION;
      respuesta.detalleError =
        fila?.errores.join(' ') || 'La respuesta requiere revisión manual.';
      await this.respuestaRepo.save(respuesta);
      throw new ConflictException(respuesta.detalleError);
    }

    respuesta.estado = EstadoRespuestaFormulario.PROCESADO;
    respuesta.revisadoPorUsuarioId = usuarioId;
    respuesta.revisadoAt = new Date();
    respuesta.procesadoAt = new Date();
    respuesta.motivoRechazo = null;
    respuesta.detalleError = null;

    await this.respuestaRepo.save(respuesta);

    return {
      respuestaId: respuesta.id,
      estado: respuesta.estado,
      creados: resultado.creados,
      actualizados: resultado.actualizados,
      aprobacionesNuevas: resultado.aprobacionesNuevas,
    };
  }

  async rechazarRespuesta(
    respuestaId: number,
    usuarioId: number,
    motivo?: string,
  ): Promise<RespuestaFormularioEstudiante> {
    const respuesta = await this.respuestaRepo.findOne({
      where: {
        id: respuestaId,
      },
      relations: {
        formulario: true,
      },
    });

    if (!respuesta) {
      throw new NotFoundException('La solicitud indicada no existe.');
    }

    if (
      ![
        EstadoRespuestaFormulario.PENDIENTE,
        EstadoRespuestaFormulario.REQUIERE_REVISION,
      ].includes(respuesta.estado)
    ) {
      throw new ConflictException('Esta solicitud ya fue revisada.');
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        respuesta.formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }

    respuesta.estado = EstadoRespuestaFormulario.RECHAZADO;
    respuesta.revisadoPorUsuarioId = usuarioId;
    respuesta.revisadoAt = new Date();
    respuesta.motivoRechazo = motivo?.trim() || null;
    respuesta.procesadoAt = null;

    await this.respuestaRepo.save(respuesta);

    return respuesta;
  }
}
