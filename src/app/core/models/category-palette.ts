/**
 * Colors and icons a category can use. A category stores a palette key in
 * `categories.color` (not a hex value): the theme maps each key to
 * `--pal-cat-<key>`, with a variant for light and one for dark mode.
 */
export const CATEGORY_COLORS = [
  'teal',
  'violet',
  'ochre',
  'orange',
  'blue',
  'cyan',
  'red',
  'pink',
  'fuchsia',
  'green',
  'brown',
  'indigo',
  'slate',
  'gray',
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Ionicons names (always the -outline variant) offered in the category icon picker. */
export const CATEGORY_ICONS = [
  'cart-outline',
  'basket-outline',
  'storefront-outline',
  'home-outline',
  'bed-outline',
  'build-outline',
  'flash-outline',
  'flame-outline',
  'water-outline',
  'wifi-outline',
  'restaurant-outline',
  'cafe-outline',
  'pizza-outline',
  'beer-outline',
  'train-outline',
  'bus-outline',
  'car-outline',
  'bicycle-outline',
  'airplane-outline',
  'globe-outline',
  'umbrella-outline',
  'heart-outline',
  'medkit-outline',
  'fitness-outline',
  'barbell-outline',
  'film-outline',
  'ticket-outline',
  'musical-notes-outline',
  'game-controller-outline',
  'happy-outline',
  'people-outline',
  'repeat-outline',
  'phone-portrait-outline',
  'laptop-outline',
  'bag-handle-outline',
  'shirt-outline',
  'gift-outline',
  'pricetag-outline',
  'cut-outline',
  'paw-outline',
  'leaf-outline',
  'school-outline',
  'book-outline',
  'receipt-outline',
  'card-outline',
  'wallet-outline',
  'cash-outline',
  'briefcase-outline',
  'construct-outline',
  'trending-up-outline',
  'arrow-undo-outline',
  'add-circle-outline',
  'ellipsis-horizontal-outline',
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export function isCategoryColor(value: string): value is CategoryColor {
  return (CATEGORY_COLORS as readonly string[]).includes(value);
}

export function isCategoryIcon(value: string): value is CategoryIcon {
  return (CATEGORY_ICONS as readonly string[]).includes(value);
}
