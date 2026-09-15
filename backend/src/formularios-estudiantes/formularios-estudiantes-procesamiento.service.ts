import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { EstudiantesImportacionService } from '../estudiantes/estudiantes-importacion.service';
import { ImportarEstudiantesDto } from '../estudiantes/dto/importar-estudiantes.dto';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { ResultadoProcesamientoFormulario } from './types/resultado-procesamiento-formulario.type';

export type { ResultadoProcesamientoFormulario };

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

  async procesar(
    formularioId: number,
    usuarioId: number,
  ): Promise<ResultadoProcesamientoFormulario> {
    const formulario = await this.formularioRepo.findOne({
      where: {
        id: formularioId,
      },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario indicado no existe');
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }

    const respuestas = await this.respuestaRepo.find({
      where: [
        {
          formularioId: formulario.id,
          estado: EstadoRespuestaFormulario.PENDIENTE,
          procesadoAt: IsNull(),
        },
        {
          formularioId: formulario.id,
          estado: EstadoRespuestaFormulario.REQUIERE_REVISION,
          procesadoAt: IsNull(),
        },
      ],
      order: {
        createdAt: 'ASC',
      },
    });

    let procesadas = 0;
    const omitidasYaProcesadas = 0;
    let requierenRevision = 0;
    let errores = 0;
    let estudiantesCreados = 0;
    let estudiantesActualizados = 0;
    let aprobacionesNuevas = 0;

    for (const respuesta of respuestas) {
      try {
        const datos = respuesta.datosNormalizadosJson;

        if (!datos) {
          respuesta.estado = EstadoRespuestaFormulario.ERROR;
          respuesta.detalleError = 'La respuesta no posee datos normalizados.';
          await this.respuestaRepo.save(respuesta);
          errores++;
          continue;
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
          requierenRevision++;
          continue;
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

          if (actual.planEstudioId !== formulario.planEstudioId) {
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
          requierenRevision++;
          continue;
        }

        const nombres = [datos.primerNombre, datos.segundoNombre]
          .filter((valor): valor is string => Boolean(valor?.trim()))
          .join(' ');

        const dto: ImportarEstudiantesDto = {
          carreraId: formulario.carreraId,
          planEstudioId: formulario.planEstudioId,
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
          respuesta.procesadoAt = null;
          await this.respuestaRepo.save(respuesta);
          requierenRevision++;
          continue;
        }

        if (datos.requiereRevisionOptativas) {
          respuesta.estado = EstadoRespuestaFormulario.REQUIERE_REVISION;
        } else {
          respuesta.estado = EstadoRespuestaFormulario.PROCESADO;
        }

        respuesta.procesadoAt = new Date();
        respuesta.detalleError = null;
        await this.respuestaRepo.save(respuesta);

        procesadas++;
        estudiantesCreados += resultado.creados;
        estudiantesActualizados += resultado.actualizados;
        aprobacionesNuevas += resultado.aprobacionesNuevas;

        if (datos.requiereRevisionOptativas) {
          requierenRevision++;
        }
      } catch (error) {
        respuesta.estado = EstadoRespuestaFormulario.ERROR;
        respuesta.detalleError =
          error instanceof Error
            ? error.message
            : 'Error desconocido al procesar la respuesta';
        respuesta.procesadoAt = null;
        await this.respuestaRepo.save(respuesta);
        errores++;
      }
    }

    return {
      candidatas: respuestas.length,
      procesadas,
      omitidasYaProcesadas,
      requierenRevision,
      errores,
      estudiantesCreados,
      estudiantesActualizados,
      aprobacionesNuevas,
    };
  }
}
