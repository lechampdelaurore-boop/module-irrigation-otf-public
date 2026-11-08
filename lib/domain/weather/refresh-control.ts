export type ManualWeatherRefreshGate = { running: boolean };

export function tryStartManualWeatherRefresh(gate: ManualWeatherRefreshGate) {
  if (gate.running) return false;
  gate.running = true;
  return true;
}

export function finishManualWeatherRefresh(gate: ManualWeatherRefreshGate) {
  gate.running = false;
}

export function weatherGeocodingRequired(hasCachedLocation: boolean) {
  return !hasCachedLocation;
}
