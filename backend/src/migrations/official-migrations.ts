import { InitializeOrAdoptSchema2026101400000 } from './2026101400000-InitializeOrAdoptSchema';
import { AddOptativeRuleCounts2026101500000 } from './2026101500000-AddOptativeRuleCounts';
import { AddAulaEquipmentInventory2026101600000 } from './2026101600000-AddAulaEquipmentInventory';
import { AddInvitationOutbox2026101700000 } from './2026101700000-AddInvitationOutbox';
import { AddHierarchicalAccess2026101900000 } from './2026101900000-AddHierarchicalAccess';
import { AddInternalFormSupport2026102100000 } from './2026102100000-AddInternalFormSupport';
import { AddMissingRuntimeTables2026102200000 } from './2026102200000-AddMissingRuntimeTables';
import { EnsureOfficialRoles2026102201000 } from './2026102201000-EnsureOfficialRoles';
import { ConsolidatedAuditRestructuring2026103000000 } from './2026103000000-ConsolidatedAuditRestructuring';
import { AddAuthenticationVersion2026103001000 } from './2026103001000-AddAuthenticationVersion';
import { AddNotificationIdempotency2026103002000 } from './2026103002000-AddNotificationIdempotency';
import { AddEstudiantesRevisionYAuditoria2026103100000 } from './2026103100000-AddEstudiantesRevisionYAuditoria';
import { AddSolicitudesActivasEstudiantes2026110100000 } from './2026110100000-AddSolicitudesActivasEstudiantes';
import { AddPlanesEstudioTransicionesYAuditoria2026110101000 } from './2026110101000-AddPlanesEstudioTransicionesYAuditoria';
import { AddOptativaRealHistorialEstudiante2026110400000 } from './2026110400000-AddOptativaRealHistorialEstudiante';
import { AddAuditoriaPeriodosExcepcionales2026110700000 } from './2026110700000-AddAuditoriaPeriodosExcepcionales';
import { AddCorreoRechazoOutbox2026110701000 } from './2026110701000-AddCorreoRechazoOutbox';
import { SepararEntregaTitulos2026110702000 } from './2026110702000-SepararEntregaTitulos';
import { VersionadoPlanesEstudio2026110703000 } from './2026110703000-VersionadoPlanesEstudio';
import { ConvalidacionesExternas2026110704000 } from './2026110704000-ConvalidacionesExternas';
import { AddGoogleCuentaInstitucional2026110705000 } from './2026110705000-AddGoogleCuentaInstitucional';

export const OFFICIAL_MIGRATIONS = [
  InitializeOrAdoptSchema2026101400000,
  AddOptativeRuleCounts2026101500000,
  AddAulaEquipmentInventory2026101600000,
  AddInvitationOutbox2026101700000,
  AddHierarchicalAccess2026101900000,
  AddInternalFormSupport2026102100000,
  AddMissingRuntimeTables2026102200000,
  EnsureOfficialRoles2026102201000,
  ConsolidatedAuditRestructuring2026103000000,
  AddAuthenticationVersion2026103001000,
  AddNotificationIdempotency2026103002000,
  AddEstudiantesRevisionYAuditoria2026103100000,
  AddSolicitudesActivasEstudiantes2026110100000,
  AddPlanesEstudioTransicionesYAuditoria2026110101000,
  AddOptativaRealHistorialEstudiante2026110400000,
  AddAuditoriaPeriodosExcepcionales2026110700000,
  AddCorreoRechazoOutbox2026110701000,
  SepararEntregaTitulos2026110702000,
  VersionadoPlanesEstudio2026110703000,
  ConvalidacionesExternas2026110704000,
  AddGoogleCuentaInstitucional2026110705000,
] as const;

export const OFFICIAL_MIGRATION_NAMES = OFFICIAL_MIGRATIONS.map(
  (migration) => migration.name,
);
