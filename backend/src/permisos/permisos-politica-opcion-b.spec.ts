import { RolSistema } from '../auth/constants/roles.constants';
import {
  PermisoSistema,
  PERMISOS_SISTEMA,
} from './constants/permisos.constant';
import {
  PERMISOS_PREDETERMINADOS_POR_ROL,
} from './constants/plantillas-permisos.constant';

/**
 * SGPA - QA-003: Especificación Formal de la Política Opción B
 *
 * Arquitectura:
 * - Permisos base derivados exclusivamente de roles activos en MySQL.
 * - Excepciones individuales tipificadas como 'CONCEDER' o 'DENEGAR'.
 * - Principio 'Deny Overrides': Si un permiso está DENEGADO, prevalece sobre cualquier rol o concesión.
 * - Preservación multi-rol: Al revocar un rol, los permisos compartidos con otro rol activo se conservan.
 * - Límites de Seguridad (Security Boundaries):
 *   * Excepciones individuales jamás confieren acceso a endpoints de ADMIN_GLOBAL protegidos por RolesGuard.
 *   * ASISTENTE_ESTUDIANTIL tiene un techo de solo lectura (*_VER).
 *   * PROFESOR no puede recibir permisos de coordinación institucional (PERIODOS_GESTIONAR, CARRERAS_GESTIONAR).
 * - Prevención de escalamiento accidental:
 *   * Si un permiso de plantilla no estaba asignado en el esquema legacy, se convierte obligatoriamente en DENEGAR.
 */

export type TipoExcepcionPermiso = 'CONCEDER' | 'DENEGAR';

export interface ExcepcionPermisoUsuario {
  permiso: PermisoSistema;
  tipo: TipoExcepcionPermiso;
  motivo?: string;
}

export interface ContextoUsuarioPoliticaB {
  usuarioId: number;
  rolesActivos: RolSistema[];
  excepciones: ExcepcionPermisoUsuario[];
}

/**
 * Matriz de Límites de Seguridad (Techo de Roles)
 * Define los permisos máximos que pueden concederse individualmente a cada rol
 */
export const TECHO_PERMISOS_POR_ROL: Record<RolSistema, readonly PermisoSistema[]> = {
  [RolSistema.ADMIN_GLOBAL]: PERMISOS_SISTEMA,

  [RolSistema.COORDINADOR]: PERMISOS_SISTEMA,

  [RolSistema.PROFESOR]: [
    // Base
    PermisoSistema.PERIODOS_VER,
    PermisoSistema.AULAS_VER,
    // Delegaciones operativas autorizadas para docentes
    PermisoSistema.AULAS_GESTIONAR,
    PermisoSistema.AULAS_ASIGNAR,
    PermisoSistema.ATESTADOS_VALIDAR,
    PermisoSistema.PERFILES_DOCENTES_VALIDAR,
    PermisoSistema.PROYECCION_VER,
    PermisoSistema.OFERTA_VER,
    PermisoSistema.CURSOS_VER,
    PermisoSistema.OPTATIVAS_VER,
    PermisoSistema.PLANES_ESTUDIO_VER,
    PermisoSistema.CARRERAS_VER,
  ],

  [RolSistema.ASISTENTE_ESTUDIANTIL]: [
    // Techo estricto: Solo lectura (*_VER)
    PermisoSistema.ESTUDIANTES_VER,
    PermisoSistema.FORMULARIOS_ESTUDIANTES_VER,
    PermisoSistema.FORMULARIOS_ESTUDIANTES_VER_RESPUESTAS,
    PermisoSistema.CARRERAS_VER,
    PermisoSistema.PLANES_ESTUDIO_VER,
    PermisoSistema.CURSOS_VER,
    PermisoSistema.OPTATIVAS_VER,
    PermisoSistema.PERFILES_ACADEMICOS_VER,
    PermisoSistema.PERIODOS_VER,
    PermisoSistema.AULAS_VER,
    PermisoSistema.ESTRUCTURA_ACADEMICA_VER,
    PermisoSistema.PROYECCION_VER,
    PermisoSistema.OFERTA_VER,
    PermisoSistema.PROFESORES_VER,
  ],
};

/**
 * Evaluador de la Política Opción B
 */
