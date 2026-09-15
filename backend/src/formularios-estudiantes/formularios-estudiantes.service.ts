import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { forms_v1 } from 'googleapis';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { GoogleDriveClientService } from '../integraciones/google/google-drive-client.service';
import { GoogleFormsClientService } from '../integraciones/google/google-forms-client.service';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { MapaPreguntasFormulario } from './types/mapa-preguntas-formulario.type';

@Injectable()
export class FormulariosEstudiantesService {
  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,

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
          replies[indice]?.createItem?.questionId?.[0];

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
