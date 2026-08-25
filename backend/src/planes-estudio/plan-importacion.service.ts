import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TipoBloquePlan } from './constants/tipo-bloque-plan.constant';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { TipoRequisito } from './constants/tipo-requisito.constant';
import { ValidarImportacionPlanDto } from './dto/validar-importacion-plan.dto';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import {
  SalidaAcademica,
  TipoSalidaAcademica,
} from './entities/salida-academica.entity';

type NivelProblema = 'ERROR' | 'ADVERTENCIA';
export interface ProblemaImportacion {
  nivel: NivelProblema;
  codigo: string;
  hoja: string;
  fila?: number;
  mensaje: string;
}
type Fila = Record<string, unknown>;

@Injectable()
export class PlanImportacionService {
  constructor(
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(BloquePlan)
    private readonly bloqueRepository: Repository<BloquePlan>,
    @InjectRepository(PlanAsignatura)
    private readonly asignaturaRepository: Repository<PlanAsignatura>,
    @InjectRepository(SalidaAcademica)
    private readonly salidaRepository: Repository<SalidaAcademica>,
    private readonly dataSource: DataSource,
  ) {}

  private texto(valor: unknown): string {
    return String(valor ?? '').trim();
  }

  private mayuscula(valor: unknown): string {
    return this.texto(valor).toUpperCase();
  }

  private numero(valor: unknown): number | null {
    const texto = this.texto(valor);
    if (!texto) return null;
    const numero = Number(texto.replace(',', '.'));
    return Number.isFinite(numero) ? numero : null;
  }

  private agregar(
    problemas: ProblemaImportacion[],
    nivel: NivelProblema,
    codigo: string,
    hoja: string,
    fila: Fila | null,
    mensaje: string,
  ) {
    const numeroFila = this.numero(fila?.__fila);
    problemas.push({
      nivel,
      codigo,
      hoja,
      ...(numeroFila !== null && Number.isInteger(numeroFila)
        ? { fila: numeroFila }
        : {}),
      mensaje,
    });
  }

  private enteroPositivo(
    valor: unknown,
    campo: string,
    hoja: string,
    fila: Fila,
    problemas: ProblemaImportacion[],
    permitirCero = false,
  ) {
    const numero = this.numero(valor);
    if (
      numero === null ||
      !Number.isInteger(numero) ||
      numero < (permitirCero ? 0 : 1)
    ) {
      this.agregar(
        problemas,
        'ERROR',
        `${campo}_INVALIDO`,
        hoja,
        fila,
        `${campo} debe ser un entero mayor o igual a ${permitirCero ? 0 : 1}.`,
      );
    }
  }

  private validarBloques(filas: Fila[], problemas: ProblemaImportacion[]) {
    const codigos = new Set<string>();
    const tipos = new Set(Object.values(TipoBloquePlan));
    for (const fila of filas) {
      const codigo = this.mayuscula(fila.CODIGO);
      const nombre = this.texto(fila.NOMBRE);
      const tipo = this.mayuscula(fila.TIPO);
      if (!codigo)
        this.agregar(
          problemas,
          'ERROR',
          'BLOQUE_SIN_CODIGO',
          'BLOQUES',
          fila,
          'El bloque debe indicar un código.',
        );
      if (!nombre)
        this.agregar(
          problemas,
          'ERROR',
          'BLOQUE_SIN_NOMBRE',
          'BLOQUES',
          fila,
          'El bloque debe indicar un nombre.',
        );
      if (codigo && codigos.has(codigo))
        this.agregar(
          problemas,
          'ERROR',
          'BLOQUE_DUPLICADO',
          'BLOQUES',
          fila,
          `El bloque "${codigo}" aparece más de una vez.`,
        );
      if (codigo) codigos.add(codigo);
      if (!tipos.has(tipo as TipoBloquePlan))
        this.agregar(
          problemas,
          'ERROR',
          'TIPO_BLOQUE_INVALIDO',
          'BLOQUES',
          fila,
          `El tipo "${tipo}" no es válido.`,
        );
      this.enteroPositivo(
        fila.ORDEN,
        'ORDEN_BLOQUE',
        'BLOQUES',
        fila,
        problemas,
      );
    }
    return codigos;
  }

