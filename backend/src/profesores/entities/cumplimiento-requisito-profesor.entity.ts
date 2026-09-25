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
import { ProfesorPerfilAcademico } from '../../perfiles-academicos/entities/profesor-perfil-academico.entity';
import { RequisitoPerfilAcademico } from '../../perfiles-academicos/entities/requisito-perfil-academico.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { EstadoCumplimientoRequisito } from '../constants/estado-cumplimiento-requisito.constant';
import { EvidenciaRequisitoProfesor } from './evidencia-requisito-profesor.entity';

@Entity({ name: 'cumplimientos_requisitos_profesor' })
@Index(
  'UQ_cumplimiento_solicitud_requisito',
  ['profesorPerfilAcademicoId', 'requisitoPerfilAcademicoId'],
  { unique: true },
)
export class CumplimientoRequisitoProfesor {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({
    name: 'profesor_perfil_academico_id',
    type: 'int',
    unsigned: true,
  })
  profesorPerfilAcademicoId!: number;

  @Column({
    name: 'requisito_perfil_academico_id',
    type: 'int',
    unsigned: true,
  })
  requisitoPerfilAcademicoId!: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: EstadoCumplimientoRequisito.PENDIENTE,
  })
  estado!: EstadoCumplimientoRequisito;

  @Column({
    name: 'observacion_profesor',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observacionProfesor!: string | null;

  @Column({
    name: 'observacion_revision',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observacionRevision!: string | null;

  @Column({
    name: 'revisado_por_usuario_id',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  revisadoPorUsuarioId!: number | null;

  @Column({ name: 'fecha_revision', type: 'datetime', nullable: true })
  fechaRevision!: Date | null;

  @ManyToOne(
    () => ProfesorPerfilAcademico,
    (solicitud) => solicitud.cumplimientos,
    { onDelete: 'CASCADE', onUpdate: 'CASCADE' },
  )
  @JoinColumn({ name: 'profesor_perfil_academico_id' })
  profesorPerfilAcademico!: ProfesorPerfilAcademico;

  @ManyToOne(() => RequisitoPerfilAcademico, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'requisito_perfil_academico_id' })
  requisitoPerfilAcademico!: RequisitoPerfilAcademico;

  @ManyToOne(() => Usuario, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'revisado_por_usuario_id' })
  revisadoPor!: Usuario | null;

  @OneToMany(
    () => EvidenciaRequisitoProfesor,
    (evidencia) => evidencia.cumplimientoRequisito,
  )
  evidencias!: EvidenciaRequisitoProfesor[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
