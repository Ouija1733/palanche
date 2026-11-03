import type { OnInit } from '@angular/core';
import { Component, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonIcon, IonToolbar, ModalController } from '@ionic/angular';

import type { CategoryKind } from '../../../core/models/category';
import type { CategoryNode } from '../../../core/services/category.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryIconComponent } from '../../../shared/category-icon/category-icon.component';

/** Every category of a kind, subcategories included. Dismisses with the chosen Category. */
@Component({
  selector: 'app-category-picker',
  imports: [IonHeader, IonToolbar, IonContent, IonIcon, CategoryIconComponent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="bar">
          <button type="button" class="close" aria-label="Chiudi" (click)="close()">
            <ion-icon name="close-outline" />
          </button>
          <h2>Scegli la categoria</h2>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="pal-page">
      @for (node of tree(); track node.category.id) {
        <section class="pal-card group">
          <button
            type="button"
            class="row"
            [class.selected]="node.category.id === selectedId"
            (click)="choose(node.category.id)"
          >
            <app-category-icon [icon]="node.category.icon" [color]="node.category.color" size="small" />
            <span>{{ node.category.name }}</span>
          </button>
          @for (child of node.children; track child.id) {
            <button
              type="button"
              class="row child"
              [class.selected]="child.id === selectedId"
              (click)="choose(child.id)"
            >
              <span>{{ child.name }}</span>
            </button>
          }
        </section>
      } @empty {
        <div class="pal-card pal-empty">
          <strong>Nessuna categoria</strong>
          Puoi crearle dalle impostazioni.
        </div>
      }
    </ion-content>
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px;
    }
    .bar h2 {
      margin: 0;
      font-size: 18px;
      font-weight: var(--pal-font-extrabold);
    }
    .close {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 0;
      background: none;
      color: var(--pal-text);
      font-size: 28px;
    }
    .group {
      padding: 4px 8px;
      margin-bottom: 10px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 52px;
      padding: 4px 8px;
      border: 0;
      border-radius: 12px;
      background: none;
      color: var(--pal-text);
      font: inherit;
      font-size: 15px;
      font-weight: var(--pal-font-semibold);
      text-align: left;
    }
    .row.child {
      min-height: 44px;
      padding-left: 60px;
      font-weight: var(--pal-font-regular);
    }
    .row.selected {
      background: var(--pal-primary-soft);
      color: var(--pal-primary);
    }
  `,
})
export class CategoryPickerComponent implements OnInit {
  // Set through ModalController componentProps.
  kind: CategoryKind = 'expense';
  selectedId: string | null = null;

  private readonly modals = inject(ModalController);
  private readonly categories = inject(CategoryService);
  protected readonly tree = signal<CategoryNode[]>([]);

  async ngOnInit(): Promise<void> {
    this.tree.set(await this.categories.getTree(this.kind));
  }

  protected close(): void {
    void this.modals.dismiss();
  }

  protected choose(id: string): void {
    const category = this.tree()
      .flatMap((node) => [node.category, ...node.children])
      .find((c) => c.id === id);
    void this.modals.dismiss(category, 'selected');
  }
}
