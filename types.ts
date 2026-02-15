
export enum LogSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  ANOMALY = 'ANOMALY'
}

export interface ForensicLog {
  id: string;
  timestamp: string;
  source: string;
  event: string;
  user: string;
  ipAddress: string;
  severity: LogSeverity;
  raw: string;
  hash: string; // Chain of custody
}

export interface AIInsight {
  summary: string;
  threatLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  reasoning: string;
  suggestedAction: string;
  anomalies: string[];
}

export type ViewState = 'dashboard' | 'logs' | 'ai-investigator' | 'timeline' | 'reports';
