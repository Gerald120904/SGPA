export class ErrorNormalizacionGoogleForms extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorNormalizacionGoogleForms';
  }
}

export interface EstudianteNormalizadoGoogleForms {
  fila: number;
  cedula: string;
  nombres: string;
  apellido1: string;
  apellido2: string | null;
  correoInstitucional: string;
  telefono: string | null;
  periodoIngresoCodigo: string;
  asignaturasAprobadas: string[];
}

export function normalizarRespuestaGoogleForms(
  payload: Record<string, unknown>,
  filaOrigen: number,
): EstudianteNormalizadoGoogleForms {
  if (!payload || typeof payload !== 'object') {
    throw new ErrorNormalizacionGoogleForms(
      'La respuesta no contiene datos válidos.',
    );
  }

  const normalizedKeysMap = new Map<string, unknown>();
  for (const [key, value] of Object.entries(payload)) {
    const cleanKey = simplificarClave(key);
    normalizedKeysMap.set(cleanKey, value);
  }

  const obtenerValor = (...alias: string[]): unknown => {
    for (const a of alias) {
      const clean = simplificarClave(a);
      if (normalizedKeysMap.has(clean)) {
        const val = normalizedKeysMap.get(clean);
        if (val !== undefined && val !== null && val !== '') {
          return val;
        }
      }
    }
    return undefined;
  };

  // 1. Cédula / Identificación
  const cedulaRaw = obtenerValor(
    'cedula',
    'identificacion',
    'numero de identificacion',
    'cédula',
    'identificación',
    'id',
  );
  if (!cedulaRaw) {
    throw new ErrorNormalizacionGoogleForms(
      'El número de identificación (cédula) es obligatorio.',
    );
  }
  const cedula = String(cedulaRaw).trim();
  if (!cedula) {
    throw new ErrorNormalizacionGoogleForms(
      'La cédula no puede estar vacía ni contener solo espacios.',
    );
  }

  // 2. Correo institucional
  const correoRaw = obtenerValor(
    'correoInstitucional',
    'correo estudiantil',
    'correo',
    'email',
    'correo electronico',
    'correo institucional',
  );
  if (!correoRaw) {
    throw new ErrorNormalizacionGoogleForms(
      'El correo estudiantil es obligatorio.',
    );
  }
  const correoInstitucional = String(correoRaw).trim().toLowerCase();
  if (!correoInstitucional.includes('@')) {
    throw new ErrorNormalizacionGoogleForms(
      'El correo institucional no posee un formato válido.',
    );
  }

  // 3. Teléfono
  const telefonoRaw = obtenerValor(
    'telefono',
    'numero telefonico',
    'número telefónico',
    'teléfono',
    'celular',
  );
  const telefono =
    telefonoRaw !== undefined && telefonoRaw !== null
      ? String(telefonoRaw).trim() || null
      : null;

  // 4. Período de ingreso
  const periodoRaw = obtenerValor(
    'periodoIngresoCodigo',
    'periodo de ingreso',
    'período de ingreso',
    'periodo ingreso',
    'periodo',
  );
  if (!periodoRaw) {
    throw new ErrorNormalizacionGoogleForms(
      'El período de ingreso es obligatorio.',
    );
  }
  const periodoIngresoCodigo = String(periodoRaw).trim().toUpperCase();
  if (!periodoIngresoCodigo) {
    throw new ErrorNormalizacionGoogleForms(
      'El código de período de ingreso no puede contener solo espacios.',
    );
  }

  // 5. Nombres y Apellidos
  const { nombres, apellido1, apellido2 } = resolverNombreCompleto(obtenerValor);

  // 6. Asignaturas aprobadas
  const asignaturasAprobadas = resolverAsignaturasAprobadas(
    payload,
    obtenerValor,
  );

  return {
    fila: filaOrigen,
    cedula,
    nombres,
    apellido1,
    apellido2,
    correoInstitucional,
    telefono,
    periodoIngresoCodigo,
    asignaturasAprobadas,
  };
}

