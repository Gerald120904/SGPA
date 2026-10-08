import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoAreaPerfil } from '../constants/tipo-area-perfil.constant';
import { PerfilAcademico } from './perfil-academico.entity';

@Entity({ name: 'areas_perfiles_academicos' })
@Index('IDX_area_perfil_orden', ['perfilAcademicoId', 'tipo', 'orden'])
export class AreaPerfilAcademico {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'perfil_academico_id', type: 'int', unsigned: true })
  perfilAcademicoId!: number;

  @Column({ type: 'varchar', length: 20 })
  tipo!: TipoAreaPerfil;

  @Column({ type: 'varchar', length: 1000 })
  descripcion!: string;

  @Column({ type: 'int', unsigned: true, default: 1 })
  orden!: number;

  @ManyToOne(() => PerfilAcademico, (perfil) => perfil.areas, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'perfil_academico_id' })
  perfilAcademico!: PerfilAcademico;
}
