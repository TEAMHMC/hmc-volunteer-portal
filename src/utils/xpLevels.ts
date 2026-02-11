export interface LevelInfo {
  level: number;
  title: string;
  currentXP: number;
  xpToNext: number;
  progress: number;
  isMaxLevel: boolean;
}

const LEVELS: { level: number; title: string; minXP: number }[] = [
  { level: 1, title: 'New Recruit', minXP: 0 },
  { level: 2, title: 'Active Contributor', minXP: 1000 },
  { level: 3, title: 'Community Champion', minXP: 5000 },
  { level: 4, title: 'Impact Leader', minXP: 15000 },
  { level: 5, title: 'Volunteer Legend', minXP: 30000 },
];

export function computeLevel(points: number): LevelInfo {
  let current = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minXP) {
      current = LEVELS[i];
      break;
    }
  }

  const isMaxLevel = current.level === LEVELS[LEVELS.length - 1].level;
  const next = isMaxLevel ? null : LEVELS.find(l => l.level === current.level + 1)!;
  const xpIntoLevel = points - current.minXP;
  const xpForLevel = next ? next.minXP - current.minXP : 1;
  const progress = isMaxLevel ? 100 : Math.min((xpIntoLevel / xpForLevel) * 100, 100);
  const xpToNext = next ? next.minXP - points : 0;

  return {
    level: current.level,
    title: current.title,
    currentXP: points,
    xpToNext,
    progress,
    isMaxLevel,
  };
}
