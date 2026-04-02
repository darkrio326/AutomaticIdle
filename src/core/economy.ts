import type { GameConfig } from './types';

export function calcBuildingMaintenancePerSecond(
  purchasedBuildingIds: Iterable<string> | undefined,
  config: GameConfig,
): number {
  if (!purchasedBuildingIds || !config.buildings) return 0;

  let total = 0;
  for (const buildingId of purchasedBuildingIds) {
    total += Math.max(0, config.buildings[buildingId]?.maintenanceGoldPerSecond ?? 0);
  }
  return total;
}