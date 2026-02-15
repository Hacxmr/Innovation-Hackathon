
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Terminal, 
  Activity, 
  Clock, 
  FileText, 
  BrainCircuit, 
  Plus, 
  AlertTriangle,
  ChevronRight,
  Download,
  Filter,
  Trash2,
  RefreshCw,
  Info,
  User,
  MapPin,
  CheckCircle2,
  Hash,
  ShieldAlert,
  Database,
  Folder,
  GitBranch,
  FileCheck
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ForensicLog, LogSeverity, ViewState, AIInsight } from './types';
import { analyzeLogs, parseRawLog, naturalLanguageQuery, checkOllamaHealth } from './services/ollamaService';
import { forensicCaseService, UploadedFile } from './services/forensicCaseService';
import { FileGraph } from './components/FileGraph';
// Note: Import realTimeService when ready to connect to live data sources
// import { realTimeService } from './services/realTimeService';

// --- UI Helpers ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 relative group overflow-hidden ${
      active 
        ? 'bg-gradient-to-r from-blue-600/25 to-indigo-600/20 text-blue-400 border border-blue-500/40 shadow-lg shadow-blue-500/20' 
        : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 hover:border-slate-700/50 border border-transparent'
    }`}
  >
    {active && <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent animate-pulse"></div>}
    <Icon size={18} className={active ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''} />
    <span className="font-bold text-sm relative z-10">{label}</span>
    {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
  </button>
);

const StatCard = ({ title, value, change, color, icon: Icon }: { title: string, value: string | number, change?: string, color: string, icon: any }) => (
  <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <div className={`absolute top-6 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
      <Icon size={72} />
    </div>
    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-radial from-current/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mb-3 relative z-10">{title}</p>
    <div className="flex items-end gap-3">
      <h3 className={`text-5xl font-black ${color} tracking-tighter drop-shadow-[0_0_20px_currentColor] relative z-10`}>{value}</h3>
      {change && (
        <span className="text-xs font-bold mb-2 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {change}
        </span>
      )}
    </div>
  </div>
);

// --- Main Application ---

