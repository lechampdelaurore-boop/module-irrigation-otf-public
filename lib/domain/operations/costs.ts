import { dateKeyInTimeZone, FARM_TIME_ZONE } from '../water-management.ts';
import { frenchDay } from './operator-gesture.ts';

/**
 * Les coûts sur la page d'état (4.5, PR 5 ; docs/tranche-4-contract.md,
 * F565 point 6, F568, et 10 bis.21, F662 et F663). Chaque mois,
 * l'exploitant copie à la main, depuis le tableau de bord de Cloudflare,
 * ce que le module a consommé : la page n'appelle jamais l'API de
 * Cloudflare. Elle compare chaque poste à ce que l'offre Workers payante
 * inclut, et dit ce qui dépasserait, en dollars.
 *
 * Ce que l'offre inclut et le prix d'un dépassement : pages des prix de
 * Cloudflare lues le 20 novembre 2026 (Workers, mise à jour du 18 novembre
 * 2026 ; D1, du 30 octobre 2026). À relire si Cloudflare les change : la
 * page le dit avec sa date.
 */

export const COST_PRICES_READ_ON = '20/11/2026';

/** L'abonnement Workers payant, par mois, en dollars. */
const WORKERS_PAID_BASE_USD = 5;

/** L'estimation du contrat (section 10) : ≈ 5 $ par mois jusqu'à 30 fermes. */
const COST_ESTIMATE_WORDS = '≈ 5 $ par mois jusqu’à 30 fermes (contrat, section 10)';

export type CostItemKey = 'workersRequests' | 'workersCpuMs' | 'd1RowsRead' | 'd1RowsWritten' | 'd1StorageMb';

type CostItem = {
  label: string;
  /** Le champ du formulaire, et ce que dit le tableau de bord. */
  field: string;
  /** L'unité dite après le nombre. */
  unit: string;
  included: number;
  /** Le prix d'une unité au-delà de ce qui est inclus, en dollars. */
  overageUsdPerUnit: number;
  integer: boolean;
};

export const COST_ITEMS: Readonly<Record<CostItemKey, CostItem>> = {
  workersRequests: { label: 'Requêtes des Workers', field: 'Requêtes des Workers', unit: 'requêtes', included: 10_000_000, overageUsdPerUnit: 0.30 / 1_000_000, integer: true },
  workersCpuMs: { label: 'Calcul des Workers', field: 'Calcul des Workers (millisecondes de CPU)', unit: 'ms', included: 30_000_000, overageUsdPerUnit: 0.02 / 1_000_000, integer: true },
  d1RowsRead: { label: 'Lignes lues dans D1', field: 'Lignes lues dans D1', unit: 'lignes', included: 25_000_000_000, overageUsdPerUnit: 0.001 / 1_000_000, integer: true },
  d1RowsWritten: { label: 'Lignes écrites dans D1', field: 'Lignes écrites dans D1', unit: 'lignes', included: 50_000_000, overageUsdPerUnit: 1 / 1_000_000, integer: true },
  // 5 Go inclus, 0,75 $ par Go et par mois au-delà : 5 000 Mo, 0,000 75 $ par Mo.
  d1StorageMb: { label: 'Stockage de D1', field: 'Stockage de D1 (Mo)', unit: 'Mo', included: 5_000, overageUsdPerUnit: 0.000_75, integer: false },
};

export const COST_ITEM_KEYS = Object.keys(COST_ITEMS) as CostItemKey[];

export type CostReading = Record<CostItemKey, number> & { month: string; billedUsd: number | null };

/** Un relevé enregistré, avec son heure. */
export type StoredCostReading = CostReading & { recordedAt: string };

