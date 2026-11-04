import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';
import { RolSistema } from './constants/roles.constants';

type Contexto = { usuarioId?: number; rolActivo?: RolSistema; carreraActiva?: number | null };
const storage = new AsyncLocalStorage<Contexto>();

export const iniciarContextoRolActivo: RequestHandler = (_request, _response, next) => {
  storage.run({}, next);
};

export function establecerRolActivo(usuarioId: number, rolActivo: RolSistema,
  carreraActiva?: number | null): void {
  const contexto = storage.getStore();
  if (contexto) {
    contexto.usuarioId = usuarioId;
    contexto.rolActivo = rolActivo;
    contexto.carreraActiva = carreraActiva;
  }
}

export function carreraActivaDePeticion(usuarioId: number): number | null | undefined {
  const contexto = storage.getStore();
  return contexto?.usuarioId === usuarioId && contexto.rolActivo === RolSistema.ASISTENTE_ESTUDIANTIL
    ? contexto.carreraActiva : undefined;
}

export function rolActivoDePeticion(usuarioId: number): RolSistema | undefined {
  const contexto = storage.getStore();
  return contexto?.usuarioId === usuarioId ? contexto.rolActivo : undefined;
}
