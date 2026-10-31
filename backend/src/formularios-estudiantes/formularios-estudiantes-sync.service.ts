import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { GoogleFormsClientService } from '../integraciones/google/google-forms-client.service';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { esInstantaneaCurricularInterna } from './types/instantanea-curricular-interna.type';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { NormalizadorRespuestaFormularioService } from './normalizador-respuesta-formulario.service';
import { ResultadoSincronizacionFormulario } from './types/resultado-sincronizacion-formulario.type';

export type { ResultadoSincronizacionFormulario };

@Injectable()
export class FormulariosEstudiantesSyncService {
  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,

    @InjectRepository(RespuestaFormularioEstudiante)
    private readonly respuestaRepo: Repository<RespuestaFormularioEstudiante>,

    private readonly googleFormsClient: GoogleFormsClientService,
    private readonly normalizador: NormalizadorRespuestaFormularioService,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
  ) {}

  async sincronizar(
    formularioId: number,
    usuarioId: number,
  ): Promise<ResultadoSincronizacionFormulario> {
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
        'No posee alcance académico sobre la carrera del formulario.',
      );
    }

    return this.sincronizarFormulario(formulario);
  }

  async sincronizarFormulario(
    formulario: FormularioEstudiante,
  ): Promise<ResultadoSincronizacionFormulario> {
    if (formulario.proveedor === ProveedorFormulario.INTERNO) {
      throw new BadRequestException(
        'Los formularios internos no requieren sincronización externa con Google Forms.',
      );
    }

    if (!formulario.googleFormId || !formulario.mapaPreguntas ||
        esInstantaneaCurricularInterna(formulario.mapaPreguntas)) {
      throw new BadRequestException(
        'El formulario no posee una configuración válida de Google Forms',
      );
    }

    const respuestasGoogle = await this.googleFormsClient.listarRespuestas(
      formulario.creadoPorUsuarioId,
      formulario.googleFormId,
    );

    let nuevas = 0;
    let ignoradasExistentes = 0;
    let pendientes = 0;
    let requierenRevision = 0;
    let errores = 0;

    for (const respuesta of respuestasGoogle) {
      if (!respuesta.responseId) {
        errores++;
        continue;
      }

      const existente = await this.respuestaRepo.findOne({
        where: {
          formularioId: formulario.id,
          googleResponseId: respuesta.responseId,
        },
      });

      if (existente) {
        ignoradasExistentes++;
        continue;
      }

      try {
        const datos = this.normalizador.normalizar(
          respuesta,
          formulario.mapaPreguntas,
        );

        const requiereRevision = datos.requiereRevisionOptativas;

        const entidad = this.respuestaRepo.create({
          formularioId: formulario.id,
          googleResponseId: respuesta.responseId,
          payloadJson: respuesta as unknown as Record<string, unknown>,
          datosNormalizadosJson: datos,
          estado: requiereRevision
            ? EstadoRespuestaFormulario.REQUIERE_REVISION
            : EstadoRespuestaFormulario.PENDIENTE,
          detalleError: null,
          optativasNoDisciplinarias: datos.optativasNoDisciplinarias,
          procesadoAt: null,
        });

        await this.respuestaRepo.save(entidad);

        nuevas++;

        if (requiereRevision) {
          requierenRevision++;
        } else {
          pendientes++;
        }
      } catch (error) {
        const entidad = this.respuestaRepo.create({
          formularioId: formulario.id,
          googleResponseId: respuesta.responseId,
          payloadJson: respuesta as unknown as Record<string, unknown>,
          datosNormalizadosJson: null,
          estado: EstadoRespuestaFormulario.ERROR,
          detalleError:
            error instanceof Error
              ? error.message
              : 'Error desconocido al normalizar la respuesta',
          optativasNoDisciplinarias: null,
          procesadoAt: null,
        });

        await this.respuestaRepo.save(entidad);

        nuevas++;
        errores++;
      }
    }

    formulario.ultimaSincronizacionAt = new Date();
    await this.formularioRepo.save(formulario);

    return {
      recibidasGoogle: respuestasGoogle.length,
      nuevas,
      ignoradasExistentes,
      pendientes,
      requierenRevision,
      errores,
    };
  }

  async listarRespuestas(
    formularioId: number,
    usuarioId: number,
  ): Promise<RespuestaFormularioEstudiante[]> {
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
        'No posee alcance académico sobre la carrera del formulario.',
      );
    }

    const respuestas = await this.respuestaRepo.find({
      where: {
        formularioId,
      },
      relations: {
        revisadoPor: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    this.enriquecerNombresAsignaturas(respuestas, formulario);

    return respuestas;
  }

  private enriquecerNombresAsignaturas(
    respuestas: RespuestaFormularioEstudiante[],
    formulario: FormularioEstudiante,
  ): void {
    if (!respuestas || respuestas.length === 0) return;

    const nombresPorCodigo = new Map<string, string>();
    const nombresPorPlanAsigId = new Map<number, string>();

    const mapa = formulario.mapaPreguntas;
    if (esInstantaneaCurricularInterna(mapa)) {
      for (const asig of mapa.asignaturas) {
        if (asig.nombre) {
          nombresPorCodigo.set(asig.codigo, asig.nombre);
          nombresPorPlanAsigId.set(asig.id, asig.nombre);
        }
      }
    } else if (mapa && typeof mapa === 'object' && 'asignaturasAprobadas' in mapa) {
      const mapaAny = mapa as any;
      if (Array.isArray(mapaAny.asignaturasAprobadas?.grupos)) {
        for (const grupo of mapaAny.asignaturasAprobadas.grupos) {
          if (grupo.opciones) {
            for (const [etiqueta, opt] of Object.entries(grupo.opciones as Record<string, any>)) {
              let nombre = opt.nombre;
              if (!nombre && etiqueta.includes(' - ')) {
                nombre = etiqueta.split(' - ').slice(1).join(' - ').trim();
              }
              if (nombre) {
                if (opt.codigo) nombresPorCodigo.set(opt.codigo, nombre);
                if (opt.planAsignaturaId) nombresPorPlanAsigId.set(opt.planAsignaturaId, nombre);
              }
            }
          }
        }
      }
    }

    for (const resp of respuestas) {
      const asignaturas = resp.datosNormalizadosJson?.asignaturasAprobadas;
      if (Array.isArray(asignaturas)) {
        for (const asig of asignaturas) {
          if (asig && typeof asig === 'object' && !asig.nombre) {
            asig.nombre =
              nombresPorPlanAsigId.get(asig.planAsignaturaId) ||
              nombresPorCodigo.get(asig.codigo) ||
              undefined;
          }
        }
      }
    }
  }
}
