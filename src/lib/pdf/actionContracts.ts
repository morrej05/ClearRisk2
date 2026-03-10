export const ACTIVE_ACTION_STATUSES = new Set(['open', 'in_progress'] as const);

export interface ActionContractShape {
  id: string;
  status?: string | null;
  reference_number?: string | null;
  created_at?: string | null;
}

export function isActiveActionStatus(status?: string | null): boolean {
  return !!status && ACTIVE_ACTION_STATUSES.has(status as 'open' | 'in_progress');
}

export function filterActiveActions<T extends ActionContractShape>(actions: T[]): T[] {
  return actions.filter((action) => isActiveActionStatus(action.status));
}

function toTime(value?: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/**
 * Shared display sort contract for PDF action lists:
 * 1) reference_number ASC (actions with a ref first)
 * 2) created_at ASC fallback
 * 3) id ASC deterministic fallback
 */
export function compareActionsByDisplayReference<T extends ActionContractShape>(a: T, b: T): number {
  const aRef = (a.reference_number || '').trim();
  const bRef = (b.reference_number || '').trim();

  if (aRef && bRef) {
    const refCompare = aRef.localeCompare(bRef);
    if (refCompare !== 0) return refCompare;
  } else if (aRef) {
    return -1;
  } else if (bRef) {
    return 1;
  }

  const createdCompare = toTime(a.created_at) - toTime(b.created_at);
  if (createdCompare !== 0) return createdCompare;

  return a.id.localeCompare(b.id);
}