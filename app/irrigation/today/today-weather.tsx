'use client';

import { celsiusText } from '@/lib/domain/crop-alerts/text';
import { mmText } from '@/lib/domain/figure-origin';
import { pageHref, type PageQuery } from '@/lib/domain/features/pages';
import type { TodayBlock } from '@/lib/domain/today/today-view';
import type { TodayWeatherDay } from '@/lib/domain/today/weather-days';
import { Icon, type IconName } from '../line-icon';

type WeatherBlock = Extract<TodayBlock, { kind: 'weather' }>;

const DAY_ICONS: Record<TodayWeatherDay['icon'], IconName> = {
  frost: 'flocon',
  rain: 'pluie',
  sun: 'soleil',
  unknown: 'nuage',
};

const BLOCK_ICONS: Record<WeatherBlock['tone'], IconName> = {
  alert: 'flocon',
  unknown: 'nuage',
  calm: 'soleil',
};

/**
 * « Gel ou chaleur » (docs/aujourdhui-tableau-de-bord-contract.md,
 * section 3.2) : les trois jours en cartes, la minimale et la maximale sur
 * une échelle commune avec le trait de 0 °C, la pluie prévue (une
 * prévision, D-006). Le jour d'une alerte est encadré en rouge avec ce qui
 * est annoncé ; un jour sans prévision se dit inconnu (D-003). Les phrases
 * du bloc restent, pour un lecteur d'écran et pour dire le calme ou le
 * manque ; l'alerte, déjà dessinée, n'y est lue qu'à voix.
 */
export function TodayWeather({ block, query }: { block: WeatherBlock; query: PageQuery }) {
  const { scale } = block;
  return (
    <section className="today-block" id="today-weather" data-tour="aujourdhui-gel" data-kind="weather" data-tone={block.tone} aria-labelledby="today-weather-title">
      <div className="today-block-heading">
        <span className="today-block-badge" data-tone={block.tone}><Icon name={BLOCK_ICONS[block.tone]} /></span>
        <div>
          <h2 id="today-weather-title">Gel ou chaleur</h2>
          <p className="today-block-sub">Trois jours, vos seuils d’alerte</p>
        </div>
      </div>
      <ul className="today-days">
        {block.days.map((day) => <WeatherDay key={day.date} day={day} zeroPercent={scale.zeroPercent} />)}
      </ul>
      <div className={block.tone === 'alert' ? 'today-weather-lines sr-only' : 'today-weather-lines'}>
        {block.lines.map((line) => <p key={line} className="today-weather-line">{line}</p>)}
      </div>
      <p className="today-scale-note">
        De la minimale à la maximale, de {celsiusText(scale.minimumCelsius)} à {celsiusText(scale.maximumCelsius)} ; le trait <b aria-hidden="true" /> marque 0 °C.
      </p>
      <a className="today-action-link" href={pageHref(block.link.page, query)}>{block.link.label}</a>
    </section>
  );
}

function WeatherDay({ day, zeroPercent }: { day: TodayWeatherDay; zeroPercent: number }) {
  const known = day.minimumCelsius !== null || day.maximumCelsius !== null;
  return (
    <li className="today-day" data-tone={day.tone} data-icon={day.icon}>
      <p className="today-day-top">
        <span className="today-day-name">{day.label}</span>
        <Icon name={DAY_ICONS[day.icon]} />
      </p>
      {known ? (
        <p className="today-temps">
          <span className="today-temp" data-end="min">{day.minimumCelsius === null ? '?' : celsiusText(day.minimumCelsius)}</span>
          <span className="today-range" aria-hidden="true">
            {day.range ? <i style={{ left: `${day.range.fromPercent}%`, width: `${Math.max(0, day.range.toPercent - day.range.fromPercent)}%` }} /> : null}
            <b style={{ left: `${zeroPercent}%` }} />
          </span>
          <span className="today-temp" data-end="max">{day.maximumCelsius === null ? '?' : celsiusText(day.maximumCelsius)}</span>
        </p>
      ) : (
        <p className="today-day-unknown">Prévision inconnue</p>
      )}
      {known ? (
        <p className="today-day-rain">
          <Icon name="goutte" />
          {day.precipitationMm === null ? 'pluie inconnue' : day.precipitationMm > 0 ? `${mmText(day.precipitationMm)} prévus` : 'pas de pluie prévue'}
        </p>
      ) : null}
      {day.notes.map((note) => <p key={note} className="today-day-note">{note}</p>)}
    </li>
  );
}
