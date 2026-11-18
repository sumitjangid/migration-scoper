import { ReportSchema, type Report } from "../analyse/schemas";

type ReportStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storageKey(id: string): string {
  return `migration-report:${id}`;
}

export function saveBrowserReport(storage: ReportStorage, id: string, report: Report): void {
  storage.setItem(storageKey(id), JSON.stringify(report));
}

export function getBrowserReport(storage: ReportStorage, id: string): Report | undefined {
  const key = storageKey(id);
  const serialized = storage.getItem(key);
  if (serialized === null) return undefined;

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    storage.removeItem(key);
    return undefined;
  }

  const result = ReportSchema.safeParse(value);
  if (!result.success) {
    storage.removeItem(key);
    return undefined;
  }
  return result.data;
}
