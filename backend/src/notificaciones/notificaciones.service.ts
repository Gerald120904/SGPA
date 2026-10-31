import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrearNotificacionDto } from './dto/crear-notificacion.dto';
import { Notificacion } from './entities/notificacion.entity';

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepository: Repository<Notificacion>,
  ) {}

  async crear(dto: CrearNotificacionDto): Promise<Notificacion> {
    const notificacion = this.notificacionRepository.create({
      claveIdempotencia: dto.claveIdempotencia ?? null,
      usuarioId: dto.usuarioId,
      carreraId: dto.carreraId ?? null,
      titulo: dto.titulo.trim(),
      mensaje: dto.mensaje.trim(),
      tipo: dto.tipo.trim(),
      enlace: dto.enlace?.trim() || null,
      metadatos: dto.metadatos ?? null,
      leido: false,
      leidoAt: null,
    });
    try {
      return await this.notificacionRepository.save(notificacion);
    } catch (error) {
      const codigo = (error as { driverError?: { code?: string } })?.driverError?.code;
      if (codigo !== 'ER_DUP_ENTRY' || !dto.claveIdempotencia) throw error;
      const existente = await this.notificacionRepository.findOne({
        where: { claveIdempotencia: dto.claveIdempotencia },
      });
      if (!existente) throw error;
      return existente;
    }
  }

  async listarPorUsuario(usuarioId: number, soloNoLeidas = false): Promise<Notificacion[]> {
    return this.notificacionRepository.find({
      where: {
        usuarioId,
        ...(soloNoLeidas ? { leido: false } : {}),
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async contarNoLeidas(usuarioId: number): Promise<number> {
    return this.notificacionRepository.count({
      where: {
        usuarioId,
        leido: false,
      },
    });
  }

  async marcarComoLeida(id: number, usuarioId: number): Promise<Notificacion> {
    const notificacion = await this.notificacionRepository.findOne({
      where: { id, usuarioId },
    });
    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada.');
    }
    notificacion.leido = true;
    notificacion.leidoAt = new Date();
    return this.notificacionRepository.save(notificacion);
  }

  async marcarTodasComoLeidas(usuarioId: number): Promise<void> {
    await this.notificacionRepository.update(
      { usuarioId, leido: false },
      { leido: true, leidoAt: new Date() },
    );
  }
}
