import type { OtfReadRoute } from '../../lib/domain/otf/api-contract.ts';

/**
 * Les réponses types d'Ouvre ta ferme, une par route lue (docs/tranche-4-contract.md,
 * F370 point 5, F395) : réduites, calquées sur celles constatées sur la ferme du
 * porteur (docs/otf-contract.md, « Particularités confirmées du modèle OTF » ;
 * docs/series-contract.md, « Ce que l'API fournit »), champs nuls compris,
 * comme OTF les écrit. Chaque appel rend une copie neuve, qu'un test peut
 * modifier sans toucher aux autres.
 */
export function typicalOtfResponses(): Record<OtfReadRoute, unknown> {
  return structuredClone({
    '/me': [{ id: 17, name: 'Ferme des essais', legalCity: 'Rennes', legalPostcode: '35000', legalCountry: 'FR' }],
    '/configuration': { seasonFirst: 2025, seasonLast: 2026 },
    '/zoneList': [{ id: 14, name: 'Clémentière', area: 10309, seasonFirst: 2025, seasonLast: 2026, coordinates: null }],
    '/plotList': [
      // Le remplissage de la parcelle : masqué comme jardin technique.
      { id: 38, zone: 14, zoneFill: true, name: null, mode: 'open-field', length: null, width: null, area: 10309 },
      { id: 68, zone: 14, name: 'Tunnel 1', mode: 'greenhouse', length: 30, width: 8, area: 240, seasonFirst: 2025, seasonLast: 2026 },
    ],
    '/bedList': [
      { id: 629, zone: 14, plot: 68, name: 'T01', length: 32, width: 75, alleyWidth: 45, area: 24, seasonFirst: 2025, seasonLast: 2026 },
      { id: 630, zone: 14, plot: 68, name: 'T02', length: 16, width: 75, alleyWidth: null, area: 12, seasonFirst: 2025, seasonLast: 2026 },
    ],
    '/actionList': [
      { id: 288, name: 'Semis direct', fqn: 'semis-direct' },
      { id: 287, name: 'Plantation', fqn: 'plantation' },
      { id: 270, name: 'Irrigation', fqn: null },
    ],
    '/plantList': [
      { id: 937, name: 'Ail', fqn: 'ail' },
      { id: 975, name: 'Fève', fqn: 'feve' },
    ],
    '/seriesList': [
      {
        id: 51010, name: 'Aillet', season: 2026, use: 'bed', cycle: 'annual', status: 'open',
        cultivations: [{ id: 53064, series: 51010, plant: 937, harvestWeeks: ['2026-W14', '2026-W15'], harvestWeeksExpected: ['2026-W20'] }],
      },
      {
        id: 54081, name: 'Fève', season: 2026, use: 'bed', cycle: 'annual', status: 'open',
        cultivations: [{ id: 56201, series: 54081, plant: 975, harvestWeeks: null, harvestWeeksExpected: ['2026-W22'] }],
      },
      { id: 60000, name: 'Endives', season: 2026, use: 'block', cycle: 'annual', status: 'open', cultivations: [] },
    ],
    '/placeList': [
      { id: 125090, season: 2026, series: 51010, task: null, zone: 14, plot: 68, bed: 629, length: 32, width: 75, area: 38.4 },
      { id: 125091, season: 2026, series: 54081, task: null, zone: 14, plot: 68, bed: 630, length: 16, width: 75, area: 19.2 },
      { id: 125092, season: 2026, series: null, task: 1, zone: 14, plot: 68, bed: 629, length: 8, width: 75, area: 9.6 },
    ],
    '/taskList': [
      { id: 844280, cultivation: 53064, series: 51010, action: 288, plannedWeek: '2025-W45', doneWeek: '2025-W45', status: 'done' },
      { id: 855511, cultivation: 56201, series: 54081, action: 287, plannedWeek: '2025-W50', doneWeek: '2025-W51', status: 'done' },
      { id: 855512, cultivation: null, series: 54081, action: 287, plannedWeek: '2026-W02', doneWeek: null, status: 'todo' },
      { id: 855514, cultivation: 53064, series: 51010, action: 270, plannedWeek: '2026-W10', doneWeek: null, status: 'todo' },
      { id: 855516, cultivation: null, series: null, action: 288, plannedWeek: '2026-W45', doneWeek: null, status: 'todo' },
    ],
  });
}

/** La réponse d'une route telle qu'OTF l'envoie : une liste dans `list`, avec son nombre, pour les routes de liste. */
export function otfPayload(route: OtfReadRoute, body: unknown): unknown {
  if (route === '/me' || route === '/configuration' || !Array.isArray(body)) return body;
  return { count: body.length, list: body };
}
