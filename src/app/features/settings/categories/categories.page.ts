import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  ActionSheetController,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';

import type { Category, CategoryKind } from '../../../core/models/category';
import type { CategoryNode } from '../../../core/services/category.service';
import { CategoryService } from '../../../core/services/category.service';
import { DataChangesService } from '../../../core/services/data-changes.service';
import { CategoryIconComponent } from '../../../shared/category-icon/category-icon.component';
import type { ChoiceOption } from '../../../shared/choice.service';
import { ChoiceService } from '../../../shared/choice.service';
import { ToastService } from '../../../shared/toast.service';

import { CategoryEditorComponent } from './category-editor.component';

/** Value of the "becomes a main category" choice when moving a subcategory. */
const TOP_LEVEL = '__top__';

type CategoryAction = 'edit' | 'addChild' | 'move' | 'merge' | 'delete';

/**
 * Categories of one kind (expenses or income), as main categories with their
 * subcategories. Tapping one opens its actions: edit, add a subcategory,
 * move under another, merge into another, delete.
 */
@Component({
  selector: 'app-categories',
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonIcon, CategoryIconComponent],
  template: `
    <ion-header class="ion-no-border pal-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/settings" text="" />
        </ion-buttons>
        <ion-title>Categorie</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="pal-page">
      <div class="pal-segment two" role="radiogroup" aria-label="Tipo di categoria">
        @for (option of kinds; track option.value) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="kind() === option.value"
            [class.active]="kind() === option.value"
            (click)="kind.set(option.value)"
          >
            {{ option.label }}
          </button>
        }
      </div>

      @for (node of tree(); track node.category.id) {
        <section class="pal-list group">
          <button type="button" class="pal-list-row" (click)="openActions(node.category)">
            <app-category-icon [icon]="node.category.icon" [color]="node.category.color" size="small" />
            <span class="grow">
              {{ node.category.name }}
              @if (node.children.length > 0) {
                <span class="sub">{{ subcategoriesLabel(node) }}</span>
              }
            </span>
            <ion-icon class="chevron" name="ellipsis-horizontal-outline" aria-hidden="true" />
          </button>
          @for (child of node.children; track child.id) {
            <button type="button" class="pal-list-row child" (click)="openActions(child)">
              <span class="grow">{{ child.name }}</span>
              <ion-icon class="chevron" name="ellipsis-horizontal-outline" aria-hidden="true" />
            </button>
          }
        </section>
      } @empty {
        @if (categories.hasValue()) {
          <div class="pal-card pal-empty">
            <strong>Nessuna categoria</strong>
            Creane una con il pulsante qui sotto.
          </div>
        }
      }

      <button type="button" class="pal-button wide add" (click)="create(null)">Nuova categoria</button>
    </ion-content>
  `,
  styles: `
    .pal-segment.two {
      grid-template-columns: 1fr 1fr;
      margin: 0 0 16px;
    }
    .group {
      margin-bottom: 10px;
    }
    .child {
      min-height: 52px;
      padding-left: 70px;
      font-weight: var(--pal-font-regular);
    }
    .add {
      margin-top: 6px;
    }
  `,
})
export class CategoriesPage {
  private readonly categoryService = inject(CategoryService);
  private readonly changes = inject(DataChangesService);
  private readonly modals = inject(ModalController);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly choices = inject(ChoiceService);
  private readonly toast = inject(ToastService);

  protected readonly kinds: readonly ChoiceOption<CategoryKind>[] = [
    { value: 'expense', label: 'Spese' },
    { value: 'income', label: 'Entrate' },
  ];
  protected readonly kind = signal<CategoryKind>('expense');

  protected readonly categories = resource({
    params: () => ({ kind: this.kind(), version: this.changes.version() }),
    loader: ({ params }) => this.categoryService.getTree(params.kind),
  });
  protected readonly tree = computed(() => this.categories.value() ?? []);

  protected subcategoriesLabel(node: CategoryNode): string {
    return node.children.length === 1 ? '1 sottocategoria' : `${node.children.length} sottocategorie`;
  }

