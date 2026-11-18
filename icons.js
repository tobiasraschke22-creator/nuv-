'use strict';
/* Symbole im Stil von Apples SF Symbols (Linien, abgerundet). Von App und Einführung genutzt. */
const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  history: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" stroke-width="2.6"/>',
  analysis: '<path d="M5 20v-7M10 20V5M15 20v-9M20 20v-5"/>',
  more: '<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke-width="2.8"/>',
  sym: '<path d="M2.5 12h4l2.2-5.5 4.3 11 2.4-5.5h6.1"/>',
  food: '<path d="M7 3v7.5a2 2 0 0 0 2 2V21M5 3v5M9 3v5"/><path d="M17.5 21V3c-2.2 1.6-3 4.4-3 7.5 0 1.7 1.3 3 3 3"/>',
  emo: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  body: '<circle cx="12" cy="4.8" r="2"/><path d="M12 7.5v6.5M7 10.2h10M9 21l3-7 3 7"/>',
  overview: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  links: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 10.9l7.4-3.8M8.3 13.1l7.4 3.8"/>',
  charts: '<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/>',
  tables: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const icon = name => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