export default function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  const [logs, setLogs] = useState<ForensicLog[]>([]);
  // Note: Logs start empty. Use file upload to ingest logs, or connect realTimeService for live data
  // See REAL_DATA_SETUP.md for integration instructions
  
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nlQuery, setNlQuery] = useState('');
  const [aiChatResponse, setAiChatResponse] = useState<string>('');
  const [isChatting, setIsChatting] = useState(false);
  
  // Forensic case management
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [currentCase, setCurrentCase] = useState(forensicCaseService.getCurrentCase());
  
  // Initialize or create case
  useEffect(() => {
    if (!currentCase) {
      const newCase = forensicCaseService.createCase();
      setCurrentCase(newCase);
    }
  }, []);
  
  // Check Ollama health on mount
  useEffect(() => {
    const performHealthCheck = async () => {
      console.log('[App] Performing Ollama health check...');
      const health = await checkOllamaHealth();
      
      if (!health.isConnected) {
        console.warn('[App] Ollama not connected:', health.error);
        // Don't show alert immediately, let user explore the app first
      } else if (!health.hasModels) {
        console.warn('[App] Required models not found:', health.error);
        console.log('[App] Available models:', health.models.join(', '));
      } else {
        console.log('[App] Ollama health check passed! Models ready:', health.models.slice(0, 3).join(', '));
      }
    };
    
    // Run health check after a short delay to not block UI
    const timer = setTimeout(performHealthCheck, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  // Update logs when file selection changes
  useEffect(() => {
    if (selectedFiles.length === 0) {
      setLogs(forensicCaseService.getAllLogs());
    } else {
      setLogs(forensicCaseService.getLogsForFiles(selectedFiles));
    }
  }, [selectedFiles]);

  // Computed properties
  const severityData = useMemo(() => {
    const counts = logs.reduce((acc, log) => {
      acc[log.severity] = (acc[log.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const timeData = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(l => ({
        time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        level: l.severity === LogSeverity.CRITICAL ? 100 : l.severity === LogSeverity.ANOMALY ? 75 : l.severity === LogSeverity.WARNING ? 50 : 20
      }));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs
      .filter(log => 
        log.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.ipAddress.includes(searchQuery)
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, searchQuery]);

  // Handlers
  const handleLogIngestion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    
    try {
      let text = '';
      const fileType = file.name.split('.').pop()?.toLowerCase();

      // Handle different file types
      if (fileType === 'json') {
        // Handle JSON files
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = (event) => {
            try {
              const jsonData = JSON.parse(event.target?.result as string);
              // Convert JSON to readable text format
              text = JSON.stringify(jsonData, null, 2);
              resolve(text);
            } catch (err) {
              reject(new Error('Invalid JSON format'));
            }
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
        
      } else {
        // Handle text-based files (txt, log, csv, xml, etc.)
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = (event) => {
            text = event.target?.result as string;
            resolve(text);
          };
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      // Check if we got any text
      if (!text || text.trim().length === 0) {
        throw new Error('No text content could be extracted from the file');
      }

      // Parse the extracted text with AI
      const parsed = await parseRawLog(text);
      
      if (parsed && parsed.length > 0) {
        // Add file to forensic case
        const uploadedFile = forensicCaseService.addFile(
          file.name,
          file.size,
          file.type || fileType || 'unknown',
          parsed
        );
        
        // Update state
        setUploadedFiles(forensicCaseService.getCurrentCase()?.files || []);
        setLogs(forensicCaseService.getAllLogs());
        setCurrentCase(forensicCaseService.getCurrentCase());
        setView('logs');
      } else {
        throw new Error('AI could not extract structured log data');
      }
      
    } catch (err: any) {
      alert(`Forensic Parsing Error: ${err.message || 'Unable to process file'}.\n\nSupported formats: TXT, LOG, CSV, JSON, XML`);
      console.error('File ingestion error:', err);
    } finally {
      setIsAnalyzing(false);
      // Reset file input so same file can be uploaded again
      e.target.value = '';
    }
  };

  const triggerAIAnalysis = async () => {
    if (logs.length === 0) {
      alert("No logs to analyze. Please upload evidence files first.");
      return;
    }
    
    console.log('[App] Starting AI analysis with', logs.length, 'logs');
    setIsAnalyzing(true);
    
    try {
      const insight = await analyzeLogs(logs);
      console.log('[App] AI analysis complete:', insight);
      setAiInsight(insight);
      setView('ai-investigator');
    } catch (err: any) {
      console.error('[App] AI analysis failed:', err);
      const errorMsg = err.message || "Unknown error";
      alert(`AI Correlation Error: ${errorMsg}\\n\\nMake sure Ollama is running (ollama serve) and models are available (ollama list).\\n\\nCheck browser console for details.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNlQuery = async () => {
    if (!nlQuery.trim()) return;
    setIsChatting(true);
    try {
      const response = await naturalLanguageQuery(nlQuery, logs);
      setAiChatResponse(response);
    } catch (err) {
      setAiChatResponse("Investigative Engine Offline: Could not reach the forensic reasoning module.");
      console.error(err);
    } finally {
      setIsChatting(false);
    }
  };
  
  // File selection handlers
  const handleFileSelect = (fileId: string) => {
    setSelectedFiles(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };
  
  const handleSelectAllFiles = () => {
    if (selectedFiles.length === uploadedFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(uploadedFiles.map(f => f.id));
    }
  };
  
  // Download handlers
  const handleDownloadCase = () => {
    forensicCaseService.downloadCase();
  };
  
  const handleDownloadReport = () => {
    forensicCaseService.downloadReport();
  };

  return (
    <div className="flex min-h-screen bg-[#050810] text-slate-200 selection:bg-blue-500/30 selection:text-blue-100 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 cyber-grid opacity-50 pointer-events-none"></div>
      <div className="absolute inset-0 scanline pointer-events-none"></div>
      
      {/* Sidebar Navigation */}
      <aside className="w-72 border-r border-slate-800/40 flex flex-col p-6 bg-[#080b14]/90 backdrop-blur-2xl shrink-0 z-20 relative shadow-2xl shadow-blue-500/5">
        <div className="flex items-center gap-4 mb-12 group">
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-3 rounded-2xl shadow-2xl shadow-blue-500/30 group-hover:scale-110 group-hover:shadow-blue-500/50 transition-all duration-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Shield className="text-white relative z-10" size={26} />
          </div>
          <div>
            <h1 className="font-black text-2xl leading-none tracking-tighter bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">SENTINEL</h1>
            <p className="text-[10px] text-blue-400 font-bold tracking-[0.3em] mt-1.5 uppercase opacity-90 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse-glow"></span>
              Forensic AI Core
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          <SidebarItem icon={Activity} label="Command Center" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <SidebarItem icon={Terminal} label="Log Explorer" active={view === 'logs'} onClick={() => setView('logs')} />
          <SidebarItem icon={BrainCircuit} label="AI Investigator" active={view === 'ai-investigator'} onClick={() => setView('ai-investigator')} />
          <SidebarItem icon={Clock} label="Evidence Timeline" active={view === 'timeline'} onClick={() => setView('timeline')} />
          <SidebarItem icon={FileText} label="Forensic Dossier" active={view === 'reports'} onClick={() => setView('reports')} />
        </nav>

        <div className="mt-auto space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-800 rounded-2xl hover:border-blue-500/70 hover:bg-gradient-to-br hover:from-blue-600/10 hover:to-indigo-600/5 transition-all duration-300 cursor-pointer group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-radial from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:via-blue-500/10 group-hover:to-transparent transition-all duration-500"></div>
            <div className="flex flex-col items-center justify-center relative z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
                <Plus className="w-7 h-7 mb-2 text-slate-600 group-hover:text-blue-400 group-hover:scale-110 transition-all duration-300 relative" />
              </div>
              <p className="text-[10px] font-black text-slate-500 group-hover:text-blue-400 uppercase tracking-[0.2em] transition-colors">Ingest Evidence</p>
              <p className="text-[8px] text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">TXT • LOG • CSV • JSON • XML</p>
            </div>
            <input type="file" accept=".txt,.log,.csv,.json,.xml" className="hidden" onChange={handleLogIngestion} />
          </label>
          <div className="p-4 bg-gradient-to-br from-slate-900/60 to-slate-900/30 rounded-2xl border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6] animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Node Verified</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-relaxed font-mono">HASHING ENGINE ACTIVE: SHA-256</p>
            <div className="mt-2 flex items-center gap-1">
              <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
              </div>
              <span className="text-[8px] text-blue-400 font-mono">80%</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Global Header */}
        <header className="h-20 border-b border-slate-800/40 flex items-center justify-between px-10 bg-[#080b14]/60 backdrop-blur-xl shrink-0 z-10 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 opacity-50"></div>
          <div className="flex items-center gap-6 flex-1 relative z-10">
            <div className="relative w-full max-w-lg group">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors z-10" size={16} />
              <input 
                type="text" 
                placeholder="Search entities, IPs, or events..." 
                className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all outline-none text-slate-300 placeholder:text-slate-600 relative backdrop-blur-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <button 
              onClick={triggerAIAnalysis}
              disabled={isAnalyzing || logs.length === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs transition-all shadow-lg relative overflow-hidden group ${
                isAnalyzing ? 'bg-slate-800 text-slate-600 grayscale cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/30 hover:shadow-blue-500/50 active:scale-95 cursor-pointer'
              }`}
            >
              {!isAnalyzing && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>}
              {isAnalyzing ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} className="drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]" />}
              <span className="relative z-10">AI REASONING</span>
            </button>
            
            {uploadedFiles.length > 0 && (
              <>
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600 transition-all active:scale-95"
                  title="Download forensic report"
                >
                  <Download size={14} />
                  <span>REPORT</span>
                </button>
                <button
                  onClick={handleDownloadCase}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600 transition-all active:scale-95"
                  title="Download case data"
                >
                  <FileCheck size={14} />
                  <span>CASE</span>
                </button>
              </>
            )}
            
            <div className="h-10 w-[1px] bg-slate-800 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold leading-none bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">FORENSIC_ADMIN</p>
                <p className="text-[10px] text-blue-400 font-bold mt-1 flex items-center gap-1 justify-end">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                  LVL 4 CLEARANCE
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border border-slate-600/50 flex items-center justify-center font-black text-slate-300 shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative z-10">FA</span>
              </div>
            </div>
          </div>
        </header>

        {/* View Router */}
        <div className="flex-1 overflow-y-auto p-10 bg-[radial-gradient(ellipse_at_top_right,_#0f1629_0%,_#050810_50%,_#050810_100%)] relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSg1OSwxMzAsMjQ2LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          {view === 'dashboard' && (
            <div className="space-y-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-5xl font-black tracking-tighter mb-3 bg-gradient-to-r from-white via-blue-100 to-slate-300 bg-clip-text text-transparent">Command Center</h2>
                  <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                    <Activity size={14} className="text-blue-500" />
                    Real-time telemetry and artifact aggregation
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-slate-900/80 border border-slate-700/50 px-4 py-2 rounded-xl text-[10px] font-bold text-slate-400 backdrop-blur-sm flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    SESSION: ACTIVE
                  </div>
                  <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/30 border border-blue-800/30 px-4 py-2 rounded-xl text-[10px] font-bold text-blue-400 backdrop-blur-sm flex items-center gap-2">
                    <ShieldAlert size={12} />
                    ENCRYPTION: AES-256
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Artifacts" value={logs.length} color="text-blue-400" icon={FileText} />
                <StatCard title="Critical Breaches" value={logs.filter(l => l.severity === LogSeverity.CRITICAL).length} color="text-red-500" icon={ShieldAlert} />
                <StatCard title="Anomaly Signals" value={logs.filter(l => l.severity === LogSeverity.ANOMALY).length} color="text-amber-400" icon={Activity} />
                <StatCard title="Active Targets" value={new Set(logs.map(l => l.user)).size} color="text-indigo-400" icon={User} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-gradient-to-br from-slate-900/50 to-slate-900/30 border border-slate-800/60 p-8 rounded-3xl backdrop-blur-xl h-[420px] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <h2 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2 relative z-10">
                    <Activity size={16} className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    Artifact Ingestion Velocity
                    <div className="ml-auto flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-[9px] text-blue-400">LIVE</span>
                    </div>
                  </h2>
                  <ResponsiveContainer width="100%" height="90%">
                    <AreaChart data={timeData}>
                      <defs>
                        <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#f1f5f9' }}
                        itemStyle={{ color: '#3b82f6' }}
                      />
                      <Area type="monotone" dataKey="level" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorLevel)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 border border-slate-800/60 p-8 rounded-3xl backdrop-blur-xl h-[420px] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <h2 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2 relative z-10">
                    <Filter size={16} className="text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                    Threat Vectoring
                  </h2>
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie
                        data={severityData}
                        innerRadius={80}
                        outerRadius={105}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {severityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={
                            entry.name === 'CRITICAL' ? '#ef4444' : 
                            entry.name === 'ANOMALY' ? '#fbbf24' : 
                            entry.name === 'WARNING' ? '#fde047' : '#3b82f6'
                          } />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#f1f5f9' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900/30 border border-slate-800/60 rounded-3xl overflow-hidden backdrop-blur-xl">
                <div className="p-8 border-b border-slate-800/60 flex items-center justify-between">
                  <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 flex items-center gap-3">
                    <AlertTriangle size={18} className="text-red-500" />
                    High-Risk Detection Log
                  </h2>
                  <button onClick={() => setView('logs')} className="text-blue-500 text-[10px] font-black uppercase tracking-widest hover:text-blue-400 transition-colors flex items-center gap-1">
                    Enter Explorer <ChevronRight size={14} />
                  </button>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {logs.filter(l => l.severity === LogSeverity.CRITICAL || l.severity === LogSeverity.ANOMALY).slice(0, 6).map(log => (
                    <div key={log.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-6">
                        <div className={`w-3 h-3 rounded-full blur-[2px] ${log.severity === LogSeverity.CRITICAL ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                        <div>
                          <p className="font-bold text-slate-200 group-hover:text-white transition-colors">{log.event}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-12">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-600 uppercase mb-1">Target Entity</p>
                          <p className="text-sm font-bold text-blue-500">{log.user}</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 group-hover:text-blue-500 group-hover:border-blue-500/30 transition-all">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entity Graph - shown when files are uploaded */}
              {uploadedFiles.length > 0 && (
                <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-slate-200 flex items-center gap-2">
                      <GitBranch size={20} className="text-blue-400" />
                      Forensic Entity Graph
                      <span className="text-xs text-slate-500 ml-2">(Interactive Visualization)</span>
                    </h2>
                    <button
                      onClick={() => {
                        console.log('[Dashboard] Uploaded files:', uploadedFiles);
                        console.log('[Dashboard] Current case:', currentCase);
                        console.log('[Dashboard] Logs map size:', currentCase?.logs?.size);
                        console.log('[Dashboard] Logs map keys:', Array.from(currentCase?.logs?.keys() || []));
                        setView('reports');
                      }}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors px-3 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 flex items-center gap-1"
                    >
                      View Full Report <ChevronRight size={14} />
                    </button>
                  </div>
                  <FileGraph
                    files={uploadedFiles}
                    relationships={currentCase?.relationships || []}
                    selectedFiles={selectedFiles}
                    onFileSelect={handleFileSelect}
                    logsMap={currentCase?.logs || new Map()}
                  />
                </div>
              )}
            </div>
          )}

          {view === 'logs' && (
            <div className="animate-in fade-in duration-500 max-w-7xl mx-auto relative z-10">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <h2 className="text-5xl font-black tracking-tighter mb-3 bg-gradient-to-r from-white via-blue-100 to-slate-300 bg-clip-text text-transparent">Artifact Explorer</h2>
                  <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                    <Database size={14} className="text-blue-500" />
                    Deep-packet inspection and metadata extraction
                  </p>
                </div>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:from-slate-800 hover:to-slate-700 hover:border-blue-500/30 transition-all shadow-lg hover:shadow-blue-900/20">
                    <Download size={14} className="drop-shadow-[0_0_6px_rgba(59,130,246,0.3)]" /> Export Evidence
                  </button>
                  <button onClick={() => setLogs([])} className="flex items-center gap-2 px-4 py-2.5 bg-red-950/20 text-red-500 border border-red-900/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-950/40 hover:border-red-500/30 transition-all shadow-lg hover:shadow-red-900/20">
                    <Trash2 size={14} className="drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]" /> Wipe Session
                  </button>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 border border-slate-800/60 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <table className="w-full text-left relative z-10">
                  <thead className="bg-gradient-to-r from-[#0c1120] to-[#0a0f1c] text-slate-400 font-black uppercase tracking-[0.15em] text-[10px] border-b border-slate-800/60">
                    <tr>
                      <th className="px-8 py-5">Timestamp</th>
                      <th className="px-8 py-5">Source</th>
                      <th className="px-8 py-5">Artifact Type</th>
                      <th className="px-8 py-5">Entity</th>
                      <th className="px-8 py-5">Priority</th>
                      <th className="px-8 py-5 text-right">Verification Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-white/[0.05] transition-all duration-200 group/row cursor-pointer">
                        <td className="px-8 py-6 text-slate-400 font-mono text-xs group-hover/row:text-slate-300">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="px-8 py-6">
                          <span className="bg-slate-950 px-2.5 py-1.5 rounded text-[10px] font-black text-blue-500 border border-blue-500/10 uppercase tracking-widest group-hover/row:border-blue-500/30 group-hover/row:shadow-[0_0_10px_rgba(59,130,246,0.2)] transition-all">
                            {log.source}
                          </span>
                        </td>
                        <td className="px-8 py-6 font-bold text-slate-200 group-hover/row:text-white">{log.event}</td>
                        <td className="px-8 py-6 text-blue-400 font-semibold group-hover/row:text-blue-300">{log.user}</td>
                        <td className="px-8 py-6">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                            log.severity === LogSeverity.CRITICAL ? 'bg-red-500/10 text-red-500 border border-red-500/20 group-hover/row:bg-red-500/20 group-hover/row:shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 
                            log.severity === LogSeverity.ANOMALY ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20 group-hover/row:bg-amber-400/20 group-hover/row:shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 
                            log.severity === LogSeverity.WARNING ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 group-hover/row:bg-yellow-400/20' : 
                            'bg-blue-500/10 text-blue-500 border border-blue-500/20 group-hover/row:bg-blue-500/20'
                          }`}>
                            {log.severity}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="inline-flex items-center gap-2 font-mono text-[9px] text-slate-600 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800/50 group-hover/row:border-slate-700 group-hover/row:text-slate-500 transition-all">
                            <Hash size={10} className="text-slate-700 group-hover/row:text-slate-600" />
                            <span className="truncate max-w-[100px]" title={log.hash}>{log.hash}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'ai-investigator' && (
            <div className="max-w-7xl mx-auto space-y-10 animate-in zoom-in-95 duration-700 relative z-10">
              <div className="flex items-center gap-6 mb-12">
                <div className="p-4 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 rounded-2xl shadow-2xl shadow-purple-900/50 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/20 blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <BrainCircuit className="text-white relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" size={40} />
                </div>
                <div>
                  <h2 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent drop-shadow-sm">AI Reasoning Engine</h2>
                  <p className="text-slate-400 text-lg font-medium flex items-center gap-2 mt-1">
                    <Activity size={14} className="text-purple-500" />
                    Neural correlation and multi-vector threat inference
                  </p>
                </div>
              </div>

              {!aiInsight && !isAnalyzing && (
                <div className="bg-gradient-to-br from-slate-900/40 via-slate-900/30 to-indigo-950/20 border-2 border-dashed border-slate-700/50 p-24 rounded-[3rem] text-center backdrop-blur-sm group hover:border-indigo-500/30 transition-all duration-500 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  <div className="w-24 h-24 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-slate-700/50 group-hover:scale-110 group-hover:border-indigo-500/50 transition-all duration-500 shadow-2xl shadow-indigo-900/30 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-3xl animate-pulse"></div>
                    <BrainCircuit className="text-slate-600 group-hover:text-indigo-400 transition-colors duration-500 relative z-10" size={48} />
                  </div>
                  <h3 className="text-2xl font-black mb-4 bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent relative z-10">Awaiting Forensic Directives</h3>
                  <p className="text-slate-400 mb-10 max-w-lg mx-auto leading-relaxed relative z-10">DeepSeek AI will evaluate cross-system artifacts to generate a unified attack narrative and remediation roadmap.</p>
                  <button 
                    onClick={triggerAIAnalysis}
                    className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all shadow-2xl shadow-purple-900/50 active:scale-95 relative z-10 group/btn overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
                    <span className="relative z-10 flex items-center gap-2 justify-center">
                      <BrainCircuit size={16} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
                      Initiate Neural Reasoning
                    </span>
                  </button>
                </div>
              )}

              {aiInsight && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="bg-[#0c1120] border border-slate-800/60 p-10 rounded-[2rem] border-l-8 border-l-indigo-600 shadow-2xl">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Investigative Verdict</h3>
                      <p className="text-2xl font-bold leading-tight text-slate-100">{aiInsight.summary}</p>
                      <div className="mt-10">
                        <span className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                          aiInsight.threatLevel === 'Critical' ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' :
                          aiInsight.threatLevel === 'High' ? 'bg-orange-500 text-white' :
                          'bg-indigo-600 text-white shadow-lg'
                        }`}>
                          Verdict Priority: {aiInsight.threatLevel}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-900/30 border border-slate-800/60 p-10 rounded-[2rem] backdrop-blur-xl">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <Info size={16} className="text-blue-500" /> Neural Reasoning Logic (XAI)
                      </h3>
                      <p className="text-slate-400 leading-relaxed text-sm font-medium italic">"{aiInsight.reasoning}"</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-slate-900/30 border border-slate-800/60 p-10 rounded-[2rem] backdrop-blur-xl">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Correlation Clusters</h3>
                      <div className="space-y-4">
                        {aiInsight.anomalies.map((anomaly, i) => (
                          <div key={i} className="flex items-start gap-4 p-5 bg-red-500/5 rounded-2xl border border-red-500/10 hover:bg-red-500/10 transition-colors">
                            <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={18} />
                            <p className="text-sm font-bold text-red-200">{anomaly}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#0c1120] border border-slate-800/60 p-10 rounded-[2rem] border-l-8 border-l-green-600 shadow-2xl">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-500" /> Containment Protocol
                      </h3>
                      <p className="text-slate-200 leading-relaxed font-bold text-lg">{aiInsight.suggestedAction}</p>
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/60 p-10 rounded-[2.5rem] backdrop-blur-2xl">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8">Conversational Artifact Query</h3>
                    <div className="flex gap-4">
                      <input 
                        type="text" 
                        placeholder="e.g. 'Show me the correlation between SSH attempts and Database exports'" 
                        className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl px-6 py-5 text-sm focus:ring-4 focus:ring-indigo-600/20 transition-all outline-none text-slate-200 placeholder:text-slate-700"
                        value={nlQuery}
                        onChange={(e) => setNlQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleNlQuery()}
                      />
                      <button 
                        onClick={handleNlQuery}
                        disabled={isChatting}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 shadow-xl"
                      >
                        {isChatting ? <RefreshCw className="animate-spin" size={18} /> : 'Process Query'}
                      </button>
                    </div>
                    {aiChatResponse && (
                      <div className="mt-10 p-10 bg-black/40 border border-slate-800 rounded-[2rem] animate-in fade-in slide-in-from-top-4 duration-500">
                        <h4 className="text-[10px] font-black text-indigo-400 mb-6 uppercase tracking-widest">Neural Response Output:</h4>
                        <div className="prose prose-invert prose-sm max-w-none">
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed font-medium">{aiChatResponse}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'timeline' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700 relative z-10">
              <div className="text-center mb-16">
                <h2 className="text-5xl font-black tracking-tighter mb-4 bg-gradient-to-r from-white via-blue-100 to-slate-300 bg-clip-text text-transparent">Evidence Timeline</h2>
                <p className="text-slate-400 font-medium flex items-center gap-2 justify-center">
                  <Clock size={14} className="text-blue-500" />
                  Reconstruction of forensic events based on verified hashes
                </p>
              </div>

              <div className="relative border-l-4 border-slate-800/60 ml-8 py-8 space-y-20">
                {[...logs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((log, idx) => (
                  <div key={log.id} className="relative pl-16 group">
                    <div className={`absolute -left-[14px] top-0 w-6 h-6 rounded-full border-4 border-[#050810] transition-all duration-500 group-hover:scale-125 group-hover:rotate-180 ${
                      log.severity === LogSeverity.CRITICAL ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse' :
                      log.severity === LogSeverity.ANOMALY ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' :
                      log.severity === LogSeverity.WARNING ? 'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]'
                    }`}></div>
                    
                    <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 border border-slate-800/60 p-8 rounded-[2rem] hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300 backdrop-blur-sm shadow-xl relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800/60 group-hover:border-blue-500/30 transition-all">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-black text-blue-500 tracking-widest uppercase flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                          NODE_REF: {idx + 1}
                        </span>
                      </div>
                      <h4 className="text-xl font-black text-slate-100 mb-6 group-hover:text-blue-400 transition-colors relative z-10">{log.event}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
                        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-3 rounded-xl border border-slate-800/60 hover:border-blue-500/30 hover:bg-slate-950 transition-all">
                          <User size={14} className="text-blue-500 drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]" /> 
                          <span className="text-xs font-bold text-slate-400">{log.user}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-3 rounded-xl border border-slate-800/60 hover:border-green-500/30 hover:bg-slate-950 transition-all">
                          <MapPin size={14} className="text-green-500 drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]" /> 
                          <span className="text-xs font-bold text-slate-400">{log.ipAddress}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-3 rounded-xl border border-slate-800/60 col-span-2 md:col-span-1 hover:border-purple-500/30 hover:bg-slate-950 transition-all">
                          <Terminal size={14} className="text-purple-500 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" /> 
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter truncate">{log.source}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'reports' && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-right-10 duration-700">
              {/* Case Header */}
              <div className="bg-gradient-to-br from-slate-900/60 to-slate-900/30 border border-slate-800/60 p-8 rounded-3xl backdrop-blur-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-4xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                      {currentCase?.name || 'Forensic Case File'}
                    </h1>
                    <p className="text-slate-500 font-bold uppercase tracking-[0.15em] text-xs">
                      Case ID: {currentCase?.id || 'N/A'}
                    </p>
                    <p className="text-slate-600 text-xs mt-1">
                      Created: {currentCase?.createdAt ? new Date(currentCase.createdAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadReport}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 transition-all text-xs font-bold"
                    >
                      <Download size={14} />
                      REPORT
                    </button>
                    <button
                      onClick={handleDownloadCase}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border border-slate-700/50 hover:border-slate-600 transition-all text-xs font-bold"
                    >
                      <FileCheck size={14} />
                      CASE DATA
                    </button>
                  </div>
                </div>
                
                {/* Case Stats */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                  <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Files</p>
                    <p className="text-2xl font-black text-blue-400">{uploadedFiles.length}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Total Logs</p>
                    <p className="text-2xl font-black text-cyan-400">{forensicCaseService.getAllLogs().length}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Relationships</p>
                    <p className="text-2xl font-black text-purple-400">{currentCase?.relationships.length || 0}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Threat Level</p>
                    <p className={`text-2xl font-black ${aiInsight?.threatLevel === 'Critical' ? 'text-red-500' : aiInsight?.threatLevel === 'High' ? 'text-orange-500' : 'text-green-500'}`}>
                      {aiInsight?.threatLevel || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {uploadedFiles.length > 0 ? (
                <>
                  {/* File Correlation Graph */}
                  <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-black text-slate-200 flex items-center gap-2">
                        <GitBranch size={20} className="text-blue-400" />
                        File Correlation Graph
                      </h2>
                      <button
                        onClick={handleSelectAllFiles}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors px-3 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30"
                      >
                        {selectedFiles.length === uploadedFiles.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <FileGraph
                      files={uploadedFiles}
                      relationships={currentCase?.relationships || []}
                      selectedFiles={selectedFiles}
                      onFileSelect={handleFileSelect}
                      logsMap={currentCase?.logs || new Map()}
                    />
                  </div>

                  {/* File List with Selection */}
                  <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-xl">
                    <h2 className="text-xl font-black text-slate-200 flex items-center gap-2 mb-4">
                      <Folder size={20} className="text-cyan-400" />
                      Evidence Files ({selectedFiles.length} of {uploadedFiles.length} selected)
                    </h2>
                    <div className="grid grid-cols-1 gap-2">
                      {uploadedFiles.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => handleFileSelect(file.id)}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedFiles.includes(file.id)
                              ? 'bg-blue-500/10 border-blue-500/50 hover:bg-blue-500/20'
                              : 'bg-slate-900/30 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-2xl font-black text-blue-400">
                              #{file.sequence}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-slate-500" />
                                <p className="font-bold text-sm text-slate-200">{file.name}</p>
                              </div>
                              <div className="flex gap-4 mt-1 text-xs text-slate-500">
                                <span>Type: {file.type}</span>
                                <span>Size: {(file.size / 1024).toFixed(2)} KB</span>
                                <span>Logs: {file.logCount}</span>
                                <span>Uploaded: {new Date(file.uploadedAt).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                              selectedFiles.includes(file.id)
                                ? 'bg-blue-500 border-blue-400'
                                : 'border-slate-600'
                            }`}></div>
                          </div>
                          <div className="mt-2 font-mono text-[10px] text-slate-600 truncate">
                            SHA-256: {file.hash}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* File Relationships */}
                  {currentCase && currentCase.relationships.length > 0 && (
                    <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl backdrop-blur-xl">
                      <h2 className="text-xl font-black text-slate-200 flex items-center gap-2 mb-4">
                        <GitBranch size={20} className="text-green-400" />
                        Detected Correlations
                      </h2>
                      <div className="space-y-2">
                        {currentCase.relationships.map((rel, idx) => {
                          const sourceFile = uploadedFiles.find(f => f.id === rel.sourceFileId);
                          const targetFile = uploadedFiles.find(f => f.id === rel.targetFileId);
                          return (
                            <div key={idx} className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400">#{sourceFile?.sequence}</span>
                                <span className="text-xs text-slate-500">{sourceFile?.name}</span>
                                <span className="text-slate-600">←→</span>
                                <span className="text-xs font-bold text-slate-400">#{targetFile?.sequence}</span>
                                <span className="text-xs text-slate-500">{targetFile?.name}</span>
                                <span className={`ml-auto px-2 py-1 rounded-lg text-[10px] font-bold ${
                                  rel.type === 'temporal' ? 'bg-blue-500/20 text-blue-400' :
                                  rel.type === 'user' ? 'bg-green-500/20 text-green-400' :
                                  rel.type === 'ip' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-purple-500/20 text-purple-400'
                                }`}>
                                  {rel.type.toUpperCase()}
                                </span>
                                <span className="text-xs text-slate-500">{Math.round(rel.strength * 100)}%</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-2">{rel.description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-slate-500">
                  <Folder size={64} className="mb-4 opacity-20" />
                  <p className="text-xl font-bold mb-2">No Evidence Files Uploaded</p>
                  <p className="text-sm">Upload log files using the sidebar to start building your forensic case.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Forensic Loading Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-[#050810]/95 backdrop-blur-2xl flex items-center justify-center z-50 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 animate-pulse"></div>
          <div className="absolute inset-0 cyber-grid opacity-30"></div>
          <div className="absolute inset-0 scanline"></div>
          <div className="text-center space-y-10 relative z-10">
            <div className="relative w-40 h-40 mx-auto">
              <div className="absolute inset-0 border-[3px] border-blue-600/20 rounded-full"></div>
              <div className="absolute inset-0 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 border-[3px] border-purple-500/30 border-b-transparent rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
              <div className="absolute inset-4 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-full blur-xl animate-pulse"></div>
              <BrainCircuit className="absolute inset-0 m-auto text-blue-500 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-pulse" size={56} />
            </div>
            <div className="space-y-3">
              <h3 className="text-3xl font-black tracking-tighter uppercase bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Correlating Evidence</h3>
              <p className="text-slate-400 text-xs font-bold tracking-[0.3em] uppercase flex items-center gap-2 justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                AI Reasoning Session Active
              </p>
            </div>
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce shadow-[0_0_10px_rgba(59,130,246,0.8)]" style={{ animationDelay: `${i * 0.2}s` }}></div>)}
            </div>
            <div className="mt-8 space-y-2">
              <div className="h-1 w-64 mx-auto bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">DeepSeek V3.1 Neural Engine</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