  protected async openActions(category: Category): Promise<void> {
    const node = this.tree().find((n) => n.category.id === category.id);
    const isMain = category.parentId === null;
    const hasChildren = (node?.children.length ?? 0) > 0;

    const buttons: { text: string; data: CategoryAction; role?: string }[] = [{ text: 'Modifica', data: 'edit' }];
    if (isMain) {
      buttons.push({ text: 'Aggiungi sottocategoria', data: 'addChild' });
    }
    // A main category with subcategories cannot become a subcategory (two levels at most).
    if (!hasChildren) {
      buttons.push({ text: 'Sposta sotto…', data: 'move' });
    }
    buttons.push({ text: 'Unisci a un’altra…', data: 'merge' });
    buttons.push({ text: 'Elimina', data: 'delete', role: 'destructive' });

    const sheet = await this.actionSheets.create({
      header: category.name,
      cssClass: 'pal-action-sheet',
      buttons: [...buttons, { text: 'Annulla', role: 'cancel' }],
    });
    await sheet.present();
    const { data } = await sheet.onWillDismiss<CategoryAction>();

    switch (data) {
      case 'edit':
        return this.edit(category);
      case 'addChild':
        return this.create(category);
      case 'move':
        return this.move(category);
      case 'merge':
        return this.merge(category, hasChildren);
      case 'delete':
        return this.remove(category);
    }
  }

  /** New main category (parent null) or new subcategory of `parent`. */
  protected async create(parent: Category | null): Promise<void> {
    await this.openEditor({ category: null, parent, kind: this.kind() });
  }

  private async edit(category: Category): Promise<void> {
    const parent = category.parentId
      ? (this.tree().find((node) => node.category.id === category.parentId)?.category ?? null)
      : null;
    await this.openEditor({ category, parent, kind: category.kind });
  }

  private async openEditor(props: { category: Category | null; parent: Category | null; kind: CategoryKind }) {
    const modal = await this.modals.create({
      component: CategoryEditorComponent,
      componentProps: props,
      cssClass: 'pal-sheet',
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: true,
    });
    await modal.present();
  }

  private async move(category: Category): Promise<void> {
    const options: ChoiceOption[] = this.tree()
      .map((node) => node.category)
      .filter((main) => main.id !== category.id && main.id !== category.parentId)
      .map((main) => ({ value: main.id, label: main.name }));
    if (category.parentId) {
      options.unshift({ value: TOP_LEVEL, label: 'Nessuna: diventa principale' });
    }
    const target = await this.choices.pickOne(`Sposta “${category.name}” sotto`, options);
    if (!target) {
      return;
    }
    try {
      await this.categoryService.move(category.id, target === TOP_LEVEL ? null : target);
      await this.toast.info('Categoria spostata');
    } catch (error) {
      await this.toast.error(error);
    }
  }

  private async merge(source: Category, hasChildren: boolean): Promise<void> {
    // Subcategories of the source move under the target, so then it must be a main category.
    const options = this.tree()
      .flatMap((node) => [node.category, ...(hasChildren ? [] : node.children)])
      .filter((target) => target.id !== source.id && target.parentId !== source.id)
      .map((target) => ({
        value: target.id,
        label: target.parentId ? `${this.nameOf(target.parentId)} › ${target.name}` : target.name,
      }));
    const targetId = await this.choices.pickOne(`Unisci “${source.name}” a`, options);
    if (!targetId) {
      return;
    }
    const targetName = options.find((option) => option.value === targetId)?.label ?? '';
    const confirmed = await this.choices.confirm({
      header: 'Unire le categorie?',
      message:
        `I movimenti di “${source.name}”${hasChildren ? ' e le sue sottocategorie' : ''} passano a ` +
        `“${targetName}”, poi “${source.name}” viene eliminata. L’operazione non si può annullare.`,
      confirmText: 'Unisci',
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.categoryService.merge(source.id, targetId);
      await this.toast.info('Categorie unite');
    } catch (error) {
      await this.toast.error(error);
    }
  }

  private async remove(category: Category): Promise<void> {
    try {
      await this.categoryService.delete(category.id);
      await this.toast.undo('Categoria eliminata', () => this.categoryService.restore(category.id));
    } catch (error) {
      await this.toast.error(error);
    }
  }

  private nameOf(id: string): string {
    return this.tree().find((node) => node.category.id === id)?.category.name ?? '';
  }
}
