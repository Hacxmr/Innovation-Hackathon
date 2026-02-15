// Real-time data ingestion service
import { LogEntry, LogSeverity } from '../types';

interface LogSource {
  type: 'file' | 'syslog' | 'api' | 'websocket';
  endpoint: string;
}

class RealTimeLogService {
  private ws: WebSocket | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  // 1. File System Monitoring (Windows Event Logs, Application Logs)
  async watchLogFile(filePath: string, onNewLog: (log: LogEntry) => void) {
    // Use Node.js fs.watch or chokidar library for file monitoring
    try {
      const response = await fetch('/api/logs/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const logEntry = this.parseLogLine(line);
            onNewLog(logEntry);
          } catch (e) {
            console.error('Failed to parse log line:', e);
          }
        }
      }
    } catch (error) {
      console.error('File watching failed:', error);
    }
  }

  // 2. Syslog Server Connection (Real network logs)
  connectToSyslog(host: string, port: number, onNewLog: (log: LogEntry) => void) {
    // Connect to syslog server via WebSocket or TCP
    this.ws = new WebSocket(`ws://${host}:${port}/syslog`);
    
    this.ws.onmessage = (event) => {
      try {
        const logData = JSON.parse(event.data);
        const logEntry = this.parseSyslogData(logData);
        onNewLog(logEntry);
      } catch (e) {
        console.error('Failed to parse syslog data:', e);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('Syslog connection error:', error);
    };
  }

  // 3. API Polling for External Sources (SIEM, Security Tools)
  startPolling(apiEndpoint: string, intervalMs: number, onNewLogs: (logs: LogEntry[]) => void) {
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(apiEndpoint, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('api_token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        const logs = this.normalizeAPIResponse(data);
        onNewLogs(logs);
      } catch (error) {
        console.error('API polling failed:', error);
      }
    }, intervalMs);
  }

  // 4. Windows Event Log Integration
  async fetchWindowsEvents(logName: string = 'Security', onNewLog: (log: LogEntry) => void) {
    try {
      // Call backend API that uses PowerShell to query event logs
      const response = await fetch('/api/windows-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          logName,
          query: '*[System[TimeCreated[timediff(@SystemTime) <= 300000]]]' // Last 5 minutes
        })
      });
      
      const events = await response.json();
      events.forEach((event: any) => {
        const logEntry = this.parseWindowsEvent(event);
        onNewLog(logEntry);
      });
    } catch (error) {
      console.error('Windows event log fetch failed:', error);
    }
  }

  // Parse different log formats
  private parseLogLine(line: string): LogEntry {
    // Common log format parsing (Apache, Nginx, Custom)
    // Example: "2024-01-15 10:30:45 [ERROR] User admin failed login from 192.168.1.100"
    
    const timestamp = new Date().toISOString();
    const severity = this.detectSeverity(line);
    
    return {
      id: crypto.randomUUID(),
      timestamp,
      source: 'File Monitor',
      event: line.substring(0, 100),
      user: this.extractUser(line) || 'unknown',
      ipAddress: this.extractIP(line) || '0.0.0.0',
      severity,
      hash: this.generateHash(line)
    };
  }

  private parseSyslogData(data: any): LogEntry {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(data.timestamp).toISOString(),
      source: data.hostname || 'Syslog',
      event: data.message,
      user: data.user || 'system',
      ipAddress: data.source_ip || '0.0.0.0',
      severity: this.mapSyslogSeverity(data.severity),
      hash: this.generateHash(JSON.stringify(data))
    };
  }

  private parseWindowsEvent(event: any): LogEntry {
    return {
      id: crypto.randomUUID(),
      timestamp: event.TimeCreated,
      source: `Windows-${event.LogName}`,
      event: `EventID ${event.EventID}: ${event.Message}`,
      user: event.UserName || 'SYSTEM',
      ipAddress: event.IpAddress || '127.0.0.1',
      severity: this.mapWindowsEventSeverity(event.Level),
      hash: this.generateHash(`${event.EventID}-${event.TimeCreated}`)
    };
  }

  private normalizeAPIResponse(data: any): LogEntry[] {
    // Adapt this based on your API response structure
    if (Array.isArray(data.logs)) {
      return data.logs.map((log: any) => ({
        id: log.id || crypto.randomUUID(),
        timestamp: log.timestamp || new Date().toISOString(),
        source: log.source || 'API',
        event: log.event || log.message,
        user: log.user || 'unknown',
        ipAddress: log.ip || '0.0.0.0',
        severity: this.detectSeverity(log.event),
        hash: log.hash || this.generateHash(JSON.stringify(log))
      }));
    }
    return [];
  }

  private detectSeverity(text: string): LogSeverity {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('critical') || lowerText.includes('breach') || lowerText.includes('attack')) {
      return LogSeverity.CRITICAL;
    }
    if (lowerText.includes('anomal') || lowerText.includes('suspicious') || lowerText.includes('malware')) {
      return LogSeverity.ANOMALY;
    }
    if (lowerText.includes('warning') || lowerText.includes('failed') || lowerText.includes('error')) {
      return LogSeverity.WARNING;
    }
    return LogSeverity.INFO;
  }

  private mapSyslogSeverity(level: number): LogSeverity {
    if (level <= 2) return LogSeverity.CRITICAL;  // Emergency, Alert, Critical
    if (level <= 4) return LogSeverity.WARNING;    // Error, Warning
    return LogSeverity.INFO;                       // Notice, Info, Debug
  }

  private mapWindowsEventSeverity(level: number): LogSeverity {
    if (level === 1 || level === 2) return LogSeverity.CRITICAL;  // Critical, Error
    if (level === 3) return LogSeverity.WARNING;                   // Warning
    return LogSeverity.INFO;                                       // Information, Verbose
  }

  private extractUser(text: string): string | null {
    const userMatch = text.match(/user[:\s]+([a-zA-Z0-9._-]+)/i);
    return userMatch ? userMatch[1] : null;
  }

  private extractIP(text: string): string | null {
    const ipMatch = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    return ipMatch ? ipMatch[0] : null;
  }

  private generateHash(data: string): string {
    // Simple hash for demo - use crypto.subtle.digest for production
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  // Cleanup
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

export const realTimeService = new RealTimeLogService();
