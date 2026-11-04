import type { OnInit } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonFooter, IonIcon, ModalController } from '@ionic/angular';

import type { Category, CategoryKind } from '../../../core/models/category';
import type { CategoryColor } from '../../../core/models/category-palette';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../../core/models/category-palette';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryIconComponent } from '../../../shared/category-icon/category-icon.component';
import { ToastService } from '../../../shared/toast.service';

/**
 * New / edit category, as a bottom sheet. Main categories choose icon and
 * color; subcategories only have a name (they inherit the rest).
 */
@Component({
  selector: 'app-category-editor',
  imports: [IonContent, IonFooter, IonIcon, CategoryIconComponent],
  template: `
    <ion-content class="sheet">
      <div class="top">
        <button type="button" class="icon-button" aria-label="Chiudi" (click)="close()">
          <ion-icon name="close-outline" />
        </button>
        <h2>{{ title() }}</h2>
        <span class="icon-button" aria-hidden="true"></span>
      </div>

      <div class="preview">
        <app-category-icon [icon]="icon()" [color]="color()" />
        <input
          class="pal-input"
          type="text"
          maxlength="40"
          placeholder="Nome"
          aria-label="Nome della categoria"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
        />
      </div>

      @if (isMain()) {
        <p class="pal-label section">Colore</p>
        <div class="colors" role="radiogroup" aria-label="Colore">
          @for (option of colors; track option) {
            <button
              type="button"
              class="swatch"
              role="radio"
              [attr.aria-checked]="option === color()"
              [attr.aria-label]="option"
              [style.--swatch]="'var(--pal-cat-' + option + ')'"
              [class.selected]="option === color()"
              (click)="color.set(option)"
            >
              @if (option === color()) {
                <ion-icon name="checkmark-outline" aria-hidden="true" />
              }
            </button>
          }
        </div>

        <p class="pal-label section">Icona</p>
        <div class="icons" role="radiogroup" aria-label="Icona">
          @for (option of icons; track option) {
            <button
              type="button"
              class="icon-choice"
              role="radio"
              [attr.aria-checked]="option === icon()"
              [attr.aria-label]="option"
              [class.selected]="option === icon()"
              (click)="icon.set(option)"
            >
              <ion-icon [name]="option" aria-hidden="true" />
            </button>
          }
        </div>
      } @else {
        <p class="hint">Le sottocategorie usano l’icona e il colore di “{{ parentName }}”.</p>
      }
    </ion-content>

    <ion-footer class="sheet-footer ion-no-border">
      <button type="button" class="pal-button wide" [disabled]="saving() || !name().trim()" (click)="save()">
        Salva
      </button>
    </ion-footer>
  `,
  styles: `
    .sheet {
      --background: var(--pal-surface);
      --padding-start: var(--pal-page-padding);
      --padding-end: var(--pal-page-padding);
      --padding-top: 16px;
      --padding-bottom: 8px;
    }
    .sheet-footer {
      padding: 8px var(--pal-page-padding) calc(12px + var(--ion-safe-area-bottom, 0px));
      background: var(--pal-surface);
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .top h2 {
      margin: 0;
      font-size: 20px;
      font-weight: var(--pal-font-extrabold);
    }
    .icon-button {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 0;
      background: none;
      color: var(--pal-text);
      font-size: 28px;
    }
    .preview {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .section {
      margin: 20px 0 10px;
    }
    .colors {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 10px;
      /* Room for the ring around the selected color. */
      padding: 6px;
    }
    .swatch {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      min-height: 44px;
      border: 0;
      border-radius: 50%;
      background: var(--swatch);
      color: var(--pal-surface);
      font-size: 22px;
    }
    .swatch.selected {
      outline: 3px solid var(--swatch);
      outline-offset: 3px;
    }
    .icons {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
    }
    .icon-choice {
      display: grid;
      place-items: center;
      min-height: 48px;
      border: 1px solid var(--pal-border);
      border-radius: var(--pal-radius-control);
      background: var(--pal-surface);
      color: var(--pal-text);
      font-size: 22px;
    }
    .icon-choice.selected {
      border: 2px solid var(--pal-primary);
      background: var(--pal-primary-soft);
      color: var(--pal-primary);
    }
    .hint {
      margin: 16px 4px 0;
      color: var(--pal-text-muted);
    }
  `,
})
export class CategoryEditorComponent implements OnInit {
  // Set through ModalController componentProps.
  /** The category to edit; null to create one. */
  category: Category | null = null;
  /** Kind of a new category. */
  kind: CategoryKind = 'expense';
  /** Parent of a new subcategory, or of the subcategory being edited. */
  parent: Category | null = null;

  private readonly modals = inject(ModalController);
  private readonly categories = inject(CategoryService);
  private readonly toast = inject(ToastService);

  protected readonly colors = CATEGORY_COLORS;
  protected readonly icons = CATEGORY_ICONS;

  protected readonly name = signal('');
  protected readonly icon = signal<string>('ellipsis-horizontal-outline');
  protected readonly color = signal<CategoryColor>('gray');
  protected readonly saving = signal(false);

  protected readonly isMain = computed(() => this.parent === null);
  protected readonly title = computed(() => {
    if (this.category) {
      return 'Modifica categoria';
    }
    return this.parent ? 'Nuova sottocategoria' : 'Nuova categoria';
  });

  protected get parentName(): string {
    return this.parent?.name ?? '';
  }

  ngOnInit(): void {
    const source = this.category ?? this.parent;
    if (source) {
      this.icon.set(source.icon);
      this.color.set(source.color);
    }
    this.name.set(this.category?.name ?? '');
  }

  protected close(): void {
    void this.modals.dismiss();
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      if (this.category) {
        await this.categories.update(this.category.id, {
          name: this.name(),
          ...(this.isMain() ? { icon: this.icon(), color: this.color() } : {}),
        });
      } else {
        await this.categories.create({
          name: this.name(),
          kind: this.parent?.kind ?? this.kind,
          icon: this.icon(),
          color: this.color(),
          parentId: this.parent?.id ?? null,
        });
      }
      await this.modals.dismiss(true, 'saved');
      await this.toast.info(this.category ? 'Categoria aggiornata' : 'Categoria creata');
    } catch (error) {
      await this.toast.error(error);
    } finally {
      this.saving.set(false);
    }
  }
}
