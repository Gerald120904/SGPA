import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlanEstudio } from './plan-estudio.entity';

@Entity({
  name: 'reglas_optativas_plan',
})
@Index('UQ_reglas_optativas_plan', ['planEstudioId'], { unique: true })
export class ReglaOptativaPlan {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'plan_estudio_id',
    type: 'int',
    unsigned: true,
  })
  planEstudioId!: number;

  @Column({
    name: 'minimo_disciplinarias_propias',
    type: 'smallint',
    unsigned: true,
    default: 0,
  })
  minimoDisciplinariasPropias!: number;

  @Column({
    name: 'maximo_otras_areas',
    type: 'smallint',
    unsigned: true,
    nullable: true,
  })
  maximoOtrasAreas!: number | null;

  @OneToOne(() => PlanEstudio, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'plan_estudio_id',
  })
  planEstudio!: PlanEstudio;
}
