// Why: reader tests drain a page generator the way runSync does, saving each cursor after the page.
// Must not: be imported by app code; runSync is the real consumer.
import type { SyncPage } from "./run-sync.ts";

export async function readAllPages(
  pages: AsyncGenerator<SyncPage>,
): Promise<SyncPage[]> {
  const readPages: SyncPage[] = [];
  for await (const page of pages) {
    readPages.push(page);
    await page.saveCursor();
  }
  return readPages;
}
