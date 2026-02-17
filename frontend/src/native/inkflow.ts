export type InkFlowMobilePage = 'hub' | 'characters' | 'steles' | 'posters' | 'study' | 'study_deck';

export type InkFlowLaunch = {
  key: string;
  page: InkFlowMobilePage;
  index?: number;
  steleId?: string;
  steleIndex?: number;
  steleSection?: number;
};

export function newLaunchKey(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
