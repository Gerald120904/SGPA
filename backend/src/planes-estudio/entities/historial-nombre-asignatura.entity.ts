import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PlanAsignatura } from './plan-asignatura.entity';

@Entity({ name: 'historial_nombres_asignaturas' })
@Index('IDX_historial_nombres_plan_asignatura_id', ['planAsignaturaId'])
export class HistorialNombreAsignatura {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'plan_asignatura_id', type: 'int', unsigned: true })
  planAsignaturaId!: number;

  @Column({ name: 'nombre_anterior', type: 'varchar', length: 150 })
  nombreAnterior!: string;

  @Column({ name: 'nombre_nuevo', type: 'varchar', length: 150 })
  nombreNuevo!: string;

  @Column({ type: 'varchar', length: 500 })
  motivo!: string;

  @Column({ name: 'usuario_id', type: 'int', unsigned: true })
  usuarioId!: number;

  @ManyToOne(() => PlanAsignatura, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'plan_asignatura_id', foreignKeyConstraintName: 'FK_historial_nombres_plan_asignatura' })
  planAsignatura!: PlanAsignatura;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'FK_historial_nombres_usuario' })
  usuario!: Usuario;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

