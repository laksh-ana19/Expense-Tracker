// Categories are stored/sent to the backend in English (so old data, filters,
// and exports stay stable across language switches). This only translates
// the label shown in the UI.
export function categoryLabel(t, category) {
  return t(`categories.${category}`, { defaultValue: category });
}
