import {
  FARM_TIME_ZONE,
  addDaysToDateKey,
  isValidDateKey,
  localDateStartUtc,
  weekStartDateKey,
} from '../water-management.ts';
import {
  HISTORY_PERIOD_MODES,
  type HistoryPeriod,
  type HistoryPeriodSelection,
  IrrigationHistoryInputError,
} from './contract.ts';
import { dateKeyInSeason, dateKeyInTimeZone, lastDayOfMonth, maxDateKey, minDateKey } from './dates.ts';

export function resolveHistoryPeriod(
  season: number,
  selection: HistoryPeriodSelection,
  now = new Date(),
): HistoryPeriod {
  if (!Number.isInteger(season) || season < 1900 || season > 9999) {
    throw new IrrigationHistoryInputError('La saison sélectionnée est invalide.');
  }
  if (!HISTORY_PERIOD_MODES.includes(selection.mode)) {
    throw new IrrigationHistoryInputError('La période sélectionnée est invalide.');
  }
  const seasonStart = `${season}-01-01`;
  const seasonEnd = `${season}-12-31`;
  const today = dateKeyInTimeZone(now);
  const requestedAnchor = isValidDateKey(selection.anchorDate ?? '')
    ? selection.anchorDate as string
    : today;
  const anchor = requestedAnchor.startsWith(`${season}-`)
    ? requestedAnchor
    : dateKeyInSeason(requestedAnchor, season);
  let startDate: string;
  let endDate: string;

  if (selection.mode === 'week') {
    startDate = maxDateKey(weekStartDateKey(anchor, FARM_TIME_ZONE), seasonStart);
    endDate = minDateKey(addDaysToDateKey(weekStartDateKey(anchor, FARM_TIME_ZONE), 6), seasonEnd);
  } else if (selection.mode === 'month') {
    startDate = maxDateKey(`${anchor.slice(0, 7)}-01`, seasonStart);
    endDate = minDateKey(lastDayOfMonth(anchor), seasonEnd);
  } else if (selection.mode === 'season') {
    startDate = seasonStart;
    endDate = seasonEnd;
  } else {
    startDate = selection.customStartDate ?? '';
    endDate = selection.customEndDate ?? '';
    if (!isValidDateKey(startDate) || !isValidDateKey(endDate) || startDate > endDate) {
      throw new IrrigationHistoryInputError(
        'La date de début doit précéder ou être égale à la date de fin.',
      );
    }
  }

  if (startDate < seasonStart || endDate > seasonEnd) {
    throw new IrrigationHistoryInputError(
      `La période doit rester comprise dans la saison ${season}.`,
    );
  }
  const startAt = localDateStartUtc(startDate, FARM_TIME_ZONE).toISOString();
  const endAtExclusive = localDateStartUtc(
    addDaysToDateKey(endDate, 1),
    FARM_TIME_ZONE,
  ).toISOString();
  return { mode: selection.mode, startDate, endDate, startAt, endAtExclusive };
}
