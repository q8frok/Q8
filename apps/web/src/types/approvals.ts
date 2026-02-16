export type ApprovalSeverity = 'green' | 'yellow' | 'red';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalItem {
  id: string;
  title: string;
  domain: 'work-ops' | 'finance' | 'home' | 'personal';
  severity: ApprovalSeverity;
  status: ApprovalStatus;
  createdAt: string;
}

export interface ApprovalQueueResponse {
  generatedAt: string;
  items: ApprovalItem[];
}
