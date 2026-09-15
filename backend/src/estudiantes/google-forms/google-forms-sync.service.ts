import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstructuraAcademicaService } from '../../estructura-academica/estructura-academica.service';
import {
  EstudianteImportacionFilaDto,
  ImportarEstudiantesDto,
} from '../dto/importar-estudiantes.dto';
import { EstudiantesImportacionService } from '../estudiantes-importacion.service';
import { EstadoImportacionGoogle } from './constants/estado-importacion-google.constant';
import { RespuestaCrudaGoogleFormsDto } from './dto/sincronizar-google-forms.dto';
import { ConfiguracionFormularioEstudiantes } from './entities/configuracion-formulario-estudiantes.entity';
import { ImportacionGoogleEstudiante } from './entities/importacion-google-estudiante.entity';
import {
  ErrorNormalizacionGoogleForms,
  normalizarRespuestaGoogleForms,
} from './normalizador-google-forms';

@Injectable()
export class GoogleFormsSyncService {
  constructor(
    @InjectRepository(ConfiguracionFormularioEstudiantes)
    private readonly configuracionRepository: Repository<ConfiguracionFormularioEstudiantes>,
    @InjectRepository(ImportacionGoogleEstudiante)
    private readonly importacionRepository: Repository<ImportacionGoogleEstudiante>,
    private readonly estudiantesImportacionService: EstudiantesImportacionService,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
  ) {}

  async sincronizarRespuestasCrudas(
    usuarioId: number,
    configuracionId: number,
    respuestas: RespuestaCrudaGoogleFormsDto[],
  ) {
    const config = await this.configuracionRepository.findOne({
      where: { id: configuracionId },
      relations: { carrera: true, planEstudio: true },
    });

    if (!config) {
      throw new NotFoundException('La configuración de formulario no existe.');
    }
    if (!config.activo) {
      throw new BadRequestException(
        'La configuración de formulario se encuentra inactiva.',
      );
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        config.carreraId,
      );
    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera configurada.',
      );
    }

    if (!respuestas || !respuestas.length) {
      return {
        configuracionId: config.id,
        totalRecibidas: 0,
        procesadas: 0,
        creados: 0,
        actualizados: 0,
        sinCambios: 0,
        errores: 0,
        filas: [],
      };
    }

    // 1. Guardar en bandeja de entrada (PENDIENTE) e intentar normalizar
    const filasParaImportador: EstudianteImportacionFilaDto[] = [];
    const registrosBandeja = new Map<number, ImportacionGoogleEstudiante>();
    const resultadosFilas: Array<{
      filaOrigen: number;
      estado: EstadoImportacionGoogle;
      error: string | null;
      cedula?: string;
      accion?: string;
    }> = [];

    let mayorFilaProcesada = config.ultimaFilaProcesada;

    for (const respuesta of respuestas) {
      const registro = await this.importacionRepository.save(
        this.importacionRepository.create({
          configuracionId: config.id,
          identificadorExterno: respuesta.identificadorExterno ?? null,
          filaOrigen: respuesta.filaOrigen,
          payload: respuesta.payload,
          estado: EstadoImportacionGoogle.PENDIENTE,
          error: null,
        }),
      );

      if (respuesta.filaOrigen > mayorFilaProcesada) {
        mayorFilaProcesada = respuesta.filaOrigen;
      }

      try {
        const normalizado = normalizarRespuestaGoogleForms(
          respuesta.payload,
          respuesta.filaOrigen,
        );
        filasParaImportador.push(normalizado);
        registrosBandeja.set(respuesta.filaOrigen, registro);
      } catch (err) {
        const mensajeError =
          err instanceof ErrorNormalizacionGoogleForms || err instanceof Error
            ? err.message
            : 'Error desconocido al interpretar la respuesta del formulario.';

        registro.estado = EstadoImportacionGoogle.ERROR;
        registro.error = mensajeError;
        registro.processedAt = new Date();
        await this.importacionRepository.save(registro);

        resultadosFilas.push({
          filaOrigen: respuesta.filaOrigen,
          estado: EstadoImportacionGoogle.ERROR,
          error: mensajeError,
        });
      }
    }

    // 2. Si hay filas normalizadas con éxito, delegar en EstudiantesImportacionService
    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    let errores = resultadosFilas.length;

    if (filasParaImportador.length > 0) {
      const dtoImportacion: ImportarEstudiantesDto = {
        carreraId: config.carreraId,
        planEstudioId: config.planEstudioId,
        estudiantes: filasParaImportador,
      };

      const resultadoAcademico =
        await this.estudiantesImportacionService.ejecutar(
          usuarioId,
          dtoImportacion,
        );

      creados = resultadoAcademico.creados;
      actualizados = resultadoAcademico.actualizados;
      sinCambios = resultadoAcademico.sinCambios;
      errores += resultadoAcademico.errores;

      for (const filaResultado of resultadoAcademico.filas) {
        const registro = registrosBandeja.get(filaResultado.fila);
        if (!registro) continue;

        if (
          filaResultado.accion === 'CREAR' ||
          filaResultado.accion === 'ACTUALIZAR'
        ) {
          registro.estado = EstadoImportacionGoogle.PROCESADO;
          registro.error = null;
        } else if (filaResultado.accion === 'SIN_CAMBIOS') {
          registro.estado = EstadoImportacionGoogle.DUPLICADO;
          registro.error = null;
        } else {
          registro.estado = EstadoImportacionGoogle.ERROR;
          registro.error = filaResultado.errores.join('; ');
        }

        registro.processedAt = new Date();
        await this.importacionRepository.save(registro);

        resultadosFilas.push({
          filaOrigen: filaResultado.fila,
          estado: registro.estado,
          error: registro.error,
          cedula: filaResultado.cedula,
          accion: filaResultado.accion,
        });
      }
    }

    // 3. Actualizar la última fila procesada en la configuración
    if (mayorFilaProcesada > config.ultimaFilaProcesada) {
      config.ultimaFilaProcesada = mayorFilaProcesada;
      await this.configuracionRepository.save(config);
    }

    return {
      configuracionId: config.id,
      totalRecibidas: respuestas.length,
      procesadas: creados + actualizados,
      creados,
      actualizados,
      sinCambios,
      errores,
      ultimaFilaProcesada: config.ultimaFilaProcesada,
      filas: resultadosFilas.sort((a, b) => a.filaOrigen - b.filaOrigen),
    };
  }
}
