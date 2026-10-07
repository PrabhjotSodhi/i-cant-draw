// Glyphs are drawn in a 48-unit box with currentColor strokes; styles scale and colour them.
export const ICON_BOX = 48;

export const ICONS = {
  monitor: '<rect x="4" y="6" width="40" height="28" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16" y1="40" x2="32" y2="40" stroke="currentColor" stroke-width="2"/><line x1="24" y1="34" x2="24" y2="40" stroke="currentColor" stroke-width="2"/>',
  cylinder: '<ellipse cx="24" cy="10" rx="16" ry="5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8" y1="10" x2="8" y2="38" stroke="currentColor" stroke-width="2"/><line x1="40" y1="10" x2="40" y2="38" stroke="currentColor" stroke-width="2"/><path d="M 8 38 A 16 5 0 0 0 40 38" fill="none" stroke="currentColor" stroke-width="2"/>',
  cloud: '<path d="M 12 34 Q 4 34 4 26 Q 4 18 12 18 Q 14 10 22 10 Q 32 10 34 20 Q 44 20 44 28 Q 44 34 36 34 Z" fill="none" stroke="currentColor" stroke-width="2"/>',
  person: '<circle cx="24" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M 10 40 Q 10 26 24 26 Q 38 26 38 40" fill="none" stroke="currentColor" stroke-width="2"/>',
  // UML actor stick figure, matching draw.io's shape=umlActor proportions.
  actor: '<circle cx="24" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="24" y1="13" x2="24" y2="29" stroke="currentColor" stroke-width="2"/><line x1="12" y1="18" x2="36" y2="18" stroke="currentColor" stroke-width="2"/><line x1="24" y1="29" x2="13" y2="46" stroke="currentColor" stroke-width="2"/><line x1="24" y1="29" x2="35" y2="46" stroke="currentColor" stroke-width="2"/>',
  database: '<ellipse cx="24" cy="10" rx="16" ry="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M 8 10 L 8 38 Q 8 42 24 42 Q 40 42 40 38 L 40 10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M 8 20 Q 24 24 40 20" fill="none" stroke="currentColor" stroke-width="2"/><path d="M 8 30 Q 24 34 40 30" fill="none" stroke="currentColor" stroke-width="2"/>',
  // Stack of three offset pages: a bundle of documents.
  documents: '<rect x="16" y="5" width="24" height="30" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="12" y="10" width="24" height="30" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="24" height="30" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>',
  // Single page with a folded corner: one file.
  file: '<path d="M 13 5 L 29 5 L 37 13 L 37 43 L 13 43 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M 29 5 L 29 13 L 37 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  // Grid with a heavier header row: plain tables, not a managed datastore.
  table: '<rect x="5" y="9" width="38" height="30" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="5" y1="19" x2="43" y2="19" stroke="currentColor" stroke-width="3"/><line x1="5" y1="29" x2="43" y2="29" stroke="currentColor" stroke-width="2"/><line x1="18" y1="9" x2="18" y2="39" stroke="currentColor" stroke-width="2"/><line x1="30" y1="9" x2="30" y2="39" stroke="currentColor" stroke-width="2"/>',
};
