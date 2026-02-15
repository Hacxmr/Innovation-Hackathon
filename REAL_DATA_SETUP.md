# Real-Time Data Integration Guide

## Overview
Transform Sentinel Forensic AI from demo mode to production with real data sources.

---

## 1. Data Source Integration Options

### Option A: Windows Event Logs (Recommended for Windows)
```powershell
# PowerShell Backend API to query events
Get-WinEvent -FilterHashtable @{
    LogName='Security','Application','System'
    StartTime=(Get-Date).AddMinutes(-5)
} | ConvertTo-Json
```

**Integration Steps:**
1. Create Node.js backend with `child_process` to call PowerShell
2. Parse event log XML/JSON
3. Stream to frontend via WebSocket

### Option B: File Monitoring (Any OS)
```typescript
// Use Node.js backend with chokidar
import chokidar from 'chokidar';

const watcher = chokidar.watch('/var/log/auth.log', {
  persistent: true,
  ignoreInitial: false
});

watcher.on('change', (path) => {
  // Read new lines and send to frontend
  const newLines = readNewLines(path);
  ws.send(JSON.stringify(newLines));
});
```

### Option C: Syslog Server
```bash
# Install syslog-ng or rsyslog to collect network logs
# Forward to your app via TCP/UDP socket
```

### Option D: SIEM Integration
- **Splunk**: Use REST API with authentication
- **ELK Stack**: Query Elasticsearch indices
- **Azure Sentinel**: Use Azure Monitor API
- **QRadar**: AQL queries via REST API

---

## 2. Required Backend Setup

### Create Express.js Backend
```bash
cd sentinel-forensic-ai
npm install express ws chokidar node-fetch
```

### Backend Server (server.js)
```javascript
const express = require('express');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const { exec } = require('child_process');

const app = express();
const wss = new WebSocket.Server({ port: 8080 });

// Real-time log streaming
wss.on('connection', (ws) => {
  console.log('Client connected for real-time logs');
  
  // Watch log files
  const watcher = chokidar.watch([
    'C:\\Windows\\System32\\winevt\\Logs\\Security.evtx',
    '/var/log/auth.log',
    '/var/log/syslog'
  ], { ignoreInitial: true });
  
  watcher.on('change', (path) => {
    // Parse and send new log entries
    parseLogFile(path).then(logs => {
      ws.send(JSON.stringify({ type: 'new_logs', data: logs }));
    });
  });
  
  ws.on('close', () => {
    watcher.close();
  });
});

// Windows Event Log API
app.post('/api/windows-events', async (req, res) => {
  const { logName, query } = req.body;
  
  const psCommand = `
    Get-WinEvent -FilterHashtable @{LogName='${logName}'} -MaxEvents 100 | 
    Select-Object TimeCreated, Id, LevelDisplayName, Message, UserId |
    ConvertTo-Json
  `;
  
  exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr });
    }
    res.json(JSON.parse(stdout));
  });
});

app.listen(3002, () => console.log('Backend running on port 3002'));
```

---

## 3. Update React App for Real Data

### Modify App.tsx
```typescript
import { realTimeService } from './services/realTimeService';
import { useEffect } from 'react';

// Inside App component
useEffect(() => {
  // Option 1: WebSocket connection for real-time streaming
  const ws = new WebSocket('ws://localhost:8080');
  
  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    
    if (type === 'new_logs') {
      setLogs(prevLogs => [...data, ...prevLogs].slice(0, 1000));
    }
  };
  
  // Option 2: Poll Windows Events every 30 seconds
  const pollInterval = setInterval(() => {
    realTimeService.fetchWindowsEvents('Security', (newLog) => {
      setLogs(prev => [newLog, ...prev].slice(0, 1000));
    });
  }, 30000);
  
  // Option 3: Connect to external SIEM
  realTimeService.startPolling(
    'https://your-siem-api.com/logs',
    10000, // Poll every 10 seconds
    (newLogs) => {
      setLogs(prev => [...newLogs, ...prev].slice(0, 1000));
    }
  );
  
  return () => {
    ws.close();
    clearInterval(pollInterval);
    realTimeService.disconnect();
  };
}, []);
```