  private validarAsignaturas(
    filas: Fila[],
    bloques: Set<string>,
    problemas: ProblemaImportacion[],
  ) {
    const claves = new Set<string>();
    const codigos = new Set<string>();
    const tipos = new Set(Object.values(TipoPlanAsignatura));

    for (const fila of filas) {
      const clave = this.mayuscula(fila.CLAVE);
      const codigo = this.mayuscula(fila.CODIGO);
      const nombre = this.texto(fila.NOMBRE);
      const bloque = this.mayuscula(fila.BLOQUE);
      const tipo = this.mayuscula(fila.TIPO);

      if (!clave)
        this.agregar(
          problemas,
          'ERROR',
          'ASIGNATURA_SIN_CLAVE',
          'ASIGNATURAS',
          fila,
          'Toda asignatura debe tener una CLAVE única dentro del archivo.',
        );
      if (clave && claves.has(clave))
        this.agregar(
          problemas,
          'ERROR',
          'CLAVE_ASIGNATURA_DUPLICADA',
          'ASIGNATURAS',
          fila,
          `La clave "${clave}" está repetida.`,
        );
      if (clave) claves.add(clave);

      if (!codigo)
        this.agregar(
          problemas,
          'ERROR',
          'ASIGNATURA_SIN_CODIGO',
          'ASIGNATURAS',
          fila,
          'Toda asignatura debe indicar un código.',
        );

      if (codigo && codigos.has(codigo))
        this.agregar(
          problemas,
          'ERROR',
          'CODIGO_ASIGNATURA_DUPLICADO',
          'ASIGNATURAS',
          fila,
          `El código "${codigo}" aparece más de una vez en el plan.`,
        );
      if (codigo) codigos.add(codigo);

      if (!nombre)
        this.agregar(
          problemas,
          'ERROR',
          'ASIGNATURA_SIN_NOMBRE',
          'ASIGNATURAS',
          fila,
          'Toda asignatura debe indicar un nombre.',
        );

      if (!bloque)
        this.agregar(
          problemas,
          'ADVERTENCIA',
          'ASIGNATURA_SIN_BLOQUE',
          'ASIGNATURAS',
          fila,
          `La asignatura "${codigo || clave || '?'}" no tiene bloque.`,
        );
      else if (!bloques.has(bloque))
        this.agregar(
          problemas,
          'ERROR',
          'BLOQUE_NO_EXISTE',
          'ASIGNATURAS',
          fila,
          `El bloque "${bloque}" no existe en la hoja BLOQUES.`,
        );
      if (!tipos.has(tipo as TipoPlanAsignatura))
        this.agregar(
          problemas,
          'ERROR',
          'TIPO_ASIGNATURA_INVALIDO',
          'ASIGNATURAS',
          fila,
          `El tipo "${tipo}" no es válido.`,
        );
      for (const campo of ['NIVEL', 'CICLO', 'ORDEN'])
        this.enteroPositivo(fila[campo], campo, 'ASIGNATURAS', fila, problemas);
      this.enteroPositivo(
        fila.CREDITOS,
        'CREDITOS',
        'ASIGNATURAS',
        fila,
        problemas,
        true,
      );
      for (const campo of ['T', 'P', 'L', 'G', 'EI', 'HT', 'HD']) {
        if (!this.texto(fila[campo])) continue;
        const horas = this.numero(fila[campo]);
        if (horas === null || horas < 0 || horas > 999)
          this.agregar(
            problemas,
            'ERROR',
            'HORAS_INVALIDAS',
            'ASIGNATURAS',
            fila,
            `${campo} debe contener un número entre 0 y 999.`,
          );
      }
    }
    return claves;
  }

