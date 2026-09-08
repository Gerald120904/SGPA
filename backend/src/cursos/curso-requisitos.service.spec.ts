import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { TipoRequisito } from '../planes-estudio/constants/tipo-requisito.constant';
import { CursoRequisitosService } from './curso-requisitos.service';
import { CursoRequisito } from './entities/curso-requisito.entity';
import { Curso } from './entities/curso.entity';

describe('CursoRequisitosService', () => {
  let service: CursoRequisitosService;
  let requisitoRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let cursoRepository: {
    findOne: jest.Mock;
  };

  const crearCurso = (
    id: number,
    codigo: string,
    nombre: string,
    activo = true,
  ): Curso => ({
    id,
    codigo,
    nombre,
    descripcion: null,
    activo,
    carreras: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const cursoA = crearCurso(1, 'EIF400', 'Seguridad');
  const cursoB = crearCurso(2, 'EIF208', 'Redes');
  const cursoC = crearCurso(3, 'EIF201', 'Programación I');

  const crearRequisito = (
    id: number,
    cursoId: number,
    requisitoCursoId: number,
    tipo: TipoRequisito = TipoRequisito.REQUISITO,
  ): CursoRequisito => ({
    id,
    cursoId,
    requisitoCursoId,
    tipo,
    curso: cursoA,
    requisitoCurso: cursoB,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  beforeEach(() => {
    requisitoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((datos: Partial<CursoRequisito>) => datos),
      save: jest.fn(),
      remove: jest.fn(),
    };
    cursoRepository = {
      findOne: jest.fn(),
    };

    service = new CursoRequisitosService(
      requisitoRepository as unknown as Repository<CursoRequisito>,
      cursoRepository as unknown as Repository<Curso>,
    );

    jest.clearAllMocks();
  });

  it('crea un requisito normal válido entre cursos', async () => {
    const relacion = crearRequisito(1, 1, 2, TipoRequisito.REQUISITO);
    cursoRepository.findOne
      .mockResolvedValueOnce(cursoA)
      .mockResolvedValueOnce(cursoB);
    requisitoRepository.findOne.mockResolvedValue(null);
    requisitoRepository.find.mockResolvedValue([]);
    requisitoRepository.save.mockResolvedValue({ id: 1 });
    requisitoRepository.findOneOrFail.mockResolvedValue(relacion);

    const resultado = await service.crear(1, {
      requisitoCursoId: 2,
      tipo: TipoRequisito.REQUISITO,
    });

    expect(requisitoRepository.create).toHaveBeenCalledWith({
      cursoId: 1,
      requisitoCursoId: 2,
      tipo: TipoRequisito.REQUISITO,
    });
    expect(resultado).toEqual(relacion);
  });

  it('crea un correquisito válido entre cursos', async () => {
    const relacion = crearRequisito(2, 1, 2, TipoRequisito.CORREQUISITO);
    cursoRepository.findOne
      .mockResolvedValueOnce(cursoA)
      .mockResolvedValueOnce(cursoB);
    requisitoRepository.findOne.mockResolvedValue(null);
    requisitoRepository.save.mockResolvedValue({ id: 2 });
    requisitoRepository.findOneOrFail.mockResolvedValue(relacion);

    const resultado = await service.crear(1, {
      requisitoCursoId: 2,
      tipo: TipoRequisito.CORREQUISITO,
    });

    expect(requisitoRepository.find).not.toHaveBeenCalled(); // No valida ciclos en correquisitos
    expect(resultado.tipo).toBe(TipoRequisito.CORREQUISITO);
  });

  it('rechaza un curso como requisito de sí mismo', async () => {
    await expect(
      service.crear(1, {
        requisitoCursoId: 1,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(cursoRepository.findOne).not.toHaveBeenCalled();
    expect(requisitoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza si el curso principal no existe', async () => {
    cursoRepository.findOne.mockResolvedValue(null);

    await expect(
      service.crear(999, {
        requisitoCursoId: 2,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza si alguno de los cursos está inactivo', async () => {
    cursoRepository.findOne.mockResolvedValueOnce(
      crearCurso(1, 'EIF400', 'Seguridad', false),
    );

    await expect(
      service.crear(1, {
        requisitoCursoId: 2,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(BadRequestException);

    cursoRepository.findOne
      .mockResolvedValueOnce(cursoA)
      .mockResolvedValueOnce(crearCurso(2, 'EIF208', 'Redes', false));

    await expect(
      service.crear(1, {
        requisitoCursoId: 2,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una relación de requisito duplicada', async () => {
    cursoRepository.findOne
      .mockResolvedValueOnce(cursoA)
      .mockResolvedValueOnce(cursoB);
    requisitoRepository.findOne.mockResolvedValue(crearRequisito(1, 1, 2));

    await expect(
      service.crear(1, {
        requisitoCursoId: 2,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(ConflictException);

    expect(requisitoRepository.save).not.toHaveBeenCalled();
  });

  it('rechaza ciclos de requisitos A -> B -> C -> A', async () => {
    // Existentes:
    // Curso 1 (Seguridad) requiere Curso 2 (Redes) -> rel. 2 -> 1
    // Curso 2 (Redes) requiere Curso 3 (Prog I) -> rel. 3 -> 2
    // Nueva propuesta:
    // Curso 3 (Prog I) requiere Curso 1 (Seguridad) -> rel. 1 -> 3
    // Esto crea ciclo 1 -> 3 -> 2 -> 1
    cursoRepository.findOne
      .mockResolvedValueOnce(cursoC) // cursoId = 3
      .mockResolvedValueOnce(cursoA); // requisitoCursoId = 1
    requisitoRepository.findOne.mockResolvedValue(null);
    requisitoRepository.find.mockResolvedValue([
      crearRequisito(1, 1, 2, TipoRequisito.REQUISITO),
      crearRequisito(2, 2, 3, TipoRequisito.REQUISITO),
    ]);

    await expect(
      service.crear(3, {
        requisitoCursoId: 1,
        tipo: TipoRequisito.REQUISITO,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'La relación generaría un ciclo de requisitos entre cursos.',
      ),
    );

    expect(requisitoRepository.save).not.toHaveBeenCalled();
  });

  it('elimina una relación de requisito existente', async () => {
    const relacion = crearRequisito(1, 1, 2);
    requisitoRepository.findOne.mockResolvedValue(relacion);
    requisitoRepository.remove.mockResolvedValue(relacion);

    await service.eliminar(1, 1);

    expect(requisitoRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1, cursoId: 1 },
    });
    expect(requisitoRepository.remove).toHaveBeenCalledWith(relacion);
  });

  it('rechaza eliminar una relación inexistente', async () => {
    requisitoRepository.findOne.mockResolvedValue(null);

    await expect(service.eliminar(1, 999)).rejects.toThrow(NotFoundException);
    expect(requisitoRepository.remove).not.toHaveBeenCalled();
  });

  it('lista los requisitos de un curso', async () => {
    const requisitos = [crearRequisito(1, 1, 2)];
    cursoRepository.findOne.mockResolvedValue(cursoA);
    requisitoRepository.find.mockResolvedValue(requisitos);

    const resultado = await service.listar(1);

    expect(requisitoRepository.find).toHaveBeenCalledWith({
      where: { cursoId: 1 },
      relations: { curso: true, requisitoCurso: true },
      order: { id: 'ASC' },
    });
    expect(resultado).toEqual(requisitos);
  });
});
