import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { GoogleFormsClientService } from '../integraciones/google/google-forms-client.service';
import { NormalizadorRespuestaFormularioService } from './normalizador-respuesta-formulario.service';
import { EstudiantesImportacionService } from '../estudiantes/estudiantes-importacion.service';

@Injectable()
export class FormulariosEstudiantesSyncService {
  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,
    @InjectRepository(RespuestaFormularioEstudiante)
    private readonly respuestaRepo: Repository<RespuestaFormularioEstudiante>,
    private readonly googleFormsClient: GoogleFormsClientService,
    private readonly normalizadorService: NormalizadorRespuestaFormularioService,
    private readonly estudiantesImportacionService: EstudiantesImportacionService,
  ) {}

  // Sincronización de respuestas desde Google Forms API hacia SGPA
}
