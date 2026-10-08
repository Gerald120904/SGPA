import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoRequisitoPerfil } from '../constants/tipo-requisito-perfil.constant';
import { PerfilAcademico } from './perfil-academico.entity';

@Entity({ name: 'requisitos_perfiles_academicos' })
@Index('IDX_requisito_perfil_orden', [
  'perfilAcademicoId',
  'obligatorio',
  'orden',
])
export class RequisitoPerfilAcademico {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'perfil_academico_id', type: 'int', unsigned: true })
  perfilAcademicoId!: number;

  @Column({ type: 'varchar', length: 40 })
  tipo!: TipoRequisitoPerfil;

  @Column({ type: 'boolean' })
  obligatorio!: boolean;

  @Column({ type: 'varchar', length: 2000 })
  descripcion!: string;

  @Column({ type: 'int', unsigned: true, default: 1 })
  orden!: number;

  @ManyToOne(() => PerfilAcademico, (perfil) => perfil.requisitos, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'perfil_academico_id' })
  perfilAcademico!: PerfilAcademico;
}