  private validarRequisitos(
    filas: Fila[],
    claves: Set<string>,
    problemas: ProblemaImportacion[],
  ) {
    const relaciones = new Set<string>();
    const grafo = new Map<string, Set<string>>();
    for (const fila of filas) {
      const asignatura = this.mayuscula(fila.ASIGNATURA_CLAVE);
      const relacionada = this.mayuscula(fila.RELACIONADA_CLAVE);
      const tipo = this.mayuscula(fila.TIPO);
      if (!claves.has(asignatura))
        this.agregar(
          problemas,
          'ERROR',
          'ASIGNATURA_REQUISITO_NO_EXISTE',
          'REQUISITOS',
          fila,
          `La asignatura "${asignatura}" no existe en ASIGNATURAS.`,
        );
      if (!claves.has(relacionada))
        this.agregar(
          problemas,
          'ERROR',
          'RELACIONADA_NO_EXISTE',
          'REQUISITOS',
          fila,
          `La asignatura relacionada "${relacionada}" no existe en ASIGNATURAS.`,
        );
      if (asignatura && asignatura === relacionada)
        this.agregar(
          problemas,
          'ERROR',
          'AUTORRELACION_REQUISITO',
          'REQUISITOS',
          fila,
          `"${asignatura}" no puede relacionarse consigo misma.`,
        );
      if (
        ![TipoRequisito.REQUISITO, TipoRequisito.CORREQUISITO].includes(
          tipo as TipoRequisito,
        )
      )
        this.agregar(
          problemas,
          'ERROR',
          'TIPO_REQUISITO_INVALIDO',
          'REQUISITOS',
          fila,
          `El tipo "${tipo}" no es válido.`,
        );
      const relacion = `${asignatura}|${relacionada}`;
      if (relaciones.has(relacion))
        this.agregar(
          problemas,
          'ERROR',
          'REQUISITO_DUPLICADO',
          'REQUISITOS',
          fila,
          'La relación está repetida.',
        );
      relaciones.add(relacion);
      if (tipo === TipoRequisito.REQUISITO && asignatura && relacionada) {
        const siguientes = grafo.get(relacionada) ?? new Set<string>();
        siguientes.add(asignatura);
        grafo.set(relacionada, siguientes);
      }
    }
    const visitados = new Set<string>();
    const activos = new Set<string>();
    const visitar = (nodo: string): boolean => {
      if (activos.has(nodo)) return true;
      if (visitados.has(nodo)) return false;
      activos.add(nodo);
      for (const siguiente of grafo.get(nodo) ?? [])
        if (visitar(siguiente)) return true;
      activos.delete(nodo);
      visitados.add(nodo);
      return false;
    };
    if ([...grafo.keys()].some(visitar))
      this.agregar(
        problemas,
        'ERROR',
        'CICLO_REQUISITOS',
        'REQUISITOS',
        null,
        'Las relaciones del archivo generan un ciclo de requisitos.',
      );
  }

  private validarSalidas(filas: Fila[], problemas: ProblemaImportacion[]) {
    const codigos = new Set<string>();
    const tipos = new Set(Object.values(TipoSalidaAcademica));
    for (const fila of filas) {
      const codigo = this.mayuscula(fila.CODIGO);
      const tipo = this.mayuscula(fila.TIPO);
      if (!codigo)
        this.agregar(
          problemas,
          'ERROR',
          'SALIDA_SIN_CODIGO',
          'SALIDAS',
          fila,
          'La salida académica debe indicar un código.',
        );
      if (!this.texto(fila.NOMBRE))
        this.agregar(
          problemas,
          'ERROR',
          'SALIDA_SIN_NOMBRE',
          'SALIDAS',
          fila,
          'La salida académica debe indicar un nombre.',
        );
      if (codigo && codigos.has(codigo))
        this.agregar(
          problemas,
          'ERROR',
          'SALIDA_DUPLICADA',
          'SALIDAS',
          fila,
          `La salida "${codigo}" está repetida.`,
        );
      if (codigo) codigos.add(codigo);
      if (!tipos.has(tipo as TipoSalidaAcademica))
        this.agregar(
          problemas,
          'ERROR',
          'TIPO_SALIDA_INVALIDO',
          'SALIDAS',
          fila,
          `El tipo "${tipo}" no es válido.`,
        );
      this.enteroPositivo(
        fila.CREDITOS_REQUERIDOS,
        'CREDITOS_SALIDA',
        'SALIDAS',
        fila,
        problemas,
      );
      this.enteroPositivo(
        fila.ORDEN,
        'ORDEN_SALIDA',
        'SALIDAS',
        fila,
        problemas,
      );
    }
    return codigos;
  }

  private validarAsignaturasSalidas(
    filas: Fila[],
    salidas: Set<string>,
    asignaturas: Set<string>,
    problemas: ProblemaImportacion[],
  ) {
    const relaciones = new Set<string>();
    for (const fila of filas) {
      const salida = this.mayuscula(fila.SALIDA_CODIGO);
      const asignatura = this.mayuscula(fila.ASIGNATURA_CLAVE);
      if (!salidas.has(salida))
        this.agregar(
          problemas,
          'ERROR',
          'SALIDA_REFERENCIA_NO_EXISTE',
          'SALIDA_ASIGNATURAS',
          fila,
          `La salida "${salida}" no existe en SALIDAS.`,
        );
      if (!asignaturas.has(asignatura))
        this.agregar(
          problemas,
          'ERROR',
          'ASIGNATURA_SALIDA_NO_EXISTE',
          'SALIDA_ASIGNATURAS',
          fila,
          `La asignatura "${asignatura}" no existe en ASIGNATURAS.`,
        );
      const relacion = `${salida}|${asignatura}`;
      if (relaciones.has(relacion))
        this.agregar(
          problemas,
          'ERROR',
          'ASIGNACION_SALIDA_DUPLICADA',
          'SALIDA_ASIGNATURAS',
          fila,
          'La asignación entre salida y asignatura está repetida.',
        );
      relaciones.add(relacion);
    }
  }

