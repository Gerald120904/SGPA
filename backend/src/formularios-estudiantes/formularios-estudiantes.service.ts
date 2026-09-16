import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { forms_v1 } from 'googleapis';
import { In, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { GoogleDriveClientService } from '../integraciones/google/google-drive-client.service';
import { GoogleFormsClientService } from '../integraciones/google/google-forms-client.service';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { MapaPreguntasFormulario } from './types/mapa-preguntas-formulario.type';

@Injectable()
export class FormulariosEstudiantesService {
  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,

    @InjectRepository(RespuestaFormularioEstudiante)
    private readonly respuestaRepo: Repository<RespuestaFormularioEstudiante>,

    @InjectRepository(Carrera)
    private readonly carreraRepo: Repository<Carrera>,

    @InjectRepository(PlanEstudio)
    private readonly planEstudioRepo: Repository<PlanEstudio>,

    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepo: Repository<PlanAsignatura>,

    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepo: Repository<PeriodoAcademico>,

    private readonly googleFormsClient: GoogleFormsClientService,
    private readonly googleDriveClient: GoogleDriveClientService,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
  ) {}

  async listar(usuarioId: number) {
    const carrerasPermitidas =
      await this.estructuraAcademicaService.obtenerCarreraIdsConAlcance(
        usuarioId,
      );

    if (carrerasPermitidas.length === 0) {
      return [];
    }

    const formularios = await this.formularioRepo.find({
      where: {
        carreraId: In(carrerasPermitidas),
      },
      relations: {
        carrera: true,
        planEstudio: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (formularios.length === 0) {
      return [];
    }

    const formularioIds = formularios.map((f) => f.id);

    const conteosMap = new Map<
      number,
      {
        totalRespuestas: number;
        pendientes: number;
        procesadas: number;
        requierenRevision: number;
        errores: number;
      }
    >();

    for (const id of formularioIds) {
      conteosMap.set(id, {
        totalRespuestas: 0,
        pendientes: 0,
        procesadas: 0,
        requierenRevision: 0,
        errores: 0,
      });
    }

    const rawCounts = await this.respuestaRepo
      .createQueryBuilder('r')
      .select('r.formularioId', 'formularioId')
      .addSelect('r.estado', 'estado')
      .addSelect('COUNT(r.id)', 'cantidad')
      .where('r.formularioId IN (:...formularioIds)', { formularioIds })
      .groupBy('r.formularioId')
      .addGroupBy('r.estado')
      .getRawMany();

    for (const row of rawCounts) {
      const formId = Number(row.formularioId);
      const estado = row.estado as EstadoRespuestaFormulario;
      const count = Number(row.cantidad);
      const c = conteosMap.get(formId);

      if (c) {
        c.totalRespuestas += count;
        if (estado === EstadoRespuestaFormulario.PENDIENTE) {
          c.pendientes += count;
        } else if (estado === EstadoRespuestaFormulario.PROCESADO) {
          c.procesadas += count;
        } else if (estado === EstadoRespuestaFormulario.REQUIERE_REVISION) {
          c.requierenRevision += count;
        } else if (estado === EstadoRespuestaFormulario.ERROR) {
          c.errores += count;
        }
      }
    }

    return formularios.map((formulario) => {
      const c = conteosMap.get(formulario.id) ?? {
        totalRespuestas: 0,
        pendientes: 0,
        procesadas: 0,
        requierenRevision: 0,
        errores: 0,
      };

      const { mapaPreguntas: _mapa, ...resto } = formulario;

      return {
        ...resto,
        totalRespuestas: c.totalRespuestas,
        pendientes: c.pendientes,
        procesadas: c.procesadas,
        requierenRevision: c.requierenRevision,
        errores: c.errores,
      };
    });
  }

  async obtenerPorId(id: number, usuarioId: number) {
    const formulario = await this.formularioRepo.findOne({
      where: { id },
      relations: {
        carrera: true,
        planEstudio: true,
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

    const rawCounts = await this.respuestaRepo
      .createQueryBuilder('r')
      .select('r.estado', 'estado')
      .addSelect('COUNT(r.id)', 'cantidad')
      .where('r.formularioId = :id', { id })
      .groupBy('r.estado')
      .getRawMany();

    const conteos = {
      totalRespuestas: 0,
      pendientes: 0,
      procesadas: 0,
      requierenRevision: 0,
      errores: 0,
    };

    for (const row of rawCounts) {
      const estado = row.estado as EstadoRespuestaFormulario;
      const count = Number(row.cantidad);
      conteos.totalRespuestas += count;

      if (estado === EstadoRespuestaFormulario.PENDIENTE) {
        conteos.pendientes += count;
      } else if (estado === EstadoRespuestaFormulario.PROCESADO) {
        conteos.procesadas += count;
      } else if (estado === EstadoRespuestaFormulario.REQUIERE_REVISION) {
        conteos.requierenRevision += count;
      } else if (estado === EstadoRespuestaFormulario.ERROR) {
        conteos.errores += count;
      }
    }

    return {
      ...formulario,
      ...conteos,
    };
  }

  async cerrar(id: number, usuarioId: number): Promise<FormularioEstudiante> {
    const formulario = await this.formularioRepo.findOne({
      where: { id },
      relations: {
        carrera: true,
        planEstudio: true,
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

    if (formulario.estado === EstadoFormularioEstudiante.CERRADO) {
      return formulario;
    }

    if (formulario.estado !== EstadoFormularioEstudiante.PUBLICADO) {
      throw new BadRequestException(
        `No se puede cerrar un formulario en estado ${formulario.estado}. Solo formularios PUBLICADOS pueden ser cerrados.`,
      );
    }

    if (!formulario.googleFormId) {
      throw new BadRequestException(
        'El formulario no posee un identificador de Google Forms asociado.',
      );
    }

    await this.googleFormsClient.cerrarFormulario(
      formulario.creadoPorUsuarioId,
      formulario.googleFormId,
    );

    formulario.estado = EstadoFormularioEstudiante.CERRADO;
    return await this.formularioRepo.save(formulario);
  }

  async crear(
    usuarioId: number,
    dto: CrearFormularioEstudianteDto,
  ): Promise<FormularioEstudiante> {
    const carrera = await this.carreraRepo.findOne({
      where: {
        id: dto.carreraId,
        activo: true,
      },
    });

    if (!carrera) {
      throw new NotFoundException(
        'La carrera indicada no existe o está inactiva',
      );
    }

    const plan = await this.planEstudioRepo.findOne({
      where: {
        id: dto.planEstudioId,
        carreraId: dto.carreraId,
        activo: true,
      },
    });

    if (!plan) {
      throw new BadRequestException(
        'El plan de estudio no pertenece a la carrera o está inactivo',
      );
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        dto.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }

    const planAsignaturas = await this.planAsignaturaRepo.find({
      where: {
        planEstudioId: plan.id,
        activo: true,
      },
      relations: {
        curso: true,
      },
      order: {
        nivel: 'ASC',
        ciclo: 'ASC',
        orden: 'ASC',
      },
    });

    const asignaturasConCurso = planAsignaturas.filter(
      (item) => item.cursoId !== null && item.curso !== null,
    );

    if (asignaturasConCurso.length === 0) {
      throw new BadRequestException(
        'El plan de estudio no posee asignaturas asociadas a cursos',
      );
    }

    const periodos = await this.periodoRepo.find({
      order: {
        anio: 'DESC',
        ciclo: 'DESC',
      },
    });

    if (periodos.length === 0) {
      throw new BadRequestException(
        'No existen períodos académicos registrados',
      );
    }

    let formulario = this.formularioRepo.create({
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      carreraId: carrera.id,
      planEstudioId: plan.id,
      googleFormId: null,
      responderUri: null,
      estado: EstadoFormularioEstudiante.CREANDO,
      mapaPreguntas: null,
      ultimaSincronizacionAt: null,
      creadoPorUsuarioId: usuarioId,
      detalleError: null,
    });

    formulario = await this.formularioRepo.save(formulario);

    const opcionesPeriodo = new Map<string, number>();

    for (const periodo of periodos) {
      const etiqueta = `${periodo.codigo} - ${periodo.nombre}`;
      opcionesPeriodo.set(etiqueta, periodo.id);
    }

    const opcionesAsignaturas = new Map<
      string,
      {
        planAsignaturaId: number;
        cursoId: number;
        codigo: string;
      }
    >();

    for (const asignatura of asignaturasConCurso) {
      const curso = asignatura.curso!;
      const etiqueta = `${curso.codigo} - ${curso.nombre}`;

      if (!opcionesAsignaturas.has(etiqueta)) {
        opcionesAsignaturas.set(etiqueta, {
          planAsignaturaId: asignatura.id,
          cursoId: asignatura.cursoId!,
          codigo: curso.codigo,
        });
      }
    }

    const requests: forms_v1.Schema$Request[] = [
      {
        updateFormInfo: {
          info: {
            description: dto.descripcion,
          },
          updateMask: 'description',
        },
      },

      this.crearPreguntaTexto(
        'Primer nombre',
        true,
        0,
      ),

      this.crearPreguntaTexto(
        'Segundo nombre',
        false,
        1,
      ),

      this.crearPreguntaTexto(
        'Primer apellido',
        true,
        2,
      ),

      this.crearPreguntaTexto(
        'Segundo apellido',
        false,
        3,
      ),

      this.crearPreguntaTexto(
        'Número de identificación',
        true,
        4,
      ),

      this.crearPreguntaTexto(
        'Correo estudiantil',
        true,
        5,
      ),

      this.crearPreguntaTexto(
        'Número de contacto',
        false,
        6,
      ),

      this.crearPreguntaSeleccion(
        'Período de ingreso',
        'DROP_DOWN',
        [...opcionesPeriodo.keys()],
        true,
        7,
      ),

      this.crearPreguntaSeleccion(
        '¿Cuáles asignaturas ha aprobado?',
        'CHECKBOX',
        [...opcionesAsignaturas.keys()],
        false,
        8,
      ),

      this.crearPreguntaTexto(
        '¿Cuál o cuáles optativas no disciplinarias ha llevado?',
        false,
        9,
        true,
      ),
    ];

    try {
      const googleForm = await this.googleFormsClient.crearFormulario(
        usuarioId,
        dto.titulo,
        dto.descripcion,
      );

      const googleFormId = googleForm.formId!;

      formulario.googleFormId = googleFormId;
      formulario = await this.formularioRepo.save(formulario);

      const actualizacion = await this.googleFormsClient.actualizarFormulario(
        usuarioId,
        googleFormId,
        requests,
      );

      const replies = actualizacion.replies ?? [];

      if (replies.length !== requests.length) {
        throw new InternalServerErrorException(
          'Google no devolvió todos los identificadores de las preguntas',
        );
      }

      const obtenerQuestionId = (indice: number): string => {
        const questionId =
          replies[indice + 1]?.createItem?.questionId?.[0];

        if (!questionId) {
          throw new InternalServerErrorException(
            `Google no devolvió el questionId de la pregunta ${indice}`,
          );
        }

        return questionId;
      };

      const mapaPreguntas: MapaPreguntasFormulario = {
        primerNombre: {
          questionId: obtenerQuestionId(0),
        },

        segundoNombre: {
          questionId: obtenerQuestionId(1),
        },

        primerApellido: {
          questionId: obtenerQuestionId(2),
        },

        segundoApellido: {
          questionId: obtenerQuestionId(3),
        },

        identificacion: {
          questionId: obtenerQuestionId(4),
        },

        correoEstudiantil: {
          questionId: obtenerQuestionId(5),
        },

        contacto: {
          questionId: obtenerQuestionId(6),
        },

        periodoIngreso: {
          questionId: obtenerQuestionId(7),
          opciones: Object.fromEntries(opcionesPeriodo),
        },

        asignaturasAprobadas: {
          questionId: obtenerQuestionId(8),
          opciones: Object.fromEntries(opcionesAsignaturas),
        },

        optativasNoDisciplinarias: {
          questionId: obtenerQuestionId(9),
        },
      };

      await this.googleDriveClient.permitirCualquieraConEnlaceResponder(
        usuarioId,
        googleFormId,
      );

      await this.googleFormsClient.publicarFormulario(
        usuarioId,
        googleFormId,
      );

      const formularioGoogle =
        await this.googleFormsClient.obtenerFormulario(
          usuarioId,
          googleFormId,
        );

      if (!formularioGoogle.responderUri) {
        throw new InternalServerErrorException(
          'Google no devolvió la URL para responder el formulario',
        );
      }

      formulario.mapaPreguntas = mapaPreguntas;
      formulario.responderUri = formularioGoogle.responderUri;
      formulario.estado = EstadoFormularioEstudiante.PUBLICADO;
      formulario.detalleError = null;

      return await this.formularioRepo.save(formulario);
    } catch (error) {
      formulario.estado = EstadoFormularioEstudiante.ERROR;

      formulario.detalleError =
        error instanceof Error
          ? error.message
          : 'Error desconocido al crear el formulario';

      await this.formularioRepo.save(formulario);

      throw error;
    }
  }

  private crearPreguntaTexto(
    titulo: string,
    requerida: boolean,
    indice: number,
    parrafo = false,
  ): forms_v1.Schema$Request {
    return {
      createItem: {
        item: {
          title: titulo,
          questionItem: {
            question: {
              required: requerida,
              textQuestion: {
                paragraph: parrafo,
              },
            },
          },
        },
        location: {
          index: indice,
        },
      },
    };
  }

  private crearPreguntaSeleccion(
    titulo: string,
    tipo: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN',
    opciones: string[],
    requerida: boolean,
    indice: number,
  ): forms_v1.Schema$Request {
    return {
      createItem: {
        item: {
          title: titulo,
          questionItem: {
            question: {
              required: requerida,
              choiceQuestion: {
                type: tipo,
                options: opciones.map((value) => ({ value })),
                shuffle: false,
              },
            },
          },
        },
        location: {
          index: indice,
        },
      },
    };
  }
}
