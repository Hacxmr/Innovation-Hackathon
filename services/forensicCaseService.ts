import { ForensicLog } from "../types";

export interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
  sequence: number;
  size: number;
  type: string;
  logCount: number;
  hash: string;
}

export interface ForensicCase {
  id: string;
  name: string;
  createdAt: string;
  files: UploadedFile[];
  logs: Map<string, ForensicLog[]>; // fileId -> logs
  relationships: FileRelationship[];
}

export interface FileRelationship {
  sourceFileId: string;
  targetFileId: string;
  type: 'temporal' | 'user' | 'ip' | 'event';
  strength: number;
  description: string;
}

class ForensicCaseService {
  private currentCase: ForensicCase | null = null;
  private caseHistory: ForensicCase[] = [];

  constructor() {
    // Load from localStorage on init
    this.loadFromStorage();
  }

  // Create new case
  createCase(name?: string): ForensicCase {
    const caseId = `case-${Date.now()}`;
    this.currentCase = {
      id: caseId,
      name: name || `Case ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      files: [],
      logs: new Map(),
      relationships: [],
    };
    this.saveToStorage();
    return this.currentCase;
  }

  // Get current case
  getCurrentCase(): ForensicCase | null {
    return this.currentCase;
  }

  // Add file to case
  addFile(
    fileName: string,
    fileSize: number,
    fileType: string,
    logs: ForensicLog[]
  ): UploadedFile {
    if (!this.currentCase) {
      this.createCase();
    }

    const fileId = `file-${Date.now()}`;
    const file: UploadedFile = {
      id: fileId,
      name: fileName,
      uploadedAt: new Date().toISOString(),
      sequence: this.currentCase!.files.length + 1,
      size: fileSize,
      type: fileType,
      logCount: logs.length,
      hash: this.generateFileHash(fileName + fileSize + Date.now()),
    };

    this.currentCase!.files.push(file);
    this.currentCase!.logs.set(fileId, logs);

    // Analyze relationships with existing files
    this.analyzeRelationships(fileId, logs);

    this.saveToStorage();
    return file;
  }

  // Get logs for specific file
  getLogsForFile(fileId: string): ForensicLog[] {
    return this.currentCase?.logs.get(fileId) || [];
  }

  // Get all logs across all files
  getAllLogs(): ForensicLog[] {
    if (!this.currentCase) return [];
    const allLogs: ForensicLog[] = [];
    this.currentCase.logs.forEach((logs) => allLogs.push(...logs));
    return allLogs;
  }

  // Get logs for multiple files
  getLogsForFiles(fileIds: string[]): ForensicLog[] {
    if (!this.currentCase) return [];
    const logs: ForensicLog[] = [];
    fileIds.forEach((fileId) => {
      const fileLogs = this.currentCase!.logs.get(fileId);
      if (fileLogs) logs.push(...fileLogs);
    });
    return logs;
  }

  // Analyze relationships between files
  private analyzeRelationships(newFileId: string, newLogs: ForensicLog[]) {
    if (!this.currentCase || this.currentCase.files.length <= 1) return;

    this.currentCase.logs.forEach((existingLogs, existingFileId) => {
      if (existingFileId === newFileId) return;

      // Find temporal overlap
      const timeOverlap = this.calculateTimeOverlap(newLogs, existingLogs);
      if (timeOverlap > 0.1) {
        this.currentCase!.relationships.push({
          sourceFileId: existingFileId,
          targetFileId: newFileId,
          type: 'temporal',
          strength: timeOverlap,
          description: `${Math.round(timeOverlap * 100)}% temporal overlap`,
        });
      }

      // Find common users
      const commonUsers = this.findCommonUsers(newLogs, existingLogs);
      if (commonUsers.length > 0) {
        this.currentCase!.relationships.push({
          sourceFileId: existingFileId,
          targetFileId: newFileId,
          type: 'user',
          strength: commonUsers.length / 10,
          description: `${commonUsers.length} common users: ${commonUsers.slice(0, 3).join(', ')}`,
        });
      }

      // Find common IP addresses
      const commonIPs = this.findCommonIPs(newLogs, existingLogs);
      if (commonIPs.length > 0) {
        this.currentCase!.relationships.push({
          sourceFileId: existingFileId,
          targetFileId: newFileId,
          type: 'ip',
          strength: commonIPs.length / 10,
          description: `${commonIPs.length} common IPs: ${commonIPs.slice(0, 3).join(', ')}`,
        });
      }
    });
  }

  private calculateTimeOverlap(logs1: ForensicLog[], logs2: ForensicLog[]): number {
    const times1 = logs1.map((l) => new Date(l.timestamp).getTime());
    const times2 = logs2.map((l) => new Date(l.timestamp).getTime());

    const min1 = Math.min(...times1);
    const max1 = Math.max(...times1);
    const min2 = Math.min(...times2);
    const max2 = Math.max(...times2);

    const overlapStart = Math.max(min1, min2);
    const overlapEnd = Math.min(max1, max2);

    if (overlapStart >= overlapEnd) return 0;

    const overlap = overlapEnd - overlapStart;
    const total = Math.max(max1, max2) - Math.min(min1, min2);

    return overlap / total;
  }

  private findCommonUsers(logs1: ForensicLog[], logs2: ForensicLog[]): string[] {
    const users1 = new Set(logs1.map((l) => l.user).filter((u) => u !== 'unknown'));
    const users2 = new Set(logs2.map((l) => l.user).filter((u) => u !== 'unknown'));
    return Array.from(users1).filter((u) => users2.has(u));
  }

  private findCommonIPs(logs1: ForensicLog[], logs2: ForensicLog[]): string[] {
    const ips1 = new Set(logs1.map((l) => l.ipAddress).filter((ip) => ip !== 'N/A'));
    const ips2 = new Set(logs2.map((l) => l.ipAddress).filter((ip) => ip !== 'N/A'));
    return Array.from(ips1).filter((ip) => ips2.has(ip));
  }

  private generateFileHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(16, '0');
    return (hex + hex + hex + hex).substring(0, 64);
  }

  // Export case to JSON
  exportCase(): string {
    if (!this.currentCase) return '{}';

    const exportData = {
      ...this.currentCase,
      logs: Array.from(this.currentCase.logs.entries()).map(([fileId, logs]) => ({
        fileId,
        logs,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Download case as file
  downloadCase() {
    const data = this.exportCase();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentCase?.name || 'forensic-case'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Generate forensic report
  generateReport(): string {
    if (!this.currentCase) return 'No active case';

    const allLogs = this.getAllLogs();
    const criticalCount = allLogs.filter((l) => l.severity === 'CRITICAL').length;
    const anomalyCount = allLogs.filter((l) => l.severity === 'ANOMALY').length;
    const warningCount = allLogs.filter((l) => l.severity === 'WARNING').length;

    const report = `
FORENSIC INVESTIGATION REPORT
═══════════════════════════════════════════════════════════════

Case Name: ${this.currentCase.name}
Case ID: ${this.currentCase.id}
Investigation Date: ${new Date(this.currentCase.createdAt).toLocaleString()}

═══════════════════════════════════════════════════════════════
EVIDENCE SUMMARY
═══════════════════════════════════════════════════════════════

Total Files Analyzed: ${this.currentCase.files.length}
Total Log Entries: ${allLogs.length}
Critical Events: ${criticalCount}
Anomalies Detected: ${anomalyCount}
Warnings: ${warningCount}

═══════════════════════════════════════════════════════════════
FILE CHAIN OF CUSTODY
═══════════════════════════════════════════════════════════════

${this.currentCase.files
  .map(
    (f) => `
[${f.sequence}] ${f.name}
    File ID: ${f.id}
    Upload Time: ${new Date(f.uploadedAt).toLocaleString()}
    Size: ${(f.size / 1024).toFixed(2)} KB
    Type: ${f.type}
    Log Entries: ${f.logCount}
    SHA-256: ${f.hash}
`
  )
  .join('')}

═══════════════════════════════════════════════════════════════
FILE RELATIONSHIPS & CORRELATIONS
═══════════════════════════════════════════════════════════════

${
  this.currentCase.relationships.length > 0
    ? this.currentCase.relationships
        .map((r) => {
          const sourceFile = this.currentCase!.files.find((f) => f.id === r.sourceFileId);
          const targetFile = this.currentCase!.files.find((f) => f.id === r.targetFileId);
          return `
${sourceFile?.name} ←→ ${targetFile?.name}
    Type: ${r.type.toUpperCase()}
    Strength: ${(r.strength * 100).toFixed(0)}%
    Details: ${r.description}
`;
        })
        .join('')
    : '    No correlations detected between files.'
}

═══════════════════════════════════════════════════════════════
TIMELINE ANALYSIS
═══════════════════════════════════════════════════════════════

${this.generateTimeline(allLogs)}

═══════════════════════════════════════════════════════════════
CRITICAL FINDINGS
═══════════════════════════════════════════════════════════════

${allLogs
  .filter((l) => l.severity === 'CRITICAL')
  .slice(0, 10)
  .map(
    (l, i) => `
${i + 1}. [${new Date(l.timestamp).toLocaleString()}] ${l.source}
   Event: ${l.event.substring(0, 100)}
   User: ${l.user} | IP: ${l.ipAddress}
`
  )
  .join('')}

═══════════════════════════════════════════════════════════════
Report Generated: ${new Date().toLocaleString()}
Investigator: FORENSIC_ADMIN (LVL 4 CLEARANCE)
═══════════════════════════════════════════════════════════════
`;

    return report;
  }

  private generateTimeline(logs: ForensicLog[]): string {
    const sorted = [...logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    if (sorted.length === 0) return '    No events recorded.';

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const duration = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
    const hours = duration / (1000 * 60 * 60);

    return `
First Event: ${new Date(first.timestamp).toLocaleString()}
Last Event: ${new Date(last.timestamp).toLocaleString()}
Duration: ${hours.toFixed(2)} hours
Event Rate: ${(logs.length / Math.max(hours, 0.1)).toFixed(2)} events/hour
`;
  }

  // Download report as text file
  downloadReport() {
    const report = this.generateReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentCase?.name || 'forensic-report'}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Save to localStorage
  private saveToStorage() {
    if (!this.currentCase) return;
    try {
      const data = {
        id: this.currentCase.id,
        name: this.currentCase.name,
        createdAt: this.currentCase.createdAt,
        files: this.currentCase.files,
        logs: Array.from(this.currentCase.logs.entries()),
        relationships: this.currentCase.relationships,
      };
      localStorage.setItem('forensic-current-case', JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  // Load from localStorage
  private loadFromStorage() {
    try {
      const data = localStorage.getItem('forensic-current-case');
      if (data) {
        const parsed = JSON.parse(data);
        this.currentCase = {
          ...parsed,
          logs: new Map(parsed.logs),
        };
      }
    } catch (e) {
      console.warn('Could not load from localStorage:', e);
    }
  }

  // Clear current case
  clearCase() {
    this.currentCase = null;
    localStorage.removeItem('forensic-current-case');
  }
}

export const forensicCaseService = new ForensicCaseService();
