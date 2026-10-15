const TOLERANCIA = 0.5;

function centroX(rect) {
  return (rect.left + rect.right) / 2;
}

function centroY(rect) {
  return (rect.top + rect.bottom) / 2;
}

function limitar(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

export function expandirRectangulo(rect, margen = 0) {
  return {
    ...rect,
    left: rect.left - margen,
    right: rect.right + margen,
    top: rect.top - margen,
    bottom: rect.bottom + margen,
    width: rect.right - rect.left + margen * 2,
    height: rect.bottom - rect.top + margen * 2,
  };
}

export function segmentoCruzaRectangulo(x1, y1, x2, y2, rect) {
  if (Math.abs(y1 - y2) <= TOLERANCIA) {
    const izquierda = Math.min(x1, x2);
    const derecha = Math.max(x1, x2);

    return (
      y1 > rect.top &&
      y1 < rect.bottom &&
      derecha > rect.left &&
      izquierda < rect.right
    );
  }

  if (Math.abs(x1 - x2) <= TOLERANCIA) {
    const arriba = Math.min(y1, y2);
    const abajo = Math.max(y1, y2);

    return (
      x1 > rect.left &&
      x1 < rect.right &&
      abajo > rect.top &&
      arriba < rect.bottom
    );
  }

  return false;
}

function puntoDentroRectangulo(punto, rect) {
  return (
    punto.x > rect.left &&
    punto.x < rect.right &&
    punto.y > rect.top &&
    punto.y < rect.bottom
  );
}

function segmentoLibre(origen, destino, obstaculos) {
  return !obstaculos.some((rect) =>
    segmentoCruzaRectangulo(
      origen.x,
      origen.y,
      destino.x,
      destino.y,
      rect,
    ),
  );
}

export function simplificarPuntosOrtogonal(puntos) {
  if (puntos.length <= 2) {
    return puntos;
  }

  const resultado = [puntos[0]];

  for (let i = 1; i < puntos.length - 1; i += 1) {
    const anterior = resultado[resultado.length - 1];
    const actual = puntos[i];
    const siguiente = puntos[i + 1];
    const mismaHorizontal =
      Math.abs(anterior.y - actual.y) < TOLERANCIA &&
      Math.abs(actual.y - siguiente.y) < TOLERANCIA;
    const mismaVertical =
      Math.abs(anterior.x - actual.x) < TOLERANCIA &&
      Math.abs(actual.x - siguiente.x) < TOLERANCIA;

    if (!mismaHorizontal && !mismaVertical) {
      resultado.push(actual);
    }
  }

  resultado.push(puntos[puntos.length - 1]);
  return resultado;
}

export function construirPathRedondeado(puntos, radio = 8) {
  const ruta = simplificarPuntosOrtogonal(puntos);

  if (ruta.length < 2) {
    return "";
  }

  let d = `M ${ruta[0].x} ${ruta[0].y}`;

  for (let i = 1; i < ruta.length - 1; i += 1) {
    const anterior = ruta[i - 1];
    const actual = ruta[i];
    const siguiente = ruta[i + 1];
    const distanciaAnterior = Math.hypot(
      actual.x - anterior.x,
      actual.y - anterior.y,
    );
    const distanciaSiguiente = Math.hypot(
      siguiente.x - actual.x,
      siguiente.y - actual.y,
    );
    const r = Math.min(radio, distanciaAnterior / 2, distanciaSiguiente / 2);
    const antes = {
      x:
        actual.x +
        ((anterior.x - actual.x) / Math.max(distanciaAnterior, 1)) * r,
      y:
        actual.y +
        ((anterior.y - actual.y) / Math.max(distanciaAnterior, 1)) * r,
    };
    const despues = {
      x:
        actual.x +
        ((siguiente.x - actual.x) / Math.max(distanciaSiguiente, 1)) * r,
      y:
        actual.y +
        ((siguiente.y - actual.y) / Math.max(distanciaSiguiente, 1)) * r,
    };

    d += ` L ${antes.x} ${antes.y}`;
    d += ` Q ${actual.x} ${actual.y} ${despues.x} ${despues.y}`;
  }

  const ultimo = ruta[ruta.length - 1];
  return `${d} L ${ultimo.x} ${ultimo.y}`;
}

function valoresUnicosOrdenados(valores) {
  return Array.from(
    new Set(valores.filter(Number.isFinite).map((valor) => Number(valor.toFixed(3)))),
  ).sort((a, b) => a - b);
}

/*
 * Enrutador ortogonal por grafo de visibilidad. Solo crea nodos sobre
 * bordes/corredores libres, penaliza giros y nunca cruza los rectángulos.
 */
export function buscarRutaOrtogonal({
  origen,
  destino,
  obstaculos = [],
  ancho,
  alto,
}) {
  const xs = valoresUnicosOrdenados([
    4,
    ancho - 4,
    origen.x,
    destino.x,
    ...obstaculos.flatMap((rect) => [rect.left - 2, rect.right + 2]),
  ].map((x) => limitar(x, 4, ancho - 4)));
  const ys = valoresUnicosOrdenados([
    4,
    alto - 4,
    origen.y,
    destino.y,
    ...obstaculos.flatMap((rect) => [rect.top - 2, rect.bottom + 2]),
  ].map((y) => limitar(y, 4, alto - 4)));
  const nodos = [];
  const indicePorCoordenada = new Map();

  for (const x of xs) {
    for (const y of ys) {
      const punto = { x, y };
      if (obstaculos.some((rect) => puntoDentroRectangulo(punto, rect))) {
        continue;
      }
      const indice = nodos.length;
      nodos.push(punto);
      indicePorCoordenada.set(`${x}|${y}`, indice);
    }
  }

  const inicio = indicePorCoordenada.get(`${Number(origen.x.toFixed(3))}|${Number(origen.y.toFixed(3))}`);
  const fin = indicePorCoordenada.get(`${Number(destino.x.toFixed(3))}|${Number(destino.y.toFixed(3))}`);

  if (inicio === undefined || fin === undefined) {
    return [];
  }

  const adyacencias = Array.from({ length: nodos.length }, () => []);
  const conectarLista = (indices, eje) => {
    const ordenados = [...indices].sort((a, b) => nodos[a][eje] - nodos[b][eje]);
    for (let i = 0; i < ordenados.length - 1; i += 1) {
      const a = ordenados[i];
      const b = ordenados[i + 1];
      if (!segmentoLibre(nodos[a], nodos[b], obstaculos)) {
        continue;
      }
      const distancia = Math.abs(nodos[a].x - nodos[b].x) + Math.abs(nodos[a].y - nodos[b].y);
      const direccion = eje === "x" ? "H" : "V";
      adyacencias[a].push({ indice: b, distancia, direccion });
      adyacencias[b].push({ indice: a, distancia, direccion });
    }
  };

  for (const y of ys) {
    conectarLista(
      xs.map((x) => indicePorCoordenada.get(`${x}|${y}`)).filter((v) => v !== undefined),
      "x",
    );
  }
  for (const x of xs) {
    conectarLista(
      ys.map((y) => indicePorCoordenada.get(`${x}|${y}`)).filter((v) => v !== undefined),
      "y",
    );
  }

  const estados = new Map();
  const pendientes = [{ indice: inicio, direccion: "N", costo: 0, clave: `${inicio}|N` }];
  estados.set(`${inicio}|N`, { costo: 0, anterior: null });
  let claveFinal = null;

  while (pendientes.length > 0) {
    pendientes.sort((a, b) => a.costo - b.costo || a.clave.localeCompare(b.clave));
    const actual = pendientes.shift();
    if (actual.costo !== estados.get(actual.clave)?.costo) {
      continue;
    }
    if (actual.indice === fin) {
      claveFinal = actual.clave;
      break;
    }

    for (const arista of adyacencias[actual.indice]) {
      const giro = actual.direccion !== "N" && actual.direccion !== arista.direccion;
      const costo = actual.costo + arista.distancia + (giro ? 18 : 0);
      const clave = `${arista.indice}|${arista.direccion}`;
      if (costo >= (estados.get(clave)?.costo ?? Number.POSITIVE_INFINITY)) {
        continue;
      }
      estados.set(clave, { costo, anterior: actual.clave });
      pendientes.push({ indice: arista.indice, direccion: arista.direccion, costo, clave });
    }
  }

  if (!claveFinal) {
    return [];
  }

  const ruta = [];
  for (let clave = claveFinal; clave; clave = estados.get(clave)?.anterior) {
    ruta.push(nodos[Number(clave.split("|")[0])]);
  }
  return simplificarPuntosOrtogonal(ruta.reverse());
}

export function agruparRelacionesPorDestinoYTipo(relaciones) {
  const grupos = new Map();
  const relacionesVistas = new Set();

  for (const relacion of relaciones) {
    const tipo = relacion.tipo === "CORREQUISITO" ? "CORREQUISITO" : "REQUISITO";
    const claveRelacion = `${relacion.origenId}|${relacion.destinoId}|${tipo}`;
    if (relacionesVistas.has(claveRelacion)) {
      continue;
    }
    relacionesVistas.add(claveRelacion);
    const clave = `${relacion.destinoId}|${tipo}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, { destinoId: relacion.destinoId, tipo, relaciones: [] });
    }
    grupos.get(clave).relaciones.push({ ...relacion, tipo });
  }

  return Array.from(grupos.values()).sort((a, b) => {
    const claveA = `${a.destinoId}|${a.tipo}`;
    const claveB = `${b.destinoId}|${b.tipo}`;
    return claveA.localeCompare(claveB, "es", { numeric: true });
  });
}

function ladoRelacion(rectOrigen, rectDestino) {
  if (centroX(rectOrigen) < rectDestino.left) return "IZQUIERDA";
  if (centroX(rectOrigen) > rectDestino.right) return "DERECHA";
  return "MISMA_COLUMNA";
}

function puertosRelacion(rectOrigen, rectDestino, lado, desplazamientoDestino = 0) {
  const origenEstaALaIzquierda = lado === "IZQUIERDA";
  const origenEstaALaDerecha = lado === "DERECHA";
  const margenVertical = Math.min(18, (rectDestino.bottom - rectDestino.top) / 4);
  return {
    origen: {
      x: origenEstaALaIzquierda
        ? rectOrigen.right
        : origenEstaALaDerecha
          ? rectOrigen.left
          : rectOrigen.right,
      y: centroY(rectOrigen),
    },
    destino: {
      x: origenEstaALaIzquierda ? rectDestino.left : rectDestino.right,
      y: limitar(
        centroY(rectDestino) + desplazamientoDestino,
        rectDestino.top + margenVertical,
        rectDestino.bottom - margenVertical,
      ),
    },
  };
}

function desplazamientoTipoDestino(relacion, contexto) {
  const tipos = contexto.tiposPorDestino.get(String(relacion.destinoId));
  if (!tipos || tipos.size < 2) return 0;
  return relacion.tipo === "CORREQUISITO" ? 12 : -12;
}

function direccionExterior(lado) {
  return lado === "DERECHA" ? -1 : 1;
}

function separarPuerto(puerto, lado) {
  return { x: puerto.x + direccionExterior(lado) * 8, y: puerto.y };
}

function longitudPolilinea(puntos) {
  let longitud = 0;
  for (let i = 0; i < puntos.length - 1; i += 1) {
    longitud +=
      Math.abs(puntos[i + 1].x - puntos[i].x) +
      Math.abs(puntos[i + 1].y - puntos[i].y);
  }
  return longitud;
}

function puntuacionVisualRutas(rutas) {
  return rutas.reduce(
    (total, ruta) =>
      total +
      longitudPolilinea(ruta.puntos) +
      Math.max(0, ruta.puntos.length - 2) * 18,
    0,
  );
}

function recortarRamaAlEntrarEnTroncal(puntos, xTroncal) {
  const indiceEntrada = puntos.findIndex(
    (punto, indice) =>
      indice > 0 && Math.abs(punto.x - xTroncal) <= TOLERANCIA,
  );

  return indiceEntrada > 0 ? puntos.slice(0, indiceEntrada + 1) : puntos;
}

function rutaIndividual(relacion, contexto, indice = 0, total = 1) {
  const rectOrigen = contexto.rectangulos.get(String(relacion.origenId));
  const rectDestino = contexto.rectangulos.get(String(relacion.destinoId));
  if (!rectOrigen || !rectDestino) return [];
  const lado = ladoRelacion(rectOrigen, rectDestino);
  const separacion = Math.min(12, 28 / Math.max(total - 1, 1));
  const desplazamientoDestino =
    desplazamientoTipoDestino(relacion, contexto) +
    (indice - (total - 1) / 2) * separacion;
  const puertos = puertosRelacion(
    rectOrigen,
    rectDestino,
    lado,
    desplazamientoDestino,
  );
  const obstaculos = contexto.obstaculos.filter(
    (item) =>
      String(item.id) !== String(relacion.origenId) &&
      String(item.id) !== String(relacion.destinoId),
  );
  obstaculos.push(rectOrigen, rectDestino);
  const salida = separarPuerto(puertos.origen, lado);
  const entrada = {
    x: puertos.destino.x + (lado === "IZQUIERDA" ? -8 : 8),
    y: puertos.destino.y,
  };
  const recorrido = buscarRutaOrtogonal({
    origen: salida,
    destino: entrada,
    obstaculos,
    ancho: contexto.ancho,
    alto: contexto.alto,
  });
  const puntos = recorrido.length
    ? simplificarPuntosOrtogonal([puertos.origen, ...recorrido, puertos.destino])
    : [];
  return puntos.length
    ? [{ tipo: relacion.tipo, clase: "individual", flecha: true, puntos, relaciones: [relacion] }]
    : [];
}

function intentarTroncal(relaciones, contexto, indiceTipo) {
  const primera = relaciones[0];
  const rectDestino = contexto.rectangulos.get(String(primera.destinoId));
  if (!rectDestino) return [];
  const rectOrigenInicial = contexto.rectangulos.get(String(primera.origenId));
  const lado = ladoRelacion(rectOrigenInicial, rectDestino);
  const puertoDestino = puertosRelacion(
    rectOrigenInicial,
    rectDestino,
    lado,
    desplazamientoTipoDestino(primera, contexto),
  ).destino;
  const direccionExterior = lado === "IZQUIERDA" ? -1 : 1;
  const distancias = [12, 20, 30, 42, 58].map((valor) => valor + indiceTipo * 9);
  const joinsY = relaciones.map((relacion) =>
    centroY(contexto.rectangulos.get(String(relacion.origenId))),
  );
  const minY = Math.min(puertoDestino.y, ...joinsY);
  const maxY = Math.max(puertoDestino.y, ...joinsY);
  const obstaculosTroncal = contexto.obstaculos.map(({ id, ...rect }) => rect);
  const candidatosX = distancias
    .map((distancia) => puertoDestino.x + direccionExterior * distancia)
    .filter((x) =>
      x > 4 &&
      x < contexto.ancho - 4 &&
      segmentoLibre({ x, y: minY }, { x, y: maxY }, obstaculosTroncal),
    );
  if (!candidatosX.length) return [];

  const rutasIndividuales = relaciones.flatMap((relacion, indice) =>
    rutaIndividual(relacion, contexto, indice, relaciones.length),
  );
  const costoIndividual = rutasIndividuales.length === relaciones.length
    ? puntuacionVisualRutas(rutasIndividuales)
    : Number.POSITIVE_INFINITY;
  let mejor = null;

  for (const xTroncal of candidatosX) {
    if (!segmentoLibre(
      { x: xTroncal, y: puertoDestino.y },
      puertoDestino,
      contexto.obstaculos.filter(
        (item) => String(item.id) !== String(primera.destinoId),
      ),
    )) continue;
    const ramas = [];
    const entradasY = [];
    for (const relacion of relaciones) {
      const rectOrigen = contexto.rectangulos.get(String(relacion.origenId));
      const puertoOrigen = puertosRelacion(rectOrigen, rectDestino, lado).origen;
      const obstaculos = contexto.obstaculos
        .filter((item) => String(item.id) !== String(relacion.origenId))
        .map(({ id, ...rect }) => rect);
      const salida = separarPuerto(puertoOrigen, lado);
      const recorrido = buscarRutaOrtogonal({
        origen: salida,
        destino: { x: xTroncal, y: centroY(rectOrigen) },
        obstaculos,
        ancho: contexto.ancho,
        alto: contexto.alto,
      });
      if (!recorrido.length) break;
      const puntos = simplificarPuntosOrtogonal([puertoOrigen, ...recorrido]);
      const puntosRama = recortarRamaAlEntrarEnTroncal(puntos, xTroncal);
      if (puntosRama.length < 2) break;
      entradasY.push(puntosRama.at(-1).y);
      ramas.push({
        tipo: relacion.tipo,
        clase: "rama",
        flecha: false,
        puntos: puntosRama,
        relaciones: [relacion],
      });
    }
    if (ramas.length !== relaciones.length) continue;

    const minYTroncal = Math.min(puertoDestino.y, ...entradasY);
    const maxYTroncal = Math.max(puertoDestino.y, ...entradasY);
    if (!segmentoLibre(
      { x: xTroncal, y: minYTroncal },
      { x: xTroncal, y: maxYTroncal },
      obstaculosTroncal,
    )) continue;

    const entrada = [{ x: xTroncal, y: puertoDestino.y }, puertoDestino];
    const rutas = [
      ...ramas,
      {
        tipo: primera.tipo,
        clase: "troncal",
        flecha: false,
        puntos: [{ x: xTroncal, y: minYTroncal }, { x: xTroncal, y: maxYTroncal }],
        relaciones,
      },
      { tipo: primera.tipo, clase: "entrada", flecha: true, puntos: entrada, relaciones },
    ];
    const costo = puntuacionVisualRutas(rutas);
    if (costo < (mejor?.costo ?? Number.POSITIVE_INFINITY)) {
      mejor = { rutas, costo };
    }
  }
  return mejor && mejor.costo <= costoIndividual * 1.35 ? mejor.rutas : [];
}

export function calcularRutasTroncales({
  relaciones,
  rectangulos,
  obstaculos = [],
  ancho,
  alto,
}) {
  const mapaRectangulos = rectangulos instanceof Map
    ? new Map(Array.from(rectangulos, ([id, rect]) => [String(id), rect]))
    : new Map(Object.entries(rectangulos || {}));
  const tiposPorDestino = new Map();
  for (const relacion of relaciones) {
    const id = String(relacion.destinoId);
    if (!tiposPorDestino.has(id)) tiposPorDestino.set(id, new Set());
    tiposPorDestino.get(id).add(relacion.tipo);
  }
  const contexto = {
    rectangulos: mapaRectangulos,
    obstaculos,
    ancho,
    alto,
    tiposPorDestino,
  };
  const rutas = [];

  for (const grupo of agruparRelacionesPorDestinoYTipo(relaciones)) {
    const porLado = new Map();
    for (const relacion of grupo.relaciones) {
      const origen = mapaRectangulos.get(String(relacion.origenId));
      const destino = mapaRectangulos.get(String(relacion.destinoId));
      if (!origen || !destino) continue;
      const lado = ladoRelacion(origen, destino);
      if (!porLado.has(lado)) porLado.set(lado, []);
      porLado.get(lado).push(relacion);
    }

    for (const relacionesLado of porLado.values()) {
      const indiceTipo = grupo.tipo === "CORREQUISITO" ? 1 : 0;
      const compartidas = relacionesLado.length > 1
        ? intentarTroncal(relacionesLado, contexto, indiceTipo)
        : [];
      if (compartidas.length) {
        rutas.push(...compartidas);
      } else {
        for (const [indice, relacion] of relacionesLado.entries()) {
          rutas.push(
            ...rutaIndividual(relacion, contexto, indice, relacionesLado.length),
          );
        }
      }
    }
  }

  return rutas;
}

export function rutaCruzaObstaculos(puntos, obstaculos) {
  for (let i = 0; i < puntos.length - 1; i += 1) {
    if (obstaculos.some((rect) =>
      segmentoCruzaRectangulo(
        puntos[i].x,
        puntos[i].y,
        puntos[i + 1].x,
        puntos[i + 1].y,
        rect,
      ))) {
      return true;
    }
  }
  return false;
}