  async validar(planId: number, dto: ValidarImportacionPlanDto) {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('El plan de estudio no existe.');
    const problemas: ProblemaImportacion[] = [];
    if (!plan.activo)
      this.agregar(
        problemas,
        'ERROR',
        'PLAN_INACTIVO',
        'PLAN',
        null,
        'No se puede importar información a un plan inactivo.',
      );
    const [bloquesExistentes, asignaturasExistentes, salidasExistentes] =
      await Promise.all([
        this.bloqueRepository.count({ where: { planEstudioId: planId } }),
        this.asignaturaRepository.count({ where: { planEstudioId: planId } }),
        this.salidaRepository.count({ where: { planEstudioId: planId } }),
      ]);
    if (bloquesExistentes || asignaturasExistentes || salidasExistentes)
      this.agregar(
        problemas,
        'ERROR',
        'PLAN_NO_VACIO',
        'PLAN',
        null,
        'La importación completa solo puede realizarse sobre un plan sin bloques, asignaturas ni salidas académicas.',
      );
    const bloques = this.validarBloques(dto.bloques, problemas);
    const asignaturas = this.validarAsignaturas(
      dto.asignaturas,
      bloques,
      problemas,
    );
    this.validarRequisitos(dto.requisitos, asignaturas, problemas);
    const salidas = this.validarSalidas(dto.salidas, problemas);
    this.validarAsignaturasSalidas(
      dto.salidaAsignaturas,
      salidas,
      asignaturas,
      problemas,
    );
    const errores = problemas.filter((item) => item.nivel === 'ERROR');
    const advertencias = problemas.filter(
      (item) => item.nivel === 'ADVERTENCIA',
    );
    return {
      valido: errores.length === 0,
      puedeImportar: errores.length === 0,
      totalErrores: errores.length,
      totalAdvertencias: advertencias.length,
      resumen: {
        bloques: dto.bloques.length,
        asignaturas: dto.asignaturas.length,
        requisitos: dto.requisitos.length,
        salidas: dto.salidas.length,
        asignacionesSalidas: dto.salidaAsignaturas.length,
      },
      errores,
      advertencias,
    };
  }

