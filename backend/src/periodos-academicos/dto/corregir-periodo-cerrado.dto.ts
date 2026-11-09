import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ActualizarPeriodoAcademicoDto } from './actualizar-periodo-academico.dto';

export class CorregirPeriodoCerradoDto extends ActualizarPeriodoAcademicoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  motivo!: string;
}
