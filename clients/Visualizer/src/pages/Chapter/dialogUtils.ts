import { ApiError } from '../../api';

export const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const errorText = (e: unknown) =>
    e instanceof ApiError ? (e.body.message ?? e.message) : e instanceof Error ? e.message : String(e);

export const idError = (id: string) =>
    id === ''
        ? _('Required')
        : id.includes('-')
          ? _('Ids must not contain "-"')
          : !ID_RE.test(id)
            ? _('Letters, digits and _ only; not starting with a digit')
            : null;
