import { ForensicLog, LogSeverity } from "../types";
import { UploadedFile } from "./forensicCaseService";

export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'user' | 'ip' | 'event' | 'source';
  severity?: LogSeverity;
  count: number;
  metadata?: any;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'performed' | 'originated' | 'related' | 'file-relation';
  strength: number;
  label: string;
}

export interface ForensicGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

class GraphService {
  // Generate comprehensive forensic graph from files and logs
  generateGraph(files: UploadedFile[], logsMap: Map<string, ForensicLog[]>): ForensicGraph {
    console.log('[GraphService] Starting graph generation');
    console.log('[GraphService] Files:', files.length);
    console.log('[GraphService] LogsMap size:', logsMap.size);
    console.log('[GraphService] LogsMap keys:', Array.from(logsMap.keys()));
    
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Phase 1: Create file nodes
    files.forEach(file => {
      const fileNode: GraphNode = {
        id: `file-${file.id}`,
        label: file.name,
        type: 'file',
        count: file.logCount,
        metadata: file
      };
      nodes.push(fileNode);
      nodeMap.set(fileNode.id, fileNode);
      console.log('[GraphService] Created file node:', fileNode.id, 'for', file.name);
    });

    console.log('[GraphService] Phase 1 complete - File nodes created:', nodes.length);

    // Phase 2: Extract entities from logs
    logsMap.forEach((logs, fileId) => {
      console.log('[GraphService] Processing logs for fileId:', fileId, 'count:', logs.length);
      const fileNodeId = `file-${fileId}`;
      
      // Extract unique users
      const userCounts = new Map<string, number>();
      const userSeverity = new Map<string, LogSeverity[]>();
      
      // Extract unique IPs
      const ipCounts = new Map<string, number>();
      const ipSeverity = new Map<string, LogSeverity[]>();
      
      // Extract unique sources
      const sourceCounts = new Map<string, number>();
      
      // Extract key events
      const eventCounts = new Map<string, { count: number, severity: LogSeverity }>();
      
      logs.forEach(log => {
        // Track users
        if (log.user && log.user !== 'unknown' && log.user !== 'N/A') {
          userCounts.set(log.user, (userCounts.get(log.user) || 0) + 1);
          const severities = userSeverity.get(log.user) || [];
          severities.push(log.severity);
          userSeverity.set(log.user, severities);
        }
        
        // Track IPs
        if (log.ipAddress && log.ipAddress !== 'N/A' && log.ipAddress !== '0.0.0.0') {
          ipCounts.set(log.ipAddress, (ipCounts.get(log.ipAddress) || 0) + 1);
          const severities = ipSeverity.get(log.ipAddress) || [];
          severities.push(log.severity);
          ipSeverity.set(log.ipAddress, severities);
        }
        
        // Track sources
        if (log.source && log.source !== 'unknown') {
          sourceCounts.set(log.source, (sourceCounts.get(log.source) || 0) + 1);
        }
        
        // Track critical events
        if (log.severity === LogSeverity.CRITICAL || log.severity === LogSeverity.ANOMALY) {
          const eventKey = log.event.substring(0, 50);
          const existing = eventCounts.get(eventKey);
          if (!existing || log.severity === LogSeverity.CRITICAL) {
            eventCounts.set(eventKey, { count: (existing?.count || 0) + 1, severity: log.severity });
          }
        }
      });
      
      // Create user nodes (top 5 most active)
      Array.from(userCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([user, count]) => {
          const nodeId = `user-${user}`;
          if (!nodeMap.has(nodeId)) {
            const severities = userSeverity.get(user) || [];
            const maxSeverity = this.getMaxSeverity(severities);
            const userNode: GraphNode = {
              id: nodeId,
              label: user,
              type: 'user',
              count,
              severity: maxSeverity,
              metadata: { activities: count, severities }
            };
            nodes.push(userNode);
            nodeMap.set(nodeId, userNode);
          }
          
          // Create edge from file to user
          edges.push({
            id: `${fileNodeId}-${nodeId}`,
            source: fileNodeId,
            target: nodeId,
            type: 'contains',
            strength: Math.min(count / 10, 1),
            label: `${count} activities`
          });
        });
      
      // Create IP nodes (top 5 most active)
      Array.from(ipCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([ip, count]) => {
          const nodeId = `ip-${ip}`;
          if (!nodeMap.has(nodeId)) {
            const severities = ipSeverity.get(ip) || [];
            const maxSeverity = this.getMaxSeverity(severities);
            const ipNode: GraphNode = {
              id: nodeId,
              label: ip,
              type: 'ip',
              count,
              severity: maxSeverity,
              metadata: { connections: count, severities }
            };
            nodes.push(ipNode);
            nodeMap.set(nodeId, ipNode);
          }
          
          // Create edge from file to IP
          edges.push({
            id: `${fileNodeId}-${nodeId}`,
            source: fileNodeId,
            target: nodeId,
            type: 'originated',
            strength: Math.min(count / 10, 1),
            label: `${count} connections`
          });
        });
      
      // Create source nodes (top 3)
      Array.from(sourceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([source, count]) => {
          const nodeId = `source-${source}`;
          if (!nodeMap.has(nodeId)) {
            const sourceNode: GraphNode = {
              id: nodeId,
              label: source,
              type: 'source',
              count,
              metadata: { events: count }
            };
            nodes.push(sourceNode);
            nodeMap.set(nodeId, sourceNode);
          }
          
          // Create edge from source to file
          edges.push({
            id: `${nodeId}-${fileNodeId}`,
            source: nodeId,
            target: fileNodeId,
            type: 'contains',
            strength: Math.min(count / 20, 1),
            label: `${count} events`
          });
        });
      
      // Create event nodes for critical incidents (top 3)
      Array.from(eventCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .forEach(([event, data], idx) => {
          const nodeId = `event-${fileId}-${idx}`;
          const eventNode: GraphNode = {
            id: nodeId,
            label: event.length > 30 ? event.substring(0, 30) + '...' : event,
            type: 'event',
            count: data.count,
            severity: data.severity,
            metadata: { fullEvent: event }
          };
          nodes.push(eventNode);
          nodeMap.set(nodeId, eventNode);
          
          // Create edge from file to event
          edges.push({
            id: `${fileNodeId}-${nodeId}`,
            source: fileNodeId,
            target: nodeId,
            type: 'contains',
            strength: 1,
            label: `${data.count}x ${data.severity}`
          });
        });
    });
    
    // Phase 3: Create cross-entity relationships
    this.createEntityRelationships(nodes, edges, logsMap);
    
    console.log('[GraphService] Graph generation complete');
    console.log('[GraphService] Final nodes count:', nodes.length);
    console.log('[GraphService] Final edges count:', edges.length);
    console.log('[GraphService] Node types breakdown:', {
      file: nodes.filter(n => n.type === 'file').length,
      user: nodes.filter(n => n.type === 'user').length,
      ip: nodes.filter(n => n.type === 'ip').length,
      source: nodes.filter(n => n.type === 'source').length,
      event: nodes.filter(n => n.type === 'event').length,
    });
    
    return { nodes, edges };
  }
  
  private createEntityRelationships(nodes: GraphNode[], edges: GraphEdge[], logsMap: Map<string, ForensicLog[]>) {
    const allLogs = Array.from(logsMap.values()).flat();
    
    // Find user-IP relationships
    const userIpMap = new Map<string, Set<string>>();
    allLogs.forEach(log => {
      if (log.user && log.user !== 'unknown' && log.ipAddress && log.ipAddress !== 'N/A') {
        if (!userIpMap.has(log.user)) {
          userIpMap.set(log.user, new Set());
        }
        userIpMap.get(log.user)!.add(log.ipAddress);
      }
    });
    
    // Create edges between users and IPs
    userIpMap.forEach((ips, user) => {
      const userNodeId = `user-${user}`;
      if (nodes.find(n => n.id === userNodeId)) {
        ips.forEach(ip => {
          const ipNodeId = `ip-${ip}`;
          if (nodes.find(n => n.id === ipNodeId)) {
            const count = allLogs.filter(l => l.user === user && l.ipAddress === ip).length;
            edges.push({
              id: `${userNodeId}-${ipNodeId}`,
              source: userNodeId,
              target: ipNodeId,
              type: 'performed',
              strength: Math.min(count / 5, 1),
              label: `${count} actions`
            });
          }
        });
      }
    });
  }
  
  private getMaxSeverity(severities: LogSeverity[]): LogSeverity {
    if (severities.includes(LogSeverity.CRITICAL)) return LogSeverity.CRITICAL;
    if (severities.includes(LogSeverity.ANOMALY)) return LogSeverity.ANOMALY;
    if (severities.includes(LogSeverity.WARNING)) return LogSeverity.WARNING;
    return LogSeverity.INFO;
  }
}

export const graphService = new GraphService();