function resolverNombreCompleto(
  obtenerValor: (...alias: string[]) => unknown,
): { nombres: string; apellido1: string; apellido2: string | null } {
  const nombresDirectos = obtenerValor('nombres', 'nombre');
  const apellido1Directo = obtenerValor(
    'apellido1',
    'primer apellido',
    'primer_apellido',
  );
  const apellido2Directo = obtenerValor(
    'apellido2',
    'segundo apellido',
    'segundo_apellido',
  );

  if (nombresDirectos && apellido1Directo) {
    const nombres = String(nombresDirectos).trim();
    const apellido1 = String(apellido1Directo).trim();
    const apellido2 = apellido2Directo ? String(apellido2Directo).trim() : null;

    if (!nombres || !apellido1) {
      throw new ErrorNormalizacionGoogleForms(
        'Los nombres y el primer apellido no pueden contener solo espacios.',
      );
    }
    return { nombres, apellido1, apellido2 };
  }

  const nombreCompletoRaw = obtenerValor(
    'nombreCompleto',
    'nombre completo',
    'nombre completo (nombre1, nombre2, apellido1, apellido2)',
    'nombre y apellidos',
  );

  if (!nombreCompletoRaw) {
    throw new ErrorNormalizacionGoogleForms(
      'Los nombres y apellidos del estudiante son requeridos.',
    );
  }

  const tokens = String(nombreCompletoRaw)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length < 2) {
    throw new ErrorNormalizacionGoogleForms(
      'El nombre completo es insuficiente (debe incluir nombre y al menos un apellido).',
    );
  }

  if (tokens.length === 2) {
    return {
      nombres: tokens[0],
      apellido1: tokens[1],
      apellido2: null,
    };
  }

  if (tokens.length === 3) {
    return {
      nombres: tokens[0],
      apellido1: tokens[1],
      apellido2: tokens[2],
    };
  }

  if (tokens.length === 4) {
    return {
      nombres: `${tokens[0]} ${tokens[1]}`,
      apellido1: tokens[2],
      apellido2: tokens[3],
    };
  }

  // Si tiene 5 o más palabras (ej. nombres o apellidos con conectores complejos),
  // no se adivina para no inventar apellidos erróneos.
  throw new ErrorNormalizacionGoogleForms(
    `El nombre completo ("${String(nombreCompletoRaw).trim()}") contiene una estructura compuesta y requiere revisión manual.`,
  );
}

function resolverAsignaturasAprobadas(
  payload: Record<string, unknown>,
  obtenerValor: (...alias: string[]) => unknown,
): string[] {
  const asignaturasDirectas = obtenerValor(
    'asignaturasAprobadas',
    'asignaturas aprobadas',
    'cursos aprobados',
    'materias aprobadas',
    'asignaturas',
  );

  const materiasBrutas: string[] = [];

  if (Array.isArray(asignaturasDirectas)) {
    for (const item of asignaturasDirectas) {
      if (typeof item === 'string') {
        materiasBrutas.push(item);
      }
    }
  } else if (typeof asignaturasDirectas === 'string') {
    // Si viene como string delimitado por coma o salto de línea
    const partes = asignaturasDirectas
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    materiasBrutas.push(...partes);
  } else {
    // Buscar si hay columnas individuales por curso que estén marcadas como aprobadas
    for (const [key, val] of Object.entries(payload)) {
      if (typeof val === 'boolean' && val) {
        materiasBrutas.push(key);
      } else if (typeof val === 'string' && val.trim()) {
        const valLower = val.trim().toLowerCase();
        if (
          valLower === 'si' ||
          valLower === 'sí' ||
          valLower === 'aprobado' ||
          valLower === 'aprobada' ||
          valLower === 'true' ||
          valLower === 'x'
        ) {
          materiasBrutas.push(key);
        }
      }
    }
  }

  const codigos = new Set<string>();
  for (const item of materiasBrutas) {
    const codigoExtraido = extraerCodigoAsignatura(item);
    if (codigoExtraido) {
      codigos.add(codigoExtraido);
    }
  }

  return Array.from(codigos);
}

export function extraerCodigoAsignatura(texto: string): string | null {
  if (!texto || typeof texto !== 'string') return null;
  const limpio = texto.trim();
  if (!limpio) return null;

  // Busca patrones como EIF200, EIF 200, EIF-200, MAT030, MAT-030, HUM101, etc.
  const match = limpio.match(
    /(?:^|\b)([A-Za-z]{2,5})\s*[-]?\s*([0-9]{2,4}[A-Za-z]?)(?:\b|$)/,
  );
  if (match) {
    const prefijo = match[1].toUpperCase();
    const numero = match[2].toUpperCase();
    return `${prefijo}${numero}`;
  }

  // Si no coincide con el regex de código, pero es una cadena alfanumérica corta
  if (/^[A-Za-z0-9_-]{3,15}$/.test(limpio)) {
    return limpio.toUpperCase().replace(/\s+/g, '');
  }

  return null;
}

function simplificarClave(clave: string): string {
  return clave
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover tildes
    .replace(/[^a-z0-9]/g, ''); // Solo alfanuméricos
}
