/**
 * SGPA — Coordinador principal del módulo Aulas.
 */

import {
  compararAulasPorEstadoYNumero,
  prefijoVisibleEspacio,
} from './aulas.helpers.js';
import {
  crearContextoAulas,
  puedeGestionarAulas,
  validarGestionAulas,
} from './aulas.context.js';
import {
  cargarAulas,
  renderizarVistaListado,
} from './AulasListadoView.js';
import {
  abrirAccionesAulaPlano,
  cambiarDisponibilidadAcademicaAulaPlano,
  solicitarHabilitacionSlotAdministrativo,
} from './AulasPlanosView.js';
import {
  abrirFormularioAula as abrirFormularioAulaComponente,
} from './AulaFormDialog.js';
import {
  abrirCatalogoEquipamientos,
} from './AulasEquipamientosCatalogoView.js';
import {
  abrirDetalleAula as abrirDetalleAulaVista,
} from './AulaDetalleView.js';
import {
  renderizarEquipamientoDelAula as renderizarEquipamientoDelAulaComponente,
} from './AulaEquipamientoDialog.js';
import {
  renderizarSeccionOcupacion as renderizarSeccionOcupacionVista,
} from './AulaOcupacionView.js';
import {
  abrirBusquedaAulasDisponibles,
} from './AulasBusquedaView.js';

const contextoAulas = crearContextoAulas();

// Reexportación pública y referencia directa de helpers compartidos del módulo.
export { compararAulasPorEstadoYNumero };

/* =========================================================
   PÁGINA
   ========================================================= */

export function AulasPage() {
  return `
    <section
      id="aulasPage"
      class="module-view aulas-page"
    >
      <div id="aulasVista"></div>

      <dialog
        id="aulaDialog"
        class="
          sgpa-form-dialog
          sgpa-form-dialog-md
        "
      >
        <div id="aulaDialogContent"></div>
      </dialog>
    </section>
  `;
}

/* =========================================================
   COORDINACIÓN DE SUBVISTAS Y DIÁLOGOS
   ========================================================= */

function abrirFormularioAula(aula = null, sugerencia = null) {
  return abrirFormularioAulaComponente({
    aula,
    sugerencia,
    aulas: contextoAulas.estado.aulas,
    onGuardado: async () => {
      await iniciarAulasPage();
    },
    puedeGestionar: validarGestionAulas(),
  });
}

async function abrirDetalleAula(aulaId) {
  return abrirDetalleAulaVista(aulaId, contextoAulas, {
    onVolver: iniciarAulasPage,
  });
}

function renderizarEquipamientoDelAula(equipamientos) {
  return renderizarEquipamientoDelAulaComponente(
    equipamientos,
    puedeGestionarAulas(),
  );
}

function renderizarSeccionOcupacion() {
  return renderizarSeccionOcupacionVista();
}

function construirAccionesListado() {
  return {
    onVerDetalle: abrirDetalleAula,
    onAbrirFormularioAula: abrirFormularioAula,
    onAbrirCatalogoEquipamientos: () =>
      abrirCatalogoEquipamientos(contextoAulas, {
        onVolver: iniciarAulasPage,
      }),
    onAbrirBusquedaDisponibles: () =>
      abrirBusquedaAulasDisponibles(contextoAulas, {
        onVolver: iniciarAulasPage,
        onVerDetalle: abrirDetalleAula,
      }),
    onAbrirAccionesPlano: (aula) =>
      abrirAccionesAulaPlano({
        aula,
        puedeGestionar: puedeGestionarAulas(),
        onVerDetalle: abrirDetalleAula,
        onEditarAula: (item) => abrirFormularioAula(item),
        onCambiarDisponibilidad: (item) =>
          cambiarDisponibilidadAcademicaAulaPlano({
            aula: item,
            onActualizado: iniciarAulasPage,
          }),
      }),
    onSolicitarHabilitacionSlot: (slot) =>
      solicitarHabilitacionSlotAdministrativo({
        slot,
        onAbrirFormulario: abrirFormularioAula,
      }),
    onRefrescarPagina: iniciarAulasPage,
  };
}

// Referencia explícita conservada para trazabilidad estática del helper reutilizado.
void prefijoVisibleEspacio;
void renderizarEquipamientoDelAula;
void renderizarSeccionOcupacion;

/* =========================================================
   INICIALIZADOR
   ========================================================= */

export function iniciarAulasPage() {
  const { instancia } = contextoAulas.iniciarInstancia();

  renderizarVistaListado(contextoAulas, construirAccionesListado());
  cargarAulas(instancia, contextoAulas);
}
