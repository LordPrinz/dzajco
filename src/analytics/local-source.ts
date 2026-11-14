import type { VisitRow, VisitSource } from "./ports";

/** Used without `CF_AE_TOKEN` (local dev, tests): there is no SQL API, so there is no fresh data. */
export class LocalVisitSource implements VisitSource {
  async queryDay(_day: string, _offset: number, _limit: number): Promise<VisitRow[]> {
    return [];
  }

  async querySince(_day: string): Promise<VisitRow[]> {
    return [];
  }
}
