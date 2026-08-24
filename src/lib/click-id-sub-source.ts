/**
 * Erkennung von Klick-/Transaktions-IDs, die Partner in Sub1 durchreichen.
 *
 * Belegter Fall (Source 32 · Affiliate 460): 553 eindeutige Werte der Form
 * `token.e89.96xxx`, jeder trägt genau einen SOI, Folge-Events docken an
 * dieselbe ID an. Solche Werte sind Ereignis-Kennungen, keine Platzierungen —
 * die echte Gruppierung (GEO) steht dort in Sub2. Analog Source 255 (Advery),
 * wo Transaction-IDs in Sub1 landen.
 */

export const CLICK_ID_BUCKET = 'Klick-IDs (einzeln)';

const BASE36_TRIPLE = /^[0-9a-z]{2,12}\.[0-9a-z]{2,6}\.[0-9a-z]{2,8}$/;
const BARE_HEX_HASH = /^[0-9a-f]{24,40}$/;
// Einteilige lange Tokens ohne Trennzeichen, mit Ziffernanteil (z. B. 18df42r49bdk0)
const BARE_BASE36_TOKEN = /^(?=(?:.*\d){2})[0-9a-z]{12,}$/;

export function isClickIdLike(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (BARE_HEX_HASH.test(text)) return true;
  if (BARE_BASE36_TOKEN.test(text)) return true;
  if (!BASE36_TRIPLE.test(text)) return false;
  // Echte Namen tragen Trennzeichen oder Großschreibung; Tokens sind rein base36.
  // Domains (`sub.domain.tld`) fallen durch die TLD-Heuristik heraus:
  const last = text.split('.').at(-1)!;
  if (/^[a-z]{2,4}$/.test(last) && !/\d/.test(text)) return false;
  return true;
}

/** Kanonische Sub-Source für tracked Traffic: Klick-IDs weichen der echten Gruppe aus Sub2. */
export function canonicalTrackedSub(sub1: string, sub2: string): { value: string; collapsed: boolean } {
  if (!isClickIdLike(sub1)) return { value: sub1, collapsed: false };
  const fallback = sub2.trim();
  if (fallback && !isClickIdLike(fallback)) return { value: fallback, collapsed: true };
  return { value: CLICK_ID_BUCKET, collapsed: true };
}
