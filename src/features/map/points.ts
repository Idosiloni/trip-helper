export type MapPoint = { id: string; lat: number; lng: number; color: string; label?: string; title: string; selected?: boolean };

/** Stable empty list, so callers with no markers don't re-render the map every time. */
export const NO_POINTS: MapPoint[] = [];