---

## 4. Real AI Analysis (No Mock Insights)

### Update Ollama Integration
The AI analysis is already real! Your `ollamaService.ts` sends actual logs to DeepSeek AI. Just ensure:

```typescript
// Remove any mock data generation
const triggerAIAnalysis = async () => {
  if (logs.length === 0) {
    alert('No real logs to analyze yet!');
    return;
  }
  
  setIsAnalyzing(true);
  
  try {
    // This already uses real AI reasoning
    const insight = await analyzeLogs(logs);
    setAiInsight(insight);
    setView('ai-investigator');
  } catch (error) {
    console.error('AI analysis failed:', error);
    alert('Failed to analyze logs. Check Ollama connection.');
  } finally {
    setIsAnalyzing(false);
  }
};
```

---

## 5. Production Data Sources Examples

### A. Monitor SSH Login Attempts (Linux)
```bash
# Stream auth.log to your app
tail -f /var/log/auth.log | nc localhost 9000
```

### B. Capture Network Traffic (Windows)
```powershell
# Use netsh or Wireshark tshark
netsh trace start capture=yes tracefile=C:\\capture.etl
```

### C. Database Audit Logs (MySQL/PostgreSQL)
```sql
-- Enable audit logging
SET GLOBAL general_log = 'ON';
-- Stream changes to your app
```

### D. Application Logs (Node.js/Python)
```javascript
// Winston logger streaming to your app
const winstonWebSocket = require('winston-websocket').WebSocket;
logger.add(new winstonWebSocket({
  host: 'localhost',
  port: 8080
}));
```

---

## 6. Real-Time Dashboard Data

### Replace Mock Stats with Real Queries
```typescript
// Real-time stats based on actual logs
const stats = useMemo(() => ({
  totalLogs: logs.length,
  criticalAlerts: logs.filter(l => l.severity === LogSeverity.CRITICAL).length,
  activeThreats: new Set(logs.filter(l => 
    l.severity === LogSeverity.CRITICAL || l.severity === LogSeverity.ANOMALY
  ).map(l => l.ipAddress)).size,
  systemsMonitored: new Set(logs.map(l => l.source)).size
}), [logs]);
```

---

## 7. Commercial Integration Options

For enterprise deployments:

### Splunk Integration
```typescript
const splunkQuery = `
  search index=main earliest=-15m 
  | stats count by source, severity, user
`;

fetch('https://splunk.company.com:8089/services/search/jobs', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: `search=${encodeURIComponent(splunkQuery)}`
});
```

### ELK Stack Integration
```typescript
const elasticsearchQuery = {
  query: {
    range: {
      '@timestamp': {
        gte: 'now-15m'
      }
    }
  }
};

fetch('http://elasticsearch:9200/logs-*/_search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(elasticsearchQuery)
});
```

---

## 8. Testing with Real Logs

### Generate Real Test Data
```bash
# Linux - Generate auth failures
for i in {1..10}; do
  echo "$(date) Failed password for testuser from 192.168.1.$i" >> /tmp/test.log
done

# Windows - Generate Security Events
auditpol /set /subcategory:"Logon" /failure:enable
```

---

## Quick Start Checklist

- [ ] Choose data source (Windows Events, Files, SIEM, Syslog)
- [ ] Set up backend API (Node.js + Express + WebSocket)
- [ ] Install required packages: `chokidar`, `ws`, `express`
- [ ] Update App.tsx to use `realTimeService`
- [ ] Remove `mockData.ts` imports
- [ ] Configure Ollama for real AI analysis
- [ ] Test with real log files
- [ ] Deploy backend alongside frontend

---

## Performance Tips

1. **Limit Log Volume**: Keep only last 1000-5000 logs in memory
2. **Batch Processing**: Process logs in chunks of 50-100
3. **Throttle AI Calls**: Don't analyze on every new log (use debouncing)
4. **Use WebWorkers**: Parse logs in background thread
5. **Database Storage**: Store historical logs in SQLite/PostgreSQL

---

Your Ollama AI reasoning is already 100% real! 🎯
You just need to feed it real data instead of mock logs.
