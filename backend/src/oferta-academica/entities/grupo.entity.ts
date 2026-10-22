import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Curso } from '../../cursos/entities/curso.entity';
import { PeriodoAcademico } from '../../periodos-academicos/entities/periodo-academico.entity';
import { HorarioGrupo } from './horario-grupo.entity';

@Entity({ name: 'grupos' })
@Unique('uq_grupo_curso_periodo', ['cursoId', 'periodoId', 'numeroGrupo'])
@Index('idx_grupo_periodo', ['periodoId'])
@Index('fk_grupo_profesor', ['profesorId'])
@Check('chk_grupo_cupo', 'cupo_maximo > 0')
export class Grupo {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'curso_id', type: 'int', unsigned: true })
  cursoId!: number;

  @Column({ name: 'periodo_id', type: 'int', unsigned: true })
  periodoId!: number;

  // Identidad de la tabla legada profesores; no corresponde a usuarios.id.
  @Column({ name: 'profesor_id', type: 'int', unsigned: true, nullable: true })
  profesorId!: number | null;

  @Column({ name: 'numero_grupo', type: 'varchar', length: 20 })
  numeroGrupo!: string;

  @Column({ name: 'tipo_grupo', type: 'varchar', length: 30 })
  tipoGrupo!: string;

  @Column({ name: 'cupo_maximo', type: 'smallint', unsigned: true })
  cupoMaximo!: number;

  @Column({ type: 'varchar', length: 30 })
  estado!: string;

  @ManyToOne(() => Curso, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'curso_id', foreignKeyConstraintName: 'FK_grupo_curso' })
  curso!: Curso;

  @ManyToOne(() => PeriodoAcademico, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'periodo_id', foreignKeyConstraintName: 'FK_grupo_periodo' })
  periodo!: PeriodoAcademico;

  @OneToMany(() => HorarioGrupo, (horario) => horario.grupo)
  horarios!: HorarioGrupo[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
