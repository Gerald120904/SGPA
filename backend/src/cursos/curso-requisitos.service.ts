import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { CrearCursoRequisitoDto } from './dto/crear-curso-requisito.dto';
import { CursoRequisito } from './entities/curso-requisito.entity';
import { Curso } from './entities/curso.entity';

@Injectable()
export class CursoRequisitosService {
  constructor(
    @InjectRepository(CursoRequisito)
    private readonly requisitoRepository: Repository<CursoRequisito>,
    @InjectRepository(Curso)
    private readonly cursoRepository: Repository<Curso>,
  ) {}

  private async obtenerCursoActivo(id: number): Promise<Curso> {
    const curso = await this.cursoRepository.findOne({
      where: { id },
    });

    if (!curso) {
      throw new NotFoundException('Curso no encontrado.');
    }

    if (!curso.activo) {
      throw new BadRequestException(
        'No se pueden crear requisitos utilizando cursos inactivos.',
      );
    }

    return curso;
  }

  private async validarSinCiclos(
    cursoId: number,
    requisitoCursoId: number,
  ): Promise<void> {
    const existentes = await this.requisitoRepository.find({
      where: {
        tipo: TipoRequisito.REQUISITO,
      },
    });

    const grafo = new Map<number, Set<number>>();

    const agregarRelacion = (origen: number, destino: number) => {
      if (!grafo.has(origen)) {
        grafo.set(origen, new Set());
      }
      grafo.get(origen)!.add(destino);

      if (!grafo.has(destino)) {
        grafo.set(destino, new Set());
      }
    };

    for (const rel of existentes) {
      agregarRelacion(rel.requisitoCursoId, rel.cursoId);
    }

    // Agregar la nueva relación propuesta
    agregarRelacion(requisitoCursoId, cursoId);

    const visitados = new Set<number>();
    const enProceso = new Set<number>();

    const visitar = (nodo: number) => {
      if (enProceso.has(nodo)) {
        throw new BadRequestException(
          'La relación generaría un ciclo de requisitos entre cursos.',
        );
      }

      if (visitados.has(nodo)) {
        return;
      }

      enProceso.add(nodo);

      for (const siguiente of grafo.get(nodo) ?? new Set<number>()) {
        visitar(siguiente);
      }

      enProceso.delete(nodo);
      visitados.add(nodo);
    };

    for (const nodo of grafo.keys()) {
      visitar(nodo);
    }
  }

  async listar(cursoId: number): Promise<CursoRequisito[]> {
    await this.obtenerCursoActivo(cursoId);

    return this.requisitoRepository.find({
      where: {
        cursoId,
      },
      relations: {
        curso: true,
        requisitoCurso: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async crear(
    cursoId: number,
    dto: CrearCursoRequisitoDto,
  ): Promise<CursoRequisito> {
    if (cursoId === dto.requisitoCursoId) {
      throw new BadRequestException(
        'Un curso no puede ser requisito de sí mismo.',
      );
    }

    await this.obtenerCursoActivo(cursoId);
    await this.obtenerCursoActivo(dto.requisitoCursoId);

    const existente = await this.requisitoRepository.findOne({
      where: {
        cursoId,
        requisitoCursoId: dto.requisitoCursoId,
        tipo: dto.tipo,
      },
    });

    if (existente) {
      throw new ConflictException(
        'Esta relación de requisito ya está registrada.',
      );
    }

    if (dto.tipo === TipoRequisito.REQUISITO) {
      await this.validarSinCiclos(cursoId, dto.requisitoCursoId);
    }

    const relacion = this.requisitoRepository.create({
      cursoId,
      requisitoCursoId: dto.requisitoCursoId,
      tipo: dto.tipo,
    });

    const guardada = await this.requisitoRepository.save(relacion);

    return this.requisitoRepository.findOneOrFail({
      where: {
        id: guardada.id,
      },
      relations: {
        curso: true,
        requisitoCurso: true,
      },
    });
  }

  async eliminar(cursoId: number, id: number): Promise<void> {
    const relacion = await this.requisitoRepository.findOne({
      where: {
        id,
        cursoId,
      },
    });

    if (!relacion) {
      throw new NotFoundException('Relación de requisito no encontrada.');
    }

    await this.requisitoRepository.remove(relacion);
  }
}
