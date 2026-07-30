import type { SecurityStore } from './security';
import { withSecurityLock } from './security';
import {
  normalizeSourceBlockInput,
  sourceBlockStoreKey,
  type NormalizedSourceBlock,
  type SourceBlockInput,
  type SourceBlockRecord,
} from './source-blocks';

const PREFIX = 'source-block:v1:';
const MUTATION_LOCK = 'source-block:mutations';

type Writer = {
  actorId: string;
  authorize?: (record?: SourceBlockRecord) => Promise<void>;
  activate: (block: NormalizedSourceBlock, dashboardId: string) => Promise<{ settingId: number; created: boolean }>;
  deactivate: (settingId: number) => Promise<{ deleted: boolean }>;
};
type Commit<T, P = unknown> = (value: T, previous?: P) => Promise<unknown>;
type DeactivationCommit = (value: SourceBlockRecord, previous: SourceBlockRecord) => Promise<unknown>;
type ActivationOutcome = {
  record: SourceBlockRecord;
  previous: SourceBlockRecord | null;
  changed: boolean;
  externalCreated: boolean;
};

export class SourceBlockStateUncertainError extends Error {
  override name = 'SourceBlockStateUncertainError';
}

const isRecord = (value: unknown): value is SourceBlockRecord =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as SourceBlockRecord).id === 'string' &&
  typeof (value as SourceBlockRecord).offerId === 'number';

const restoredError = () => new Error('Quellen-Sperre fehlgeschlagen; der ursprüngliche Zustand wurde wiederhergestellt und verifiziert');
const rollbackFailed = (message: string) => new SourceBlockStateUncertainError(`Quellen-Sperre fehlgeschlagen; Zustand unklar: ${message}`);

