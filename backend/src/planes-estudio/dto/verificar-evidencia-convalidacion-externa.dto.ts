import { ArrayMinSize, ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class VerificarEvidenciaConvalidacionExternaDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  hashesVerificados!: string[];

  @IsString() @MinLength(5) @MaxLength(500)
  motivoRevision!: string;

  @IsIn(['CONFIRMO_REVISION_DOCUMENTAL'])
  confirmacion!: 'CONFIRMO_REVISION_DOCUMENTAL';
}
