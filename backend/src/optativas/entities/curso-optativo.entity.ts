import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { Curso } from '../../cursos/entities/curso.entity';
import { TipoOptativa } from '../constants/tipo-optativa.constant';

@Entity({ name: 'curso_optativas' })
@Index('UQ_curso_optativas_curso', ['cursoId'], {
  unique: true,
})
export class CursoOptativo {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'curso_id',
    type: 'int',
    unsigned: true,
  })
  cursoId!: number;

  @Column({
    type: 'varchar',
    length: 30,
  })
  tipo!: TipoOptativa;

  @Column({
    name: 'carrera_origen_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  carreraOrigenId!: number | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @OneToOne(() => Curso, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'curso_id' })
  curso!: Curso;

  @ManyToOne(() => Carrera, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'carrera_origen_id',
  })
  carreraOrigen!: Carrera | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
  })
  updatedAt!: Date;
}
