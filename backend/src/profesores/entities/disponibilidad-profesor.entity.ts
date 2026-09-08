import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PeriodoAcademico } from '../../periodos-academicos/entities/periodo-academico.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoDisponibilidad } from '../constants/estado-disponibilidad.constant';
import { BloqueDisponibilidadProfesor } from './bloque-disponibilidad-profesor.entity';

@Entity({
  name: 'disponibilidades_profesor',
})
@Index(
  'UQ_disponibilidad_profesor_periodo',
  ['profesorUsuarioId', 'periodoAcademicoId'],
  {
    unique: true,
  },
)
export class DisponibilidadProfesor {
  @PrimaryGeneratedColumn({
    type: 'int',
    unsigned: true,
  })
  id!: number;

  @Column({
    name: 'profesor_usuario_id',
    type: 'int',
    unsigned: true,
  })
  profesorUsuarioId!: number;

  @Column({
    name: 'periodo_academico_id',
    type: 'int',
    unsigned: true,
  })
  periodoAcademicoId!: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoDisponibilidad.PENDIENTE,
  })
  estado!: EstadoDisponibilidad;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones!: string | null;

  @ManyToOne(() => Usuario, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'profesor_usuario_id',
  })
  profesor!: Usuario;

  @ManyToOne(() => PeriodoAcademico, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'periodo_academico_id',
  })
  periodoAcademico!: PeriodoAcademico;

  @OneToMany(
    () => BloqueDisponibilidadProfesor,
    (bloque) => bloque.disponibilidad,
  )
  bloques!: BloqueDisponibilidadProfesor[];

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
