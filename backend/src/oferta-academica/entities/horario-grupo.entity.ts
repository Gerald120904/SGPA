import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Aula } from '../../aulas/entities/aula.entity';
import { Grupo } from './grupo.entity';

@Entity({ name: 'horarios_grupo' })
@Check('chk_horario_grupo_dia', 'dia_semana BETWEEN 1 AND 7')
@Check('chk_horario_grupo_horas', 'hora_inicio < hora_fin')
export class HorarioGrupo {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'grupo_id', type: 'int', unsigned: true })
  grupoId!: number;

  @Column({ name: 'aula_id', type: 'int', unsigned: true, nullable: true })
  aulaId!: number | null;

  @Column({ name: 'dia_semana', type: 'tinyint', unsigned: true })
  diaSemana!: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin!: string;

  @ManyToOne(() => Grupo, (grupo) => grupo.horarios, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'grupo_id', foreignKeyConstraintName: 'FK_horario_grupo' })
  grupo!: Grupo;

  @ManyToOne(() => Aula, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'aula_id', foreignKeyConstraintName: 'FK_horario_aula' })
  aula!: Aula | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