export async function listSourceBlocks(store: SecurityStore) {
  return (await store.list(PREFIX))
    .map((item) => item.value)
    .filter(isRecord)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function persistIncident(store: SecurityStore, key: string, record: SourceBlockRecord, message: string) {
  await store.set(key, {
    ...record,
    status: 'error',
    updatedAt: new Date().toISOString(),
    error: `Zustand unklar: ${message}`,
  });
}

async function throwUncertain(store: SecurityStore, key: string, record: SourceBlockRecord, message: string): Promise<never> {
  let detail = message;
  try {
    await persistIncident(store, key, record, message);
  } catch (incidentError) {
    detail += `; Incident konnte nicht gespeichert werden: ${incidentError instanceof Error ? incidentError.message : 'unbekannter Speicherfehler'}`;
  }
  throw rollbackFailed(detail);
}

async function restoreRecord(store: SecurityStore, key: string, previous: SourceBlockRecord | null) {
  if (previous) await store.set(key, previous);
  else await store.delete(key);
}

async function activateSourceBlockUnlocked(
  store: SecurityStore,
  input: SourceBlockInput,
  writer: Writer,
  commit?: Commit<SourceBlockRecord, SourceBlockRecord | null>,
): Promise<ActivationOutcome> {
  const block = normalizeSourceBlockInput(input),
    key = sourceBlockStoreKey(block),
    existingRaw = await store.get(key),
    previous = isRecord(existingRaw) ? existingRaw : null;
  if (previous?.status === 'active' && previous.everflowSettingId) {
    if (commit) await commit(previous, previous);
    return { record: previous, previous, changed: false, externalCreated: false };
  }
  const now = new Date().toISOString(),
    id = previous?.id ?? crypto.randomUUID(),
    pending: SourceBlockRecord = {
      ...block,
      id,
      status: 'pending',
      effectiveAt: now,
      createdAt: previous?.createdAt ?? now,
      createdBy: previous?.createdBy ?? writer.actorId,
      updatedAt: now,
      updatedBy: writer.actorId,
      everflowSettingId: null,
      lastVerifiedAt: null,
      error: null,
    };
  await store.set(key, pending);
  const external = await writer.activate(block, id).catch(async (activationError: unknown) => {
    const message = activationError instanceof Error ? activationError.message : 'Everflow-Aktivierung konnte nicht verifiziert werden';
    return throwUncertain(store, key, pending, message);
  });
  const active: SourceBlockRecord = {
    ...pending,
    status: 'active',
    everflowSettingId: external.settingId,
    lastVerifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const compensate = async (context: string) => {
    if (external.created) {
      const removed = await writer.deactivate(external.settingId);
      if (!removed.deleted) throw new Error(`Everflow-Regel wurde beim ${context} nicht gelöscht`);
    }
    await restoreRecord(store, key, previous);
  };
  try {
    await store.set(key, active);
  } catch (storageError) {
    try {
      await compensate('Speicher-Rollback');
    } catch (compensationError) {
      const message = compensationError instanceof Error ? compensationError.message : 'Aktivierungs-Rollback fehlgeschlagen';
      await throwUncertain(store, key, active, message);
    }
    throw storageError;
  }
  if (commit) {
    try {
      await commit(active, previous);
    } catch {
      try {
        await compensate('Audit-Rollback');
      } catch (compensationError) {
        const message = compensationError instanceof Error ? compensationError.message : 'Audit-Rollback fehlgeschlagen';
        await throwUncertain(store, key, active, message);
      }
      throw restoredError();
    }
  }
  return { record: active, previous, changed: true, externalCreated: external.created };
}

export async function activateSourceBlock(store: SecurityStore, input: SourceBlockInput, writer: Writer, commit?: Commit<SourceBlockRecord, SourceBlockRecord | null>) {
  return withSecurityLock(store, MUTATION_LOCK, async () => { await writer.authorize?.(); return (await activateSourceBlockUnlocked(store, input, writer, commit)).record; });
}

async function deactivateSourceBlockUnlocked(
  store: SecurityStore,
  fresh: SourceBlockRecord,
  writer: Writer,
  commit?: DeactivationCommit,
) {
  const key = sourceBlockStoreKey(fresh);
  if (fresh.status === 'inactive') {
    if (commit) await commit(fresh, fresh);
    return fresh;
  }
  if (!fresh.everflowSettingId) throw new Error('Everflow-Setting der Sperre fehlt');
  const pending: SourceBlockRecord = {
    ...fresh,
    status: 'pending',
    updatedAt: new Date().toISOString(),
    updatedBy: writer.actorId,
    error: 'Deaktivierung läuft',
  };
  await store.set(key, pending);
  try {
    const removed = await writer.deactivate(fresh.everflowSettingId);
    if (!removed.deleted) throw new Error('Everflow-Setting konnte nicht verifiziert gelöscht werden');
  } catch (deactivationError) {
    const message = deactivationError instanceof Error ? deactivationError.message : 'Everflow-Deaktivierung konnte nicht verifiziert werden';
    await throwUncertain(store, key, fresh, message);
  }
  const inactive: SourceBlockRecord = {
    ...pending,
    status: 'inactive',
    everflowSettingId: null,
    lastVerifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };
  const restore = async () => {
    const restored = await writer.activate(fresh, fresh.id),
      restoredRecord: SourceBlockRecord = {
        ...fresh,
        everflowSettingId: restored.settingId,
      };
    await store.set(key, restoredRecord);
    return restoredRecord;
  };
  try {
    await store.set(key, inactive);
  } catch (storageError) {
    try {
      await restore();
    } catch (compensationError) {
      const message = compensationError instanceof Error ? compensationError.message : 'Deaktivierungs-Rollback fehlgeschlagen';
      await throwUncertain(store, key, { ...inactive, everflowSettingId: fresh.everflowSettingId }, message);
    }
    throw storageError;
  }
  if (commit) {
    try {
      await commit(inactive, fresh);
    } catch {
      try {
        await restore();
      } catch (compensationError) {
        const message = compensationError instanceof Error ? compensationError.message : 'Audit-Rollback fehlgeschlagen';
        await throwUncertain(store, key, { ...inactive, everflowSettingId: fresh.everflowSettingId }, message);
      }
      throw restoredError();
    }
  }
  return inactive;
}

export async function deactivateSourceBlock(store: SecurityStore, id: string, writer: Writer, commit?: DeactivationCommit) {
  return withSecurityLock(store, MUTATION_LOCK, async () => {
    const match = (await listSourceBlocks(store)).find((item) => item.id === id);
    if (!match) throw new Error('Quellen-Sperre nicht gefunden');
    const freshRaw = await store.get(sourceBlockStoreKey(match));
    if (!isRecord(freshRaw) || freshRaw.id !== id) throw new Error('Quellen-Sperre nicht gefunden');
    await writer.authorize?.(freshRaw);
    return deactivateSourceBlockUnlocked(store, freshRaw, writer, commit);
  });
}

export async function activateSourceBlocksAtomically(
  store: SecurityStore,
  inputs: SourceBlockInput[],
  writer: Writer,
  commit?: Commit<SourceBlockRecord[], Array<SourceBlockRecord | null>>,
) {
  return withSecurityLock(store, MUTATION_LOCK, async () => {
    await writer.authorize?.();
    const outcomes: ActivationOutcome[] = [];
    let commitFailed = false;
    try {
      for (const input of inputs) outcomes.push(await activateSourceBlockUnlocked(store, input, writer));
      const records = outcomes.map((outcome) => outcome.record);
      if (commit) {
        try {
          await commit(records, outcomes.map((outcome) => outcome.previous));
        } catch (error) {
          commitFailed = true;
          throw error;
        }
      }
      return records;
    } catch (error) {
      const failures: string[] = [];
      for (const outcome of [...outcomes].reverse()) {
        if (!outcome.changed) continue;
        const key = sourceBlockStoreKey(outcome.record);
        try {
          if (outcome.externalCreated && outcome.record.everflowSettingId) {
            const removed = await writer.deactivate(outcome.record.everflowSettingId);
            if (!removed.deleted) throw new Error('Everflow-Regel wurde beim produktweiten Rollback nicht gelöscht');
          }
          await restoreRecord(store, key, outcome.previous);
        } catch (rollbackError) {
          const message = rollbackError instanceof Error ? rollbackError.message : 'unbekannter Rollbackfehler';
          failures.push(message);
          try {
            await persistIncident(store, key, outcome.record, message);
          } catch (incidentError) {
            failures.push(`Incident konnte nicht gespeichert werden: ${incidentError instanceof Error ? incidentError.message : 'unbekannter Speicherfehler'}`);
          }
        }
      }
      if (failures.length) throw rollbackFailed(`Produktweiter Rollback konnte nicht vollständig verifiziert werden: ${failures.join('; ')}`);
      if (commitFailed) throw restoredError();
      throw error;
    }
  });
}
