import type { CategoryKind } from '../models/category';
import type { CategoryColor, CategoryIcon } from '../models/category-palette';

/** A main category proposed at the first launch, with its subcategories. */
export interface DefaultCategory {
  name: string;
  kind: CategoryKind;
  icon: CategoryIcon;
  color: CategoryColor;
  /** Subcategory names: they inherit icon and color. */
  children: readonly string[];
}

/** Default categories (docs/piano.md, "Categorie predefinite"), in display order. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: 'Spesa', kind: 'expense', icon: 'cart-outline', color: 'teal', children: [] },
  {
    name: 'Casa',
    kind: 'expense',
    icon: 'home-outline',
    color: 'violet',
    children: ['Affitto o mutuo', 'Condominio', 'Manutenzione', 'Arredamento'],
  },
  {
    name: 'Bollette',
    kind: 'expense',
    icon: 'flash-outline',
    color: 'ochre',
    children: ['Luce', 'Gas', 'Acqua', 'Internet e telefono'],
  },
  {
    name: 'Ristoranti e bar',
    kind: 'expense',
    icon: 'restaurant-outline',
    color: 'orange',
    children: ['Ristoranti', 'Bar e caffè', 'Delivery'],
  },
  {
    name: 'Trasporti',
    kind: 'expense',
    icon: 'train-outline',
    color: 'blue',
    children: ['Mezzi pubblici', 'Carburante', 'Auto', 'Parcheggi e pedaggi'],
  },
  {
    name: 'Viaggi',
    kind: 'expense',
    icon: 'airplane-outline',
    color: 'cyan',
    children: ['Trasporto', 'Alloggio', 'Attività'],
  },
  {
    name: 'Salute',
    kind: 'expense',
    icon: 'heart-outline',
    color: 'red',
    children: ['Farmacia', 'Visite mediche', 'Sport e palestra'],
  },
  {
    name: 'Svago',
    kind: 'expense',
    icon: 'film-outline',
    color: 'pink',
    children: ['Uscite', 'Cinema ed eventi', 'Videogiochi', 'Hobby'],
  },
  {
    name: 'Abbonamenti',
    kind: 'expense',
    icon: 'repeat-outline',
    color: 'fuchsia',
    children: ['Streaming', 'Software e app', 'Altri abbonamenti'],
  },
  {
    name: 'Shopping',
    kind: 'expense',
    icon: 'bag-handle-outline',
    color: 'green',
    children: ['Abbigliamento', 'Elettronica', 'Regali'],
  },
  { name: 'Animali', kind: 'expense', icon: 'paw-outline', color: 'brown', children: ['Cibo', 'Veterinario'] },
  { name: 'Istruzione', kind: 'expense', icon: 'school-outline', color: 'indigo', children: ['Corsi', 'Libri'] },
  {
    name: 'Tasse e commissioni',
    kind: 'expense',
    icon: 'receipt-outline',
    color: 'slate',
    children: ['Tasse', 'Commissioni bancarie'],
  },
  { name: 'Altro', kind: 'expense', icon: 'ellipsis-horizontal-outline', color: 'gray', children: [] },

  { name: 'Stipendio', kind: 'income', icon: 'briefcase-outline', color: 'teal', children: [] },
  { name: 'Lavoro extra', kind: 'income', icon: 'construct-outline', color: 'blue', children: [] },
  { name: 'Rimborsi', kind: 'income', icon: 'arrow-undo-outline', color: 'cyan', children: [] },
  { name: 'Regali ricevuti', kind: 'income', icon: 'gift-outline', color: 'pink', children: [] },
  { name: 'Altre entrate', kind: 'income', icon: 'add-circle-outline', color: 'gray', children: [] },
];