/** Les mois qu'un relevé peut viser : le mois en cours et les douze d'avant, le plus récent d'abord. */
export function costMonths(now: Date): string[] {
  const [year, month] = dateKeyInTimeZone(now, FARM_TIME_ZONE).split('-').map(Number);
  return Array.from({ length: 13 }, (_, back) => {
    const index = year * 12 + (month - 1) - back;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}

const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « novembre 2026 ». */
export function monthWords(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return `${MONTH_NAMES[number - 1]} ${year}`;
}

/** « de novembre 2026 », « d’octobre 2026 ». */
function ofMonthWords(month: string): string {
  const words = monthWords(month);
  return /^[aeiouéâ]/.test(words) ? `d’${words}` : `de ${words}`;
}

const SPACES = /[\s  ]/g;

/** Un nombre entier tel qu'on le copie : « 1 234 567 », « 1,234,567 », « 1.234.567 » ou « 1234567 ». */
function parseCount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,3}([   ,.]\d{3})*$|^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(/[   ,.]/g, ''));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Un nombre à virgule : « 12,5 » ou « 12.5 ». */
function parseDecimal(value: string): number | null {
  const compact = value.replace(SPACES, '');
  if (!/^\d+([.,]\d+)?$/.test(compact)) return null;
  const parsed = Number(compact.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export type CostReadingDecision = { ok: true; reading: CostReading } | { ok: false; message: string };

export function costReadingDecision(input: Record<string, unknown>, now: Date): CostReadingDecision {
  const month = input.month;
  if (typeof month !== 'string' || !costMonths(now).includes(month)) return { ok: false, message: 'Choisissez le mois relevé : le mois en cours ou l’un des douze d’avant.' };
  const values = {} as Record<CostItemKey, number>;
  for (const key of COST_ITEM_KEYS) {
    const item = COST_ITEMS[key];
    const raw = input[key];
    const parsed = typeof raw === 'string' ? (item.integer ? parseCount(raw) : parseDecimal(raw)) : null;
    if (parsed === null) return { ok: false, message: `${item.field} : recopiez le nombre du tableau de bord${item.integer ? ', sans virgule ni lettre' : ''}.` };
    values[key] = parsed;
  }
  const billedRaw = typeof input.billedUsd === 'string' ? input.billedUsd.trim().replace(/\s*\$$/, '') : '';
  let billedUsd: number | null = null;
  if (billedRaw !== '') {
    billedUsd = parseDecimal(billedRaw);
    if (billedUsd === null) return { ok: false, message: 'Facture du mois : un montant en dollars, comme « 5,00 », ou rien si elle n’est pas encore là.' };
  }
  return { ok: true, reading: { month, ...values, billedUsd } };
}

/** Ce qu'un poste dépasse, en dollars ; 0 tant qu'il reste dans ce qui est inclus. */
function overageUsd(key: CostItemKey, used: number): number {
  const item = COST_ITEMS[key];
  return Math.max(0, used - item.included) * item.overageUsdPerUnit;
}

/** La facture que donne le relevé : l'abonnement, plus chaque dépassement. */
export function estimatedBillUsd(reading: CostReading): number {
  return WORKERS_PAID_BASE_USD + COST_ITEM_KEYS.reduce((sum, key) => sum + overageUsd(key, reading[key]), 0);
}

type Tone = 'ok' | 'warn' | 'danger';

/** Le mois écoulé, celui qu'un relevé complet vise. */
export function expectedCostMonth(now: Date): string {
  return costMonths(now)[1];
}

const number = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits });
const dollars = (value: number) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

/** À 80 % de ce qui est inclus, un poste est à surveiller ; au-delà de 100 %, il se paie. */
const WATCH_SHARE = 0.8;

type CostItemLine = { key: CostItemKey; label: string; text: string; tone: Tone };

export type CostView = {
  tone: Tone;
  /** « Relevé de novembre 2026, noté le 20/11/2026. », ou ce qu'il manque. */
  headline: string;
  items: CostItemLine[];
  /** « Facture : 5,00 $ ; d'après ce relevé : 5,00 $ ; estimation : ≈ 5 $… ». */
  bill: string | null;
  /** Les relevés d'avant : « octobre 2026 : 5,00 $ ». */
  history: string[];
  /** Le relevé à faire, s'il manque. */
  missing: string | null;
};

export function costView(readings: readonly StoredCostReading[], now: Date): CostView {
  const sorted = [...readings].sort((a, b) => b.month.localeCompare(a.month));
  const latest = sorted[0];
  const expected = expectedCostMonth(now);
  const missing = !latest || latest.month < expected
    ? `Le relevé ${ofMonthWords(expected)} n’est pas noté : copiez-le depuis le tableau de bord de Cloudflare.`
    : null;
  if (!latest) {
    return { tone: 'warn', headline: 'Aucun relevé noté.', items: [], bill: null, history: [], missing };
  }
  const items = COST_ITEM_KEYS.map((key): CostItemLine => {
    const item = COST_ITEMS[key];
    const used = latest[key];
    const share = used / item.included;
    const tone: Tone = share > 1 ? 'danger' : share >= WATCH_SHARE ? 'warn' : 'ok';
    const percent = share < 0.01 && used > 0 ? 'moins de 1 %' : `${number(share * 100)} %`;
    const beyond = share > 1 ? ` : dépasse, ≈ ${dollars(overageUsd(key, used))} en plus` : '';
    return { key, label: item.label, tone, text: `${number(used, 1)} ${item.unit} sur ${number(item.included)} inclus (${percent})${beyond}` };
  });
  const worst: Tone = items.some(({ tone }) => tone === 'danger') ? 'danger' : items.some(({ tone }) => tone === 'warn') || missing ? 'warn' : 'ok';
  const estimated = estimatedBillUsd(latest);
  const bill = `${latest.billedUsd === null ? 'Facture pas encore notée' : `Facture : ${dollars(latest.billedUsd)}`} ; d’après ce relevé : ${dollars(estimated)} ; estimation : ${COST_ESTIMATE_WORDS}.`;
  return {
    tone: worst,
    headline: `Relevé ${ofMonthWords(latest.month)}, noté le ${frenchDay(dateKeyInTimeZone(new Date(latest.recordedAt), FARM_TIME_ZONE))}.`,
    items,
    bill,
    history: sorted.slice(1, 12).map((reading) => `${monthWords(reading.month)} : ${reading.billedUsd === null ? `≈ ${dollars(estimatedBillUsd(reading))} d’après le relevé` : dollars(reading.billedUsd)}`),
    missing,
  };
}

/** « Le relevé d’octobre 2026 est noté. » */
export function costReadingRecordedMessage(reading: CostReading, replaced: boolean): string {
  return `Le relevé ${ofMonthWords(reading.month)} est ${replaced ? 'remplacé' : 'noté'}.`;
}