export class EvaluadorPoliticaOpcionB {
  /**
   * Resuelve los permisos efectivos de un usuario
   */
  static resolverPermisosEfectivos(contexto: ContextoUsuarioPoliticaB): Set<PermisoSistema> {
    const { rolesActivos, excepciones } = contexto;

    // 1. Si no tiene roles activos en MySQL, no tiene ningún permiso
    if (!rolesActivos || rolesActivos.length === 0) {
      return new Set();
    }

    // 2. ADMIN_GLOBAL conserva superusuario dinámico
    if (rolesActivos.includes(RolSistema.ADMIN_GLOBAL)) {
      return new Set(PERMISOS_SISTEMA);
    }

    // 3. Permisos base: Unión de las plantillas de todos los roles activos
    const base = new Set<PermisoSistema>();
    for (const rol of rolesActivos) {
      const plantilla = PERMISOS_PREDETERMINADOS_POR_ROL[rol] || [];
      for (const p of plantilla) {
        base.add(p);
      }
    }

    // 4. Procesar excepciones
    const denegados = new Set<PermisoSistema>();
    const concedidos = new Set<PermisoSistema>();

    for (const exc of excepciones) {
      if (exc.tipo === 'DENEGAR') {
        denegados.add(exc.permiso);
      } else if (exc.tipo === 'CONCEDER') {
        concedidos.add(exc.permiso);
      }
    }

    // 5. Aplicar 'Deny Overrides'
    // Efectivos = (Base + Concedidos) - Denegados
    const efectivos = new Set<PermisoSistema>();

    // Agregar permisos base no denegados
    for (const p of base) {
      if (!denegados.has(p)) {
        efectivos.add(p);
      }
    }

    // Agregar concesiones no denegadas
    for (const p of concedidos) {
      if (!denegados.has(p)) {
        efectivos.add(p);
      }
    }

    return efectivos;
  }

  /**
   * Valida si un conjunto de excepciones respeta la matriz de límites de seguridad
   */
  static validarLimitesSeguridad(
    rolesActivos: RolSistema[],
    excepcion: ExcepcionPermisoUsuario,
  ): { valido: boolean; motivo?: string } {
    if (excepcion.tipo === 'DENEGAR') {
      // Denegar siempre es seguro (reduce privilegios)
      return { valido: true };
    }

    if (!rolesActivos || rolesActivos.length === 0) {
      return {
        valido: false,
        motivo: 'No se pueden conceder excepciones a usuarios sin roles activos.',
      };
    }

    // Calcular el techo combinado de los roles activos
    const techoCombinado = new Set<PermisoSistema>();
    for (const rol of rolesActivos) {
      const permitidos = TECHO_PERMISOS_POR_ROL[rol] || [];
      for (const p of permitidos) {
        techoCombinado.add(p);
      }
    }

    if (!techoCombinado.has(excepcion.permiso)) {
      return {
        valido: false,
        motivo: `El permiso ${excepcion.permiso} excede el techo de seguridad para los roles asignados [${rolesActivos.join(', ')}]. Requiere autorización explícita del Product Owner.`,
      };
    }

    return { valido: true };
  }

  /**
   * Genera las excepciones requeridas durante la migración desde datos legacy
   * para evitar escalamiento accidental de privilegios.
   */
  static generarExcepcionesMigracion(
    rolesActivos: RolSistema[],
    permisosLegacyAsignados: PermisoSistema[],
  ): {
    excepcionesGeneradas: ExcepcionPermisoUsuario[];
    casosAmbiguos: PermisoSistema[];
  } {
    const asignados = new Set(permisosLegacyAsignados);
    const plantillaCombinada = new Set<PermisoSistema>();
    for (const rol of rolesActivos) {
      for (const p of PERMISOS_PREDETERMINADOS_POR_ROL[rol] || []) {
        plantillaCombinada.add(p);
      }
    }

    const excepcionesGeneradas: ExcepcionPermisoUsuario[] = [];
    const casosAmbiguos: PermisoSistema[] = [];

    // Regla 1: Permisos en plantilla pero NO en legacy -> DENEGAR para evitar conceder nuevos privilegios accidentalmente
    for (const p of plantillaCombinada) {
      if (!asignados.has(p)) {
        excepcionesGeneradas.push({
          permiso: p,
          tipo: 'DENEGAR',
          motivo: 'MIGRACION_QA003_EXCLUSION_PREVIA_DE_PLANTILLA',
        });
      }
    }

    // Regla 2: Permisos en legacy pero NO en plantilla -> analizar si caben en techo o son ambiguos
    for (const p of asignados) {
      if (!plantillaCombinada.has(p)) {
        const techo = EvaluadorPoliticaOpcionB.validarLimitesSeguridad(rolesActivos, {
          permiso: p,
          tipo: 'CONCEDER',
        });

        if (techo.valido) {
          excepcionesGeneradas.push({
            permiso: p,
            tipo: 'CONCEDER',
            motivo: 'MIGRACION_QA003_AMPLIACION_LEGITIMA_PREVIA',
          });
        } else {
          // Fuera de techo: sospechoso de permiso residual o huérfano
          casosAmbiguos.push(p);
        }
      }
    }

    return { excepcionesGeneradas, casosAmbiguos };
  }
}

