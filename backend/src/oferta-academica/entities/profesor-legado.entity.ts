import { Entity, PrimaryGeneratedColumn } from 'typeorm';

// La tabla profesores pertenece al esquema legado. Solo se mapea su identidad
// para declarar la FK existente de grupos sin sincronizar esa tabla.
@Entity({ name: 'profesores', synchronize: false })
export class ProfesorLegado {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;
}
