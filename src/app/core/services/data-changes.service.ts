import { Injectable, signal } from '@angular/core';

/**
 * Tells the pages that the data changed. Services call `notify()` after
 * every write; pages read `version()` in a computed/effect and reload when it
 * changes. This way the new-transaction modal does not need to know which
 * page opened it.
 */
@Injectable({ providedIn: 'root' })
export class DataChangesService {
  private readonly counter = signal(0);

  /** Increases after every change: read it to depend on the data. */
  readonly version = this.counter.asReadonly();

  notify(): void {
    this.counter.update((value) => value + 1);
  }
}
