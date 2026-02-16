export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertItem {
  id: string;
  domain: 'work-ops' | 'finance' | 'home' | 'health' | 'system';
  title: string;
  severity: AlertSeverity;
  createdAt: string;
}

export interface AlertsResponse {
  generatedAt: string;
  items: AlertItem[];
}