  async importar(planId: number, dto: ValidarImportacionPlanDto) {
    const validacion = await this.validar(planId, dto);
    if (!validacion.puedeImportar) {
      throw new BadRequestException({
        message: 'El archivo contiene errores y no puede importarse.',
        validacion,
      });
    }

    try {
      const resumen = await this.dataSource.transaction(async (manager) => {
        const planRepo = manager.getRepository(PlanEstudio);
        const bloqueRepo = manager.getRepository(BloquePlan);
        const asignaturaRepo = manager.getRepository(PlanAsignatura);
        const requisitoRepo = manager.getRepository(PlanRequisito);
        const salidaRepo = manager.getRepository(SalidaAcademica);
        const plan = await planRepo.findOne({ where: { id: planId } });
        if (!plan) throw new NotFoundException('El plan de estudio no existe.');
        if (!plan.activo)
          throw new BadRequestException(
            'No se puede importar información a un plan inactivo.',
          );

        const [bloquesExistentes, asignaturasExistentes, salidasExistentes] =
          await Promise.all([
            bloqueRepo.count({ where: { planEstudioId: planId } }),
            asignaturaRepo.count({ where: { planEstudioId: planId } }),
            salidaRepo.count({ where: { planEstudioId: planId } }),
          ]);
        if (bloquesExistentes || asignaturasExistentes || salidasExistentes) {
          throw new BadRequestException(
            'El plan dejó de estar vacío. Vuelva a validar el archivo antes de importar.',
          );
        }

        const bloques = await bloqueRepo.save(
          bloqueRepo.create(
            dto.bloques.map((fila) => ({
              planEstudioId: planId,
              codigo: this.mayuscula(fila.CODIGO),
              nombre: this.texto(fila.NOMBRE),
              tipo: this.mayuscula(fila.TIPO) as TipoBloquePlan,
              orden: Number(this.numero(fila.ORDEN)),
              descripcion: this.texto(fila.DESCRIPCION) || null,
              activo: true,
            })),
          ),
        );
        const bloquePorCodigo = new Map(
          bloques.map((bloque) => [this.mayuscula(bloque.codigo), bloque]),
        );

        const asignaturas = await asignaturaRepo.save(
          asignaturaRepo.create(
            dto.asignaturas.map((fila) => {
              const bloque = bloquePorCodigo.get(this.mayuscula(fila.BLOQUE));
              return {
                planEstudioId: planId,
                cursoId: null,
                bloqueId: bloque?.id ?? null,
                nivel: Number(this.numero(fila.NIVEL)),
                ciclo: Number(this.numero(fila.CICLO)),
                orden: Number(this.numero(fila.ORDEN)),
                creditos: Number(this.numero(fila.CREDITOS)),
                tipo: this.mayuscula(fila.TIPO) as TipoPlanAsignatura,
                codigoReferencia: this.mayuscula(fila.CODIGO),
                nombreReferencia: this.texto(fila.NOMBRE),
                horasTeoria: this.numero(fila.T),
                horasPractica: this.numero(fila.P),
                horasLaboratorio: this.numero(fila.L),
                horasGira: this.numero(fila.G),
                horasEstudioIndependiente: this.numero(fila.EI),
                horasTotales: this.numero(fila.HT),
                horasDocente: this.numero(fila.HD),
                observacionHoras: this.texto(fila.OBSERVACION_HORAS) || null,
                activo: true,
              };
            }),
          ),
        );
        const asignaturaPorClave = new Map(
          dto.asignaturas.map((fila, indice) => [
            this.mayuscula(fila.CLAVE),
            asignaturas[indice],
          ]),
        );

        const requisitos = dto.requisitos.map((fila) => {
          const asignatura = asignaturaPorClave.get(
            this.mayuscula(fila.ASIGNATURA_CLAVE),
          );
          const relacionada = asignaturaPorClave.get(
            this.mayuscula(fila.RELACIONADA_CLAVE),
          );
          if (!asignatura || !relacionada) {
            throw new BadRequestException(
              'No fue posible resolver una relación de requisitos.',
            );
          }
          return requisitoRepo.create({
            asignaturaId: asignatura.id,
            requisitoAsignaturaId: relacionada.id,
            tipo: this.mayuscula(fila.TIPO) as TipoRequisito,
          });
        });
        if (requisitos.length) await requisitoRepo.save(requisitos);

        const salidas = await salidaRepo.save(
          salidaRepo.create(
            dto.salidas.map((fila) => ({
              planEstudioId: planId,
              codigo: this.mayuscula(fila.CODIGO),
              nombre: this.texto(fila.NOMBRE),
              tipo: this.mayuscula(fila.TIPO) as TipoSalidaAcademica,
              creditosRequeridos: Number(this.numero(fila.CREDITOS_REQUERIDOS)),
              orden: Number(this.numero(fila.ORDEN)),
              descripcion: this.texto(fila.DESCRIPCION) || null,
              activo: true,
            })),
          ),
        );
        const salidaPorCodigo = new Map(
          salidas.map((salida) => [this.mayuscula(salida.codigo), salida]),
        );
        const relaciones = new Map<number, number[]>();
        for (const fila of dto.salidaAsignaturas) {
          const salida = salidaPorCodigo.get(
            this.mayuscula(fila.SALIDA_CODIGO),
          );
          const asignatura = asignaturaPorClave.get(
            this.mayuscula(fila.ASIGNATURA_CLAVE),
          );
          if (!salida || !asignatura) {
            throw new BadRequestException(
              'No fue posible resolver una asignación a salida académica.',
            );
          }
          relaciones.set(salida.id, [
            ...(relaciones.get(salida.id) ?? []),
            asignatura.id,
          ]);
        }
        for (const [salidaId, asignaturaIds] of relaciones) {
          await manager
            .createQueryBuilder()
            .relation(SalidaAcademica, 'asignaturas')
            .of(salidaId)
            .add(asignaturaIds);
        }
        return {
          bloques: bloques.length,
          asignaturas: asignaturas.length,
          requisitos: requisitos.length,
          salidas: salidas.length,
          asignacionesSalidas: dto.salidaAsignaturas.length,
        };
      });
      return {
        ok: true,
        message: 'El plan de estudio fue importado correctamente.',
        resumen,
        advertencias: validacion.advertencias,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      console.error('Error ejecutando importación del plan:', error);
      throw new InternalServerErrorException(
        'La importación no pudo completarse. No se guardó ningún dato.',
      );
    }
  }
}
