import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PeriodoAcademico } from '../../periodos-academicos/entities/periodo-academico.entity';
import { Aula } from './aula.entity';

@Entity({
  name: 'disponibilidades_aulas',
})
@Index('IDX_disponibilidades_aulas_aula_periodo_dia', [
  'aulaId',
  'periodoId',
  'diaSemana',
])
@Check('chk_disponibilidad_aula_dia', 'dia_semana BETWEEN 1 AND 7')
@Check('chk_disponibilidad_aula_horas', 'hora_inicio < hora_fin')
export class DisponibilidadAula {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'aula_id',
    type: 'int',
    unsigned: true,
  })
  aulaId!: number;

  @Column({
    name: 'periodo_id',
    type: 'int',
    unsigned: true,
  })
  periodoId!: number;

  @Column({
    name: 'dia_semana',
    type: 'tinyint',
    unsigned: true,
  })
  diaSemana!: number;

  @Column({
    name: 'hora_inicio',
    type: 'time',
  })
  horaInicio!: string;

  @Column({
    name: 'hora_fin',
    type: 'time',
  })
  horaFin!: string;

  @ManyToOne(() => Aula, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'aula_id',
  })
  aula!: Aula;

  @ManyToOne(() => PeriodoAcademico, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'periodo_id',
  })
  periodo!: PeriodoAcademico;

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
