import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';
import { RolSistema } from './constants/roles.constants';

type Contexto = { usuarioId?: number; rolActivo?: RolSistema };
const storage = new AsyncLocalStorage<Contexto>();

export const iniciarContextoRolActivo: RequestHandler = (_request, _response, next) => {
  storage.run({}, next);
};

export function establecerRolActivo(usuarioId: number, rolActivo: RolSistema): void {
  const contexto = storage.getStore();
  if (contexto) {
    contexto.usuarioId = usuarioId;
    contexto.rolActivo = rolActivo;
  }
}

export function rolActivoDePeticion(usuarioId: number): RolSistema | undefined {
  const contexto = storage.getStore();
  return contexto?.usuarioId === usuarioId ? contexto.rolActivo : undefined;
}
