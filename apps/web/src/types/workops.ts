export interface WorkOpsSnapshot {
  generatedAt: string;
  reservations: {
    thisWeek: number;
    today: number;
    pendingResponses: number;
    cateringEvents: number;
  };
  staffing: {
    scheduled: number;
    clockedIn: number;
    varianceFlags: number;
  };
  inventory: {
    stockoutRisks: number;
    urgentVendorWindows: number;
  };
  nextAction: string;
}
