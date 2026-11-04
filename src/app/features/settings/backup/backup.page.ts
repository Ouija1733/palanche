import { Component, inject, resource, signal } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';

import type { BackupFile, BackupSummary } from '../../../core/services/backup/backup-format';
import { ExportService } from '../../../core/services/backup/export.service';
import { ImportService } from '../../../core/services/backup/import.service';
import { DataChangesService } from '../../../core/services/data-changes.service';
import { ChoiceService } from '../../../shared/choice.service';
import { formatTimestamp } from '../../../shared/day-labels';
import { ToastService } from '../../../shared/toast.service';

/** A backup file read and validated, waiting for the user to choose how to import it. */
interface PendingImport {
  fileName: string;
  file: BackupFile;
  summary: BackupSummary;
}

/**
 * Backup and data: export everything as JSON (shared through the Android
 * share sheet) and import a backup, either replacing all the data or merging
 * it with the current data. Nothing is written until the user confirms.
 */
@Component({
  selector: 'app-backup',
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonIcon],
  template: `
    <ion-header class="ion-no-border pal-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/settings" text="" />
        </ion-buttons>
        <ion-title>Backup e dati</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="pal-page">
      <section class="pal-card">
        <h2 class="pal-section-title">Esporta</h2>
        <p class="text">
          Un file JSON con tutti i tuoi dati. Scegli tu dove salvarlo o a chi inviarlo: Drive, mail, una cartella del
          telefono.
        </p>
        <p class="last">
          Ultimo export:
          <strong>{{ lastExport.value() ? timestamp(lastExport.value()!) : 'mai' }}</strong>
        </p>
        <button type="button" class="pal-button wide with-icon" [disabled]="busy()" (click)="exportNow()">
          <ion-icon name="share-outline" aria-hidden="true" />
          Esporta ora
        </button>
      </section>

      <section class="pal-card">
        <h2 class="pal-section-title">Importa o ripristina</h2>
        @if (pendingImport(); as pending) {
          <p class="text">
            <strong>{{ pending.fileName }}</strong
            ><br />
            Backup del {{ timestamp(pending.summary.exportedAt) }}
          </p>
          <ul class="summary">
            <li>
              <strong>{{ pending.summary.accounts }}</strong> {{ plural(pending.summary.accounts, 'conto', 'conti') }}
            </li>
            <li>
              <strong>{{ pending.summary.categories }}</strong>
              {{ plural(pending.summary.categories, 'categoria', 'categorie') }}
            </li>
            <li>
              <strong>{{ pending.summary.transactions }}</strong>
              {{ plural(pending.summary.transactions, 'movimento', 'movimenti') }}
            </li>
            <li>
              <strong>{{ pending.summary.tags }}</strong> tag
            </li>
          </ul>
          <div class="choices">
            <button type="button" class="choice" [disabled]="busy()" (click)="merge(pending)">
              <ion-icon name="git-merge-outline" aria-hidden="true" />
              <span>
                <strong>Unisci</strong>
                <span class="sub"
                  >Aggiunge i dati del backup a quelli attuali. Se un dato è in entrambi, vince la versione modificata
                  più di recente.</span
                >
              </span>
            </button>
            <button type="button" class="choice danger" [disabled]="busy()" (click)="replace(pending)">
              <ion-icon name="arrow-undo-outline" aria-hidden="true" />
              <span>
                <strong>Sostituisci tutto</strong>
                <span class="sub"
                  >I dati attuali vengono sostituiti da quelli del backup. Prima ne salviamo una copia di
                  sicurezza.</span
                >
              </span>
            </button>
          </div>
          <button type="button" class="pal-button secondary wide" [disabled]="busy()" (click)="pendingImport.set(null)">
            Annulla
          </button>
        } @else {
          <p class="text">
            Scegli un file di backup di Palanche. Prima di importare vedrai cosa contiene e potrai decidere se unirlo o
            sostituire i dati attuali.
          </p>
          <button
            type="button"
            class="pal-button secondary wide with-icon"
            [disabled]="busy()"
            (click)="picker.click()"
          >
            <ion-icon name="folder-open-outline" aria-hidden="true" />
            Scegli un file
          </button>
        }
        <!-- Android opens its own file picker for this input: no plugin needed. -->
        <input
          #picker
          type="file"
          accept="application/json,text/plain,application/octet-stream"
          hidden
          (change)="onFilePicked($event)"
        />
      </section>
    </ion-content>
  `,
  styles: `
    .pal-card + .pal-card {
      margin-top: var(--pal-card-gap);
    }
    .text,
    .last {
      margin: 8px 0 14px;
      color: var(--pal-text-muted);
      line-height: 1.45;
    }
    .text strong,
    .last strong {
      color: var(--pal-text);
    }
    .with-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .with-icon ion-icon {
      font-size: 22px;
    }
    .summary {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 0 0 14px;
      padding: 0;
      list-style: none;
    }
    .summary li {
      padding: 10px 12px;
      border-radius: var(--pal-radius-control);
      background: var(--pal-track);
    }
    .choices {
      display: grid;
      gap: 10px;
      margin-bottom: 10px;
    }
    .choice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      border: 1px solid var(--pal-border);
      border-radius: var(--pal-radius-control);
      background: var(--pal-surface);
      color: var(--pal-text);
      font: inherit;
      text-align: start;
    }
    .choice ion-icon {
      flex: none;
      margin-top: 2px;
      font-size: 22px;
      color: var(--pal-primary);
    }
    .choice.danger ion-icon,
    .choice.danger strong {
      color: var(--pal-danger);
    }
    .choice .sub {
      display: block;
      margin-top: 4px;
      font-size: var(--pal-fs-secondary);
      color: var(--pal-text-muted);
    }
  `,
})
export class BackupPage {
  private readonly exporter = inject(ExportService);
  private readonly importer = inject(ImportService);
  private readonly changes = inject(DataChangesService);
  private readonly choices = inject(ChoiceService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  protected readonly pendingImport = signal<PendingImport | null>(null);
  private readonly exportCount = signal(0);

  protected readonly lastExport = resource({
    params: () => ({ exports: this.exportCount(), version: this.changes.version() }),
    loader: () => this.exporter.getLastExportAt(),
  });

  protected plural(count: number, one: string, many: string): string {
    return count === 1 ? one : many;
  }

  protected timestamp(iso: string): string {
    return formatTimestamp(iso);
  }

  protected async exportNow(): Promise<void> {
    await this.run(async () => {
      if (await this.exporter.exportAndShare()) {
        this.exportCount.update((count) => count + 1);
        await this.toast.info('Backup esportato');
      }
    });
  }

  /** Reads and validates the chosen file; nothing is imported yet. */
  protected async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0];
    input.value = ''; // so that choosing the same file again fires "change"
    if (!picked) {
      return;
    }
    await this.run(async () => {
      const file = this.importer.parse(await picked.text());
      this.pendingImport.set({ fileName: picked.name, file, summary: this.importer.summarize(file) });
    });
  }

  protected async merge(pending: PendingImport): Promise<void> {
    await this.run(async () => {
      await this.importer.merge(pending.file);
      this.pendingImport.set(null);
      await this.toast.info('Backup unito ai tuoi dati');
    });
  }

  protected async replace(pending: PendingImport): Promise<void> {
    const confirmed = await this.choices.confirm({
      header: 'Sostituire tutti i dati?',
      message:
        'Conti, categorie e movimenti attuali saranno sostituiti da quelli del backup. ' +
        'Prima viene salvata automaticamente una copia di sicurezza dei dati attuali.',
      confirmText: 'Sostituisci',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    await this.run(async () => {
      await this.importer.replace(pending.file);
      this.pendingImport.set(null);
      await this.toast.info('Dati ripristinati dal backup');
    });
  }

  /** Runs one action at a time and shows any error as a toast. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      await this.toast.error(error);
    } finally {
      this.busy.set(false);
    }
  }
}
