import { IsString, Length } from 'class-validator';

export class ActivarVersionPlanEstudioDto {
  @IsString() @Length(5, 500) motivo!: string;
}
