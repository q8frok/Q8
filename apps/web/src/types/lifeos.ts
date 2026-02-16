export type LifeOSDomainKind =
  | 'work-ops'
  | 'approvals'
  | 'health'
  | 'knowledge'
  | 'people'
  | 'growth'
  | 'alerts';

export interface LifeOSDomainStatus {
  kind: LifeOSDomainKind;
  score: number; // 0-100 readiness/health score
  openItems: number;
  urgentItems: number;
  lastUpdated: string;
  nextAction: string;
}

export interface LifeOSOverview {
  generatedAt: string;
  integrations: {
    square: boolean;
    google: boolean;
    homeAssistant: boolean;
    plaid: boolean;
    github: boolean;
  };
  domains: LifeOSDomainStatus[];
}
