import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { GoogleFormsClientService } from '../integraciones/google/google-forms-client.service';
import { GoogleDriveClientService } from '../integraciones/google/google-drive-client.service';

@Injectable()
export class FormulariosEstudiantesService {
  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,
    private readonly googleFormsClient: GoogleFormsClientService,
    private readonly googleDriveClient: GoogleDriveClientService,
  ) {}

  // Lógica de creación de formularios a partir de PlanAsignatura y Cursos/Períodos,
  // consulta de alcance de carrera, guardado de snapshot mapaPreguntas y cierre de formularios.
}
