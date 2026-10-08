import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AtestadoProfesor } from './atestado-profesor.entity';
import { CumplimientoRequisitoProfesor } from './cumplimiento-requisito-profesor.entity';

@Entity({ name: 'evidencias_requisitos_profesor' })
@Index(
  'UQ_evidencia_cumplimiento_atestado',
  ['cumplimientoRequisitoId', 'atestadoProfesorId'],
  { unique: true },
)
export class EvidenciaRequisitoProfesor {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({
    name: 'cumplimiento_requisito_id',
    type: 'int',
    unsigned: true,
  })
  cumplimientoRequisitoId!: number;

  @Column({ name: 'atestado_profesor_id', type: 'int', unsigned: true })
  atestadoProfesorId!: number;

  @ManyToOne(
    () => CumplimientoRequisitoProfesor,
    (cumplimiento) => cumplimiento.evidencias,
    { onDelete: 'CASCADE', onUpdate: 'CASCADE' },
  )
  @JoinColumn({ name: 'cumplimiento_requisito_id' })
  cumplimientoRequisito!: CumplimientoRequisitoProfesor;

  @ManyToOne(
    () => AtestadoProfesor,
    (atestado) => atestado.evidenciasRequisitos,
    { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  )
  @JoinColumn({ name: 'atestado_profesor_id' })
  atestado!: AtestadoProfesor;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
