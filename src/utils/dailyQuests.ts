export interface DailyQuest {
  id: string;
  title: string;
  icon: string;
  completed: boolean;
  xpReward: number;
}

const STORAGE_PREFIX = 'hmc_daily_quests_';

function getTodayKey(): string {
  return STORAGE_PREFIX + new Date().toISOString().slice(0, 10);
}

function getCompletedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const raw = localStorage.getItem(getTodayKey());
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveCompletedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getTodayKey(), JSON.stringify([...ids]));
}

export function completeQuest(questId: string): void {
  const ids = getCompletedIds();
  ids.add(questId);
  saveCompletedIds(ids);
}

export function generateQuests(
  role: string,
  isAdmin: boolean,
  isGovernanceRole: boolean
): DailyQuest[] {
  const completed = getCompletedIds();

  const quests: DailyQuest[] = [
    { id: 'login', title: 'Log in today', icon: 'fa-solid fa-right-to-bracket', completed: true, xpReward: 10 },
    { id: 'check_mission', title: 'Check your next mission', icon: 'fa-solid fa-compass', completed: completed.has('check_mission'), xpReward: 15 },
    { id: 'review_training', title: 'Review training progress', icon: 'fa-solid fa-graduation-cap', completed: completed.has('review_training'), xpReward: 15 },
    { id: 'send_message', title: 'Visit Communication Hub', icon: 'fa-solid fa-message', completed: completed.has('send_message'), xpReward: 10 },
  ];

  if (isAdmin) {
    quests.push({ id: 'review_applicants', title: 'Review applicants', icon: 'fa-solid fa-users', completed: completed.has('review_applicants'), xpReward: 20 });
  } else if (isGovernanceRole) {
    quests.push({ id: 'check_governance', title: 'Check governance docs', icon: 'fa-solid fa-briefcase', completed: completed.has('check_governance'), xpReward: 20 });
  } else {
    quests.push({ id: 'check_calendar', title: 'View the calendar', icon: 'fa-solid fa-calendar-days', completed: completed.has('check_calendar'), xpReward: 10 });
  }

  // Auto-complete login quest
  if (!completed.has('login')) {
    completed.add('login');
    saveCompletedIds(completed);
  }

  return quests;
}

export function getAllQuestsComplete(quests: DailyQuest[]): boolean {
  return quests.every(q => q.completed);
}

export const DAILY_QUEST_BONUS_XP = 25;
