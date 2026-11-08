import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { Estudiante } from '../../estudiantes/entities/estudiante.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PlanAsignatura } from './plan-asignatura.entity';
import { PlanEstudio } from './plan-estudio.entity';
import { EstadoConvalidacionExterna } from '../constants/estado-convalidacion-externa.constant';

@Entity({ name: 'convalidaciones_externas' })
@Index('UQ_convalidacion_externa_idempotency', ['idempotencyKey'], { unique: true })
@Index('IDX_convalidacion_externa_estudiante_destino_estado', ['estudianteId', 'planDestinoId', 'estado'])
export class ConvalidacionExterna {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true }) id!: number;
  @Column({ name: 'estudiante_id', type: 'int', unsigned: true }) estudianteId!: number;
  @Column({ name: 'carrera_id', type: 'int', unsigned: true }) carreraId!: number;
  @Column({ name: 'plan_destino_id', type: 'int', unsigned: true }) planDestinoId!: number;
  @Column({ name: 'plan_asignatura_destino_id', type: 'int', unsigned: true }) planAsignaturaDestinoId!: number;
  @Column({ name: 'institucion_origen', type: 'varchar', length: 180 }) institucionOrigen!: string;
  @Column({ name: 'asignatura_origen', type: 'varchar', length: 180 }) asignaturaOrigen!: string;
  @Column({ name: 'identificacion_asignatura', type: 'varchar', length: 80 }) identificacionAsignatura!: string;
  @Column({ name: 'creditos_origen', type: 'smallint', unsigned: true }) creditosOrigen!: number;
  @Column({ name: 'documentacion_json', type: 'json' }) documentacion!: Array<{ nombre: string; referencia: string; sha256: string }>;
  @Column({ type: 'varchar', length: 20, default: EstadoConvalidacionExterna.PENDIENTE }) estado!: EstadoConvalidacionExterna;
  @Column({ name: 'motivo_solicitud', type: 'varchar', length: 500 }) motivoSolicitud!: string;
  @Column({ name: 'solicitada_por_usuario_id', type: 'int', unsigned: true }) solicitadaPorUsuarioId!: number;
  @Column({ name: 'idempotency_key', type: 'varchar', length: 36 }) idempotencyKey!: string;
  @Column({ name: 'payload_hash', type: 'char', length: 64 }) payloadHash!: string;
  @Column({ name: 'revisada_por_usuario_id', type: 'int', unsigned: true, nullable: true }) revisadaPorUsuarioId!: number | null;
  @Column({ name: 'rol_revisor', type: 'varchar', length: 50, nullable: true }) rolRevisor!: string | null;
  @Column({ name: 'permiso_revisor', type: 'varchar', length: 80, nullable: true }) permisoRevisor!: string | null;
  @Column({ name: 'fecha_revision', type: 'datetime', nullable: true }) fechaRevision!: Date | null;
  @Column({ name: 'motivo_decision', type: 'varchar', length: 500, nullable: true }) motivoDecision!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 }) updatedAt!: Date;
  @ManyToOne(() => Estudiante, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'estudiante_id' }) estudiante!: Estudiante;
  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'carrera_id' }) carrera!: Carrera;
  @ManyToOne(() => PlanEstudio, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'plan_destino_id' }) planDestino!: PlanEstudio;
  @ManyToOne(() => PlanAsignatura, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'plan_asignatura_destino_id' }) asignaturaDestino!: PlanAsignatura;
  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'solicitada_por_usuario_id' }) solicitadaPor!: Usuario;
  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT', nullable: true }) @JoinColumn({ name: 'revisada_por_usuario_id' }) revisadaPor!: Usuario | null;
}
