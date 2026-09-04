import { stableSort } from './order.js';

export const HEAT_SORT_METRICS = Object.freeze([
  { id: 'popularity', label: '热度值' },
  { id: 'redCount', label: '红心数量' },
  { id: 'commentCount', label: '评论数量' }
]);

const HEAT_SORT_METRIC_IDS = new Set(HEAT_SORT_METRICS.map(metric => metric.id));

export const DEFAULT_HEAT_SORT_CONFIG = Object.freeze({
  metric: 'popularity',
  descending: true
});

export function normalizeHeatSortConfig(config = DEFAULT_HEAT_SORT_CONFIG) {
  const source = config && typeof config === 'object'
    ? config
    : DEFAULT_HEAT_SORT_CONFIG;

  return {
    metric: HEAT_SORT_METRIC_IDS.has(source.metric)
      ? source.metric
      : DEFAULT_HEAT_SORT_CONFIG.metric,
    descending: source.descending !== false
  };
}

function getMetricValue(item, metric) {
  if (item?.[metric] === null || item?.[metric] === undefined || item?.[metric] === '') {
    return null;
  }
  const value = Number(item?.[metric]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function cmpByHeat(config = DEFAULT_HEAT_SORT_CONFIG) {
  const normalizedConfig = normalizeHeatSortConfig(config);

  return (a, b) => {
    const valueA = getMetricValue(a, normalizedConfig.metric);
    const valueB = getMetricValue(b, normalizedConfig.metric);
    const knownA = valueA !== null;
    const knownB = valueB !== null;

    if (knownA !== knownB) return knownA ? -1 : 1;
    if (!knownA) return 0;
    if (valueA === valueB) return 0;

    return normalizedConfig.descending
      ? valueB - valueA
      : valueA - valueB;
  };
}

export function sortSongsByHeat(items, config = DEFAULT_HEAT_SORT_CONFIG) {
  return stableSort(items, cmpByHeat(config));
}
