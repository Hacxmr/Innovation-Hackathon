import React, { useMemo } from 'react';
import { FileRelationship, UploadedFile } from '../services/forensicCaseService';
import { graphService, GraphNode, GraphEdge } from '../services/graphService';
import { ForensicLog } from '../types';
import { FileText, Users, MapPin, Clock, Shield, Activity, AlertTriangle } from 'lucide-react';

interface FileGraphProps {
  files: UploadedFile[];
  relationships: FileRelationship[];
  selectedFiles: string[];
  onFileSelect: (fileId: string) => void;
  logsMap: Map<string, ForensicLog[]>;
}

export const FileGraph: React.FC<FileGraphProps> = ({
  files,
  relationships,
  selectedFiles,
  onFileSelect,
  logsMap,
}) => {
  // Generate comprehensive entity graph
  const graph = useMemo(() => {
    console.log('[FileGraph] Generating graph with:', {
      filesCount: files.length,
      logsMapSize: logsMap.size,
      logsMapKeys: Array.from(logsMap.keys()),
    });
    
    const generatedGraph = graphService.generateGraph(files, logsMap);
    
    console.log('[FileGraph] Generated graph:', {
      nodesCount: generatedGraph.nodes.length,
      edgesCount: generatedGraph.edges.length,
      nodeTypes: generatedGraph.nodes.map(n => n.type),
    });
    
    return generatedGraph;
  }, [files, logsMap]);

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <p>No files uploaded yet. Upload evidence files to see correlation graph.</p>
      </div>
    );
  }

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileText size={14} />;
      case 'user':
        return <Users size={14} />;
      case 'ip':
        return <MapPin size={14} />;
      case 'source':
        return <Activity size={14} />;
      case 'event':
        return <AlertTriangle size={14} />;
      default:
        return <Shield size={14} />;
    }
  };

  const getNodeColor = (node: GraphNode) => {
    if (node.severity === 'CRITICAL') return { fill: '#7f1d1d', stroke: '#dc2626', text: '#fca5a5' };
    if (node.severity === 'ANOMALY') return { fill: '#78350f', stroke: '#f59e0b', text: '#fcd34d' };
    if (node.severity === 'WARNING') return { fill: '#713f12', stroke: '#f97316', text: '#fdba74' };
    
    switch (node.type) {
      case 'file':
        return { fill: '#1e3a8a', stroke: '#3b82f6', text: '#93c5fd' };
      case 'user':
        return { fill: '#14532d', stroke: '#22c55e', text: '#86efac' };
      case 'ip':
        return { fill: '#7c2d12', stroke: '#f97316', text: '#fdba74' };
      case 'source':
        return { fill: '#581c87', stroke: '#a78bfa', text: '#c4b5fd' };
      case 'event':
        return { fill: '#831843', stroke: '#ec4899', text: '#f9a8d4' };
      default:
        return { fill: '#1e293b', stroke: '#64748b', text: '#cbd5e1' };
    }
  };

  const getEdgeColor = (type: string) => {
    switch (type) {
      case 'performed':
        return '#22c55e';
      case 'originated':
        return '#f97316';
      case 'contains':
        return '#3b82f6';
      case 'related':
        return '#a78bfa';
      default:
        return '#64748b';
    }
  };

  // Force-directed layout simulation
  const positions = useMemo(() => {
    const nodes = graph.nodes;
    const centerX = 400;
    const centerY = 250;
    
    // Group nodes by type for better layout
    const fileNodes = nodes.filter(n => n.type === 'file');
    const userNodes = nodes.filter(n => n.type === 'user');
    const ipNodes = nodes.filter(n => n.type === 'ip');
    const sourceNodes = nodes.filter(n => n.type === 'source');
    const eventNodes = nodes.filter(n => n.type === 'event');
    
    const positions: { x: number; y: number; node: GraphNode }[] = [];
    
    // Place file nodes in center circle
    fileNodes.forEach((node, i) => {
      const angle = (i / fileNodes.length) * 2 * Math.PI;
      const radius = Math.min(80, 40 + fileNodes.length * 10);
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        node,
      });
    });
    
    // Place user nodes in outer ring (right side)
    userNodes.forEach((node, i) => {
      const angle = -Math.PI / 3 + (i / Math.max(userNodes.length - 1, 1)) * (2 * Math.PI / 3);
      const radius = 180;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        node,
      });
    });
    
    // Place IP nodes in outer ring (left side)
    ipNodes.forEach((node, i) => {
      const angle = Math.PI - Math.PI / 3 + (i / Math.max(ipNodes.length - 1, 1)) * (2 * Math.PI / 3);
      const radius = 180;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        node,
      });
    });
    
    // Place source nodes at top
    sourceNodes.forEach((node, i) => {
      const angle = -Math.PI / 2 - Math.PI / 6 + (i / Math.max(sourceNodes.length - 1, 1)) * (Math.PI / 3);
      const radius = 160;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        node,
      });
    });
    
    // Place event nodes at bottom
    eventNodes.forEach((node, i) => {
      const angle = Math.PI / 2 - Math.PI / 6 + (i / Math.max(eventNodes.length - 1, 1)) * (Math.PI / 3);
      const radius = 160;
      positions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        node,
      });
    });
    
    return positions;
  }, [graph.nodes]);

  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Shield className="text-blue-400" size={20} />
        Forensic Entity Graph
        <span className="text-xs text-slate-500 ml-2">
          ({graph.nodes.length} nodes, {graph.edges.length} connections)
        </span>
      </h3>
      
      <svg width="800" height="500" className="bg-slate-800 rounded-lg">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" opacity="0.6" />
          </marker>
        </defs>
        
        {/* Draw edges */}
        {graph.edges.map((edge) => {
          const source = positions.find(p => p.node.id === edge.source);
          const target = positions.find(p => p.node.id === edge.target);
          
          if (!source || !target) return null;
          
          const color = getEdgeColor(edge.type);
          const strokeWidth = 1 + edge.strength * 2;
          
          // Calculate edge midpoint for label
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          
          return (
            <g key={edge.id}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={0.5}
                markerEnd="url(#arrowhead)"
              />
              
              {/* Edge label with background */}
              {edge.label && (
                <g>
                  <rect
                    x={midX - 30}
                    y={midY - 8}
                    width={60}
                    height={16}
                    fill="#1e293b"
                    opacity={0.9}
                    rx="3"
                  />
                  <text
                    x={midX}
                    y={midY}
                    fill={color}
                    fontSize="9"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="500"
                  >
                    {edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        
        {/* Draw nodes */}
        {positions.map((pos) => {
          const colors = getNodeColor(pos.node);
          const isFile = pos.node.type === 'file';
          const isSelected = isFile && selectedFiles.includes(pos.node.id);
          const strokeColor = isSelected ? '#3b82f6' : colors.stroke;
          const strokeWidth = isSelected ? 3 : 2;
          const radius = pos.node.type === 'file' ? 30 : 24;
          
          return (
            <g
              key={pos.node.id}
              onClick={() => isFile && onFileSelect(pos.node.id)}
              style={{ cursor: isFile ? 'pointer' : 'default' }}
            >
              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={colors.fill}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={0.95}
              />
              
              {/* Critical/Anomaly indicator ring */}
              {pos.node.severity && pos.node.severity !== 'INFO' && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius + 4}
                  fill="none"
                  stroke={pos.node.severity === 'CRITICAL' ? '#dc2626' : '#f59e0b'}
                  strokeWidth={2}
                  opacity={0.8}
                  strokeDasharray="2,2"
                />
              )}
              
              {/* Node label (main text) */}
              <text
                x={pos.x}
                y={pos.y - 3}
                fill={colors.text}
                fontSize={pos.node.type === 'file' ? '13' : '11'}
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {pos.node.label.length > 12 ? pos.node.label.substring(0, 12) + '..' : pos.node.label}
              </text>
              
              {/* Count badge */}
              {pos.node.count > 0 && (
                <text
                  x={pos.x}
                  y={pos.y + 10}
                  fill={colors.text}
                  fontSize="9"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  opacity={0.8}
                >
                  ({pos.node.count})
                </text>
              )}
              
              {/* Type indicator label below node */}
              <text
                x={pos.x}
                y={pos.y + radius + 15}
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {pos.node.type.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      
      <div className="mt-4 p-3 bg-slate-800 rounded-lg">
        <p className="text-sm text-slate-400 mb-2">
          <strong className="text-slate-300">Legend:</strong>
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-blue-400" />
              <span className="text-slate-400">Evidence File</span>
            </div>
            <div className="flex items-center gap-2">
              <Users size={12} className="text-green-400" />
              <span className="text-slate-400">User Account</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={12} className="text-orange-400" />
              <span className="text-slate-400">IP Address</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-purple-400" />
              <span className="text-slate-400">Log Source</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} className="text-pink-400" />
              <span className="text-slate-400">Critical Event</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-red-600 border-dashed"></div>
              <span className="text-slate-400">High Severity</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          <strong className="text-slate-400">Edge Types:</strong> 
          <span className="text-green-400 ml-2">Performed</span> · 
          <span className="text-orange-400 ml-2">Originated</span> · 
          <span className="text-blue-400 ml-2">Contains</span> · 
          <span className="text-purple-400 ml-2">Related</span>
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Click on file nodes to select/deselect. Line thickness indicates relationship strength.
        </p>
      </div>
    </div>
  );
};
