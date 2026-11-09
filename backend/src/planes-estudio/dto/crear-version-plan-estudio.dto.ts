import { IsString, Length } from 'class-validator';

export class CrearVersionPlanEstudioDto {
  @IsString() @Length(1, 40) codigo!: string;
  @IsString() @Length(1, 180) nombre!: string;
  @IsString() @Length(5, 500) motivo!: string;
}