describe('SGPA-QA-003: Pruebas Unitarias de la Política Opción B', () => {
  describe('1. Derivación de permisos desde roles activos (Herencia de Plantilla)', () => {
    it('hereda automáticamente todos los permisos de la plantilla para un COORDINADOR activo', () => {
      const contexto: ContextoUsuarioPoliticaB = {
        usuarioId: 10,
        rolesActivos: [RolSistema.COORDINADOR],
        excepciones: [],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contexto);

      expect(efectivos.size).toBe(
        PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.COORDINADOR].length,
      );
      expect(efectivos.has(PermisoSistema.ESTUDIANTES_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.PERIODOS_GESTIONAR)).toBe(true);
      expect(efectivos.has(PermisoSistema.CARRERAS_GESTIONAR)).toBe(true);
    });

    it('hereda únicamente los permisos base para un PROFESOR activo (PERIODOS_VER y AULAS_VER)', () => {
      const contexto: ContextoUsuarioPoliticaB = {
        usuarioId: 11,
        rolesActivos: [RolSistema.PROFESOR],
        excepciones: [],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contexto);

      expect(efectivos.size).toBe(2);
      expect(efectivos.has(PermisoSistema.PERIODOS_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.AULAS_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.ESTUDIANTES_VER)).toBe(false);
      expect(efectivos.has(PermisoSistema.PERIODOS_GESTIONAR)).toBe(false);
    });

    it('combina las plantillas sin duplicados para un usuario con múltiples roles (COORDINADOR + PROFESOR)', () => {
      const contexto: ContextoUsuarioPoliticaB = {
        usuarioId: 12,
        rolesActivos: [RolSistema.COORDINADOR, RolSistema.PROFESOR],
        excepciones: [],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contexto);

      // COORDINADOR incluye los 2 permisos de PROFESOR, el tamaño coincide con la plantilla completa
      expect(efectivos.size).toBe(
        PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.COORDINADOR].length,
      );
      expect(efectivos.has(PermisoSistema.PERIODOS_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.AULAS_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.ESTUDIANTES_GESTIONAR)).toBe(true);
    });

    it('no otorga permisos por defecto a un ASISTENTE_ESTUDIANTIL sin excepciones', () => {
      const contexto: ContextoUsuarioPoliticaB = {
        usuarioId: 13,
        rolesActivos: [RolSistema.ASISTENTE_ESTUDIANTIL],
        excepciones: [],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contexto);
      expect(efectivos.size).toBe(0);
    });
  });

  describe('2. Revocación de rol y preservación de permisos compartidos (Multi-rol)', () => {
    it('conserva permisos compartidos (PERIODOS_VER, AULAS_VER) al revocar COORDINADOR si PROFESOR sigue activo', () => {
      // Estado antes: Usuario con COORDINADOR y PROFESOR
      const contextoPrevio: ContextoUsuarioPoliticaB = {
        usuarioId: 20,
        rolesActivos: [RolSistema.COORDINADOR, RolSistema.PROFESOR],
        excepciones: [],
      };
      const efectivosPrevios = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contextoPrevio);
      expect(efectivosPrevios.has(PermisoSistema.PERIODOS_VER)).toBe(true);
      expect(efectivosPrevios.has(PermisoSistema.ESTUDIANTES_VER)).toBe(true);

      // Se revoca COORDINADOR en MySQL; el usuario pasa a tener únicamente PROFESOR
      const contextoPosterior: ContextoUsuarioPoliticaB = {
        usuarioId: 20,
        rolesActivos: [RolSistema.PROFESOR],
        excepciones: [],
      };
      const efectivosPosteriores = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contextoPosterior);

      // Los permisos exclusivos de COORDINADOR se pierden de inmediato
      expect(efectivosPosteriores.has(PermisoSistema.ESTUDIANTES_VER)).toBe(false);
      expect(efectivosPosteriores.has(PermisoSistema.PERIODOS_GESTIONAR)).toBe(false);
      expect(efectivosPosteriores.has(PermisoSistema.CARRERAS_GESTIONAR)).toBe(false);

      // Los permisos compartidos con PROFESOR se preservan legítimamente
      expect(efectivosPosteriores.has(PermisoSistema.PERIODOS_VER)).toBe(true);
      expect(efectivosPosteriores.has(PermisoSistema.AULAS_VER)).toBe(true);
      expect(efectivosPosteriores.size).toBe(2);
    });

    it('anula inmediatamente todos los permisos si el usuario pierde todos sus roles activos', () => {
      const contextoSinRoles: ContextoUsuarioPoliticaB = {
        usuarioId: 21,
        rolesActivos: [],
        excepciones: [
          { permiso: PermisoSistema.AULAS_VER, tipo: 'CONCEDER' },
        ],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contextoSinRoles);
      expect(efectivos.size).toBe(0);
    });
  });

  describe('3. Revocación de ADMIN_GLOBAL y bypass de superusuario', () => {
    it('otorga todos los permisos del catálogo a un ADMIN_GLOBAL activo', () => {
      const contexto: ContextoUsuarioPoliticaB = {
        usuarioId: 1,
        rolesActivos: [RolSistema.ADMIN_GLOBAL],
        excepciones: [],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contexto);
      expect(efectivos.size).toBe(PERMISOS_SISTEMA.length);
      expect(efectivos.has(PermisoSistema.CARRERAS_GESTIONAR)).toBe(true);
      expect(efectivos.has(PermisoSistema.ESTUDIANTES_GESTIONAR)).toBe(true);
    });

    it('revoca instantáneamente el superusuario cuando ADMIN_GLOBAL es retirado de rolesActivos', () => {
      // El administrador fue degradado a PROFESOR en MySQL
      const contextoDegradado: ContextoUsuarioPoliticaB = {
        usuarioId: 1,
        rolesActivos: [RolSistema.PROFESOR],
        excepciones: [],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contextoDegradado);

      // Pierde acceso a funciones no docentes
      expect(efectivos.has(PermisoSistema.CARRERAS_GESTIONAR)).toBe(false);
      expect(efectivos.has(PermisoSistema.ESTUDIANTES_GESTIONAR)).toBe(false);
      expect(efectivos.has(PermisoSistema.PERIODOS_GESTIONAR)).toBe(false);

      // Conserva únicamente lo propio de PROFESOR
      expect(efectivos.has(PermisoSistema.PERIODOS_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.AULAS_VER)).toBe(true);
      expect(efectivos.size).toBe(2);
    });
  });

  describe('4. Excepciones individuales: DENEGAR (Deny Overrides)', () => {
    it('excluye un permiso de la plantilla si existe una excepción DENEGAR explícita', () => {
      const contexto: ContextoUsuarioPoliticaB = {
        usuarioId: 30,
        rolesActivos: [RolSistema.COORDINADOR],
        excepciones: [
          {
            permiso: PermisoSistema.PERIODOS_GESTIONAR,
            tipo: 'DENEGAR',
            motivo: 'Restricción de seguridad por coordinación adjunta',
          },
        ],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contexto);

      expect(efectivos.has(PermisoSistema.PERIODOS_GESTIONAR)).toBe(false);
      // El resto de la plantilla sigue intacto
      expect(efectivos.has(PermisoSistema.PERIODOS_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.ESTUDIANTES_VER)).toBe(true);
      expect(efectivos.size).toBe(
        PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.COORDINADOR].length - 1,
      );
    });

    it('prevalece DENEGAR incluso si por error existiera una excepción duplicada CONCEDER para el mismo permiso', () => {
      const contexto: ContextoUsuarioPoliticaB = {
        usuarioId: 31,
        rolesActivos: [RolSistema.COORDINADOR],
        excepciones: [
          { permiso: PermisoSistema.ESTUDIANTES_GESTIONAR, tipo: 'CONCEDER' },
          { permiso: PermisoSistema.ESTUDIANTES_GESTIONAR, tipo: 'DENEGAR' },
        ],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contexto);
      expect(efectivos.has(PermisoSistema.ESTUDIANTES_GESTIONAR)).toBe(false);
    });
  });

  describe('5. Excepciones individuales: CONCEDER', () => {
    it('permite a un PROFESOR obtener permisos adicionales autorizados mediante CONCEDER', () => {
      const contexto: ContextoUsuarioPoliticaB = {
        usuarioId: 40,
        rolesActivos: [RolSistema.PROFESOR],
        excepciones: [
          {
            permiso: PermisoSistema.AULAS_GESTIONAR,
            tipo: 'CONCEDER',
            motivo: 'Delegación de administración de laboratorios',
          },
          {
            permiso: PermisoSistema.PROYECCION_VER,
            tipo: 'CONCEDER',
            motivo: 'Comisión de proyección',
          },
        ],
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contexto);

      // Base (2) + Concedidos (2) = 4
      expect(efectivos.size).toBe(4);
      expect(efectivos.has(PermisoSistema.PERIODOS_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.AULAS_VER)).toBe(true);
      expect(efectivos.has(PermisoSistema.AULAS_GESTIONAR)).toBe(true);
      expect(efectivos.has(PermisoSistema.PROYECCION_VER)).toBe(true);
    });
  });

  describe('6. Prevención de escalamiento accidental durante migración (Plantilla vs Legacy)', () => {
    it('genera excepción DENEGAR cuando un permiso de plantilla NO estaba asignado previamente en datos legacy', () => {
      // Escenario de riesgo crítico:
      // Un usuario es COORDINADOR, pero en el sistema legacy un admin le desmarcó PERIODOS_GESTIONAR y CARRERAS_GESTIONAR.
      // Si migramos ingenuamente a Opción B, ¡recuperaría esos permisos por plantilla!
      const rolesActivos = [RolSistema.COORDINADOR];
      const permisosLegacyAsignados = PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.COORDINADOR].filter(
        (p) => p !== PermisoSistema.PERIODOS_GESTIONAR && p !== PermisoSistema.CARRERAS_GESTIONAR,
      );

      const { excepcionesGeneradas } = EvaluadorPoliticaOpcionB.generarExcepcionesMigracion(
        rolesActivos,
        permisosLegacyAsignados,
      );

      // Se deben haber generado exactamente 2 excepciones DENEGAR
      const denegaciones = excepcionesGeneradas.filter((e) => e.tipo === 'DENEGAR');
      expect(denegaciones.length).toBe(2);
      expect(denegaciones.map((d) => d.permiso)).toEqual(
        expect.arrayContaining([
          PermisoSistema.PERIODOS_GESTIONAR,
          PermisoSistema.CARRERAS_GESTIONAR,
        ]),
      );

      // Al evaluar la política con estas excepciones generadas:
      const contextoMigrado: ContextoUsuarioPoliticaB = {
        usuarioId: 50,
        rolesActivos,
        excepciones: excepcionesGeneradas,
      };

      const efectivos = EvaluadorPoliticaOpcionB.resolverPermisosEfectivos(contextoMigrado);

      // El usuario NO adquiere privilegios nuevos accidentalmente
      expect(efectivos.has(PermisoSistema.PERIODOS_GESTIONAR)).toBe(false);
      expect(efectivos.has(PermisoSistema.CARRERAS_GESTIONAR)).toBe(false);
      expect(efectivos.size).toBe(
        PERMISOS_PREDETERMINADOS_POR_ROL[RolSistema.COORDINADOR].length - 2,
      );
    });

    it('identifica como caso ambiguo para revisión del PO cuando un permiso legacy excede el techo del rol', () => {
      // Un ASISTENTE_ESTUDIANTIL tenía en legacy PERIODOS_GESTIONAR (posible residuo o anomalía grave)
      const rolesActivos = [RolSistema.ASISTENTE_ESTUDIANTIL];
      const permisosLegacyAsignados = [
        PermisoSistema.ESTUDIANTES_VER,
        PermisoSistema.PERIODOS_GESTIONAR, // <- Viola techo de asistente
      ];

      const { excepcionesGeneradas, casosAmbiguos } =
        EvaluadorPoliticaOpcionB.generarExcepcionesMigracion(
          rolesActivos,
          permisosLegacyAsignados,
        );

      expect(casosAmbiguos).toContain(PermisoSistema.PERIODOS_GESTIONAR);
      // ESTUDIANTES_VER sí cabe en el techo de asistente, por lo que se propone como CONCEDER
      expect(
        excepcionesGeneradas.some(
          (e) => e.permiso === PermisoSistema.ESTUDIANTES_VER && e.tipo === 'CONCEDER',
        ),
      ).toBe(true);
    });
  });

  describe('7. Matriz de Límites de Seguridad (Techo de Roles y Funciones Reservadas)', () => {
    it('rechaza conceder permisos de gestión a un ASISTENTE_ESTUDIANTIL (techo solo lectura)', () => {
      const validacionGestion = EvaluadorPoliticaOpcionB.validarLimitesSeguridad(
        [RolSistema.ASISTENTE_ESTUDIANTIL],
        { permiso: PermisoSistema.ESTUDIANTES_GESTIONAR, tipo: 'CONCEDER' },
      );
      expect(validacionGestion.valido).toBe(false);
      expect(validacionGestion.motivo).toMatch(/excede el techo de seguridad/);

      const validacionLectura = EvaluadorPoliticaOpcionB.validarLimitesSeguridad(
        [RolSistema.ASISTENTE_ESTUDIANTIL],
        { permiso: PermisoSistema.ESTUDIANTES_VER, tipo: 'CONCEDER' },
      );
      expect(validacionLectura.valido).toBe(true);
    });

    it('rechaza conceder PERIODOS_GESTIONAR o CARRERAS_GESTIONAR a un PROFESOR sin rol de coordinación', () => {
      const validacionPeriodos = EvaluadorPoliticaOpcionB.validarLimitesSeguridad(
        [RolSistema.PROFESOR],
        { permiso: PermisoSistema.PERIODOS_GESTIONAR, tipo: 'CONCEDER' },
      );
      expect(validacionPeriodos.valido).toBe(false);

      const validacionCarreras = EvaluadorPoliticaOpcionB.validarLimitesSeguridad(
        [RolSistema.PROFESOR],
        { permiso: PermisoSistema.CARRERAS_GESTIONAR, tipo: 'CONCEDER' },
      );
      expect(validacionCarreras.valido).toBe(false);

      // AULAS_GESTIONAR sí cabe dentro de las delegaciones autorizadas para profesores
      const validacionAulas = EvaluadorPoliticaOpcionB.validarLimitesSeguridad(
        [RolSistema.PROFESOR],
        { permiso: PermisoSistema.AULAS_GESTIONAR, tipo: 'CONCEDER' },
      );
      expect(validacionAulas.valido).toBe(true);
    });

    it('rechaza cualquier excepción de tipo CONCEDER para un usuario sin roles activos', () => {
      const validacionSinRoles = EvaluadorPoliticaOpcionB.validarLimitesSeguridad([], {
        permiso: PermisoSistema.AULAS_VER,
        tipo: 'CONCEDER',
      });
      expect(validacionSinRoles.valido).toBe(false);
      expect(validacionSinRoles.motivo).toMatch(/sin roles activos/);
    });
  });

  /**
   * Identificación clara de pruebas pendientes de implementación física / BD
   * según requerimiento 7 del usuario.
   */
  describe('8. Pruebas Pendientes de Integración en Base de Datos (Marcadas como pendientes)', () => {
    it.todo(
      '[PENDIENTE MIGRACIÓN] La tabla usuario_permiso_excepciones persiste restricciones UNIQUE (usuario_id, permiso)',
    );

    it.todo(
      '[PENDIENTE MIGRACIÓN] TypeORM UsuarioPermisoExcepcion actualiza correctamente la entidad en MySQL',
    );

    it.todo(
      '[PENDIENTE MIGRACIÓN] PermisosService.reemplazarPermisos ejecuta el cálculo diferencial y persiste en usuario_permiso_excepciones dentro de una transacción',
    );

    it.todo(
      '[PENDIENTE MIGRACIÓN] PermisosGuard resuelve permisos con la tabla de excepciones tras ejecutar la migración autorizada por el Product Owner',
    );
  });
});
