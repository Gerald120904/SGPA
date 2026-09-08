import { IsInt, Min } from 'class-validator';

export class SolicitarPerfilProfesorDto {
  @IsInt()
  @Min(1)
  perfilAcademicoId!: number;
}
