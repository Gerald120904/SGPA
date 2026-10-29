import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PermisoSistema } from '../constants/permisos.constant';

@Entity({ name: 'permisos_carrera' })
@Index('UQ_permiso_carrera', ['usuarioId', 'carreraId', 'permiso'], { unique: true })
@Index('IDX_permiso_carrera_alcance', ['carreraId', 'permiso'])
export class PermisoCarrera {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'usuario_id', type: 'int', unsigned: true })
  usuarioId!: number;

  @Column({ name: 'carrera_id', type: 'int', unsigned: true })
  carreraId!: number;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'FK_permiso_carrera_usuario' })
  usuario!: Usuario;

  @ManyToOne(() => Carrera, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrera_id', foreignKeyConstraintName: 'FK_permiso_carrera_carrera' })
  carrera!: Carrera;

  @Column({ type: 'varchar', length: 80 })
  permiso!: PermisoSistema;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
