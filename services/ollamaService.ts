import { ForensicLog, AIInsight, LogSeverity } from "../types";

/**
 * Ollama API Configuration
 */
const OLLAMA_BASE_URL = "http://localhost:11434";
// Use fast local models for quick analysis
const PARSING_MODEL = "llama3.2:1b"; // Ultra-fast (1.3GB) for parsing
const ANALYSIS_MODEL = "llama3.2:3b"; // Fast (2GB) for analysis
// Alternative models if you want better quality:
// - "gemma3:4b" - More accurate but slower (3.3GB)
// - "deepseek-r1:8b" - Best accuracy but slower (5.2GB)
// Cloud models (slower but more powerful):
// - "qwen3-coder:480b-cloud" - Cloud parsing
// - "gpt-oss:120b-cloud" - Cloud analysis

/**
 * Helper to call Ollama API with JSON formatting
 */
const callOllama = async (prompt: string, systemPrompt?: string, modelOverride?: string, forceJson: boolean = false): Promise<string> => {
  const model = modelOverride || ANALYSIS_MODEL;
  
  try {
    console.log('[Ollama] Calling API with model:', model, forceJson ? '(JSON mode)' : '');
    console.log('[Ollama] Prompt length:', prompt.length, 'chars');
    
    const requestBody: any = {
      model: model,
      prompt: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt,
      stream: false,
      options: {
        temperature: 0.1, // Low temperature for factual accuracy
        num_predict: 2000, // Increased for complete JSON responses
        num_ctx: 4096, // Larger context for analysis
      },
    };
    
    // Force JSON output format (Ollama will ensure valid JSON)
    if (forceJson) {
      requestBody.format = "json";
    }
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Ollama] API returned error:', response.status, errorText);
      
      if (response.status === 404) {
        throw new Error(`Model "${model}" not found. Run: ollama pull ${model}`);
      }
      throw new Error(`Ollama API error (${response.status}): ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.response || "";
    
    console.log('[Ollama] Response received:', responseText.length, 'chars');
    
    if (!responseText) {
      throw new Error('Ollama returned empty response');
    }
    
    return responseText;
    
  } catch (error: any) {
    console.error("[Ollama] API Error:", error);
    
    // Provide specific error messages
    if (error.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to Ollama server at ${OLLAMA_BASE_URL}. ` +
        `Make sure Ollama is running: open terminal and run "ollama serve"`
      );
    }
    
    if (error.message.includes('Model')) {
      throw error; // Re-throw model-specific errors
    }
    
    throw new Error(
      `Ollama error: ${error.message}. ` +
      `Ensure Ollama is running and model "${model}" is installed.`
    );
  }
};

/**
 * Helper to clean JSON responses that might have markdown or extra text
 */
const cleanJsonResponse = (text: string): string => {
  // Remove markdown code blocks
  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  
  // Remove any leading non-JSON text (like "Here is the JSON:")
  text = text.replace(/^[^{\[]*/s, "").trim();
  
  // Remove any trailing non-JSON text
  text = text.replace(/[^}\]]*$/s, "").trim();
  
  // Find the JSON object or array using greedy matching
  // Try object first {}
  const objectMatch = text.match(/\{[^]*\}/);
  if (objectMatch) {
    let jsonText = objectMatch[0];
    
    // Try to fix common JSON issues
    // Remove trailing commas before closing braces/brackets
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
    
    // Ensure all quotes are properly escaped
    try {
      JSON.parse(jsonText); // Test if it parses
      return jsonText;
    } catch (e) {
      console.warn('[JSON Clean] First parse attempt failed, trying fixes...');
    }
  }
  
  // Try array []
  const arrayMatch = text.match(/\[[^]*\]/);
  if (arrayMatch) {
    let jsonText = arrayMatch[0];
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
    try {
      JSON.parse(jsonText);
      return jsonText;
    } catch (e) {
      console.warn('[JSON Clean] Array parse failed');
    }
  }
  
  // Return original text as last resort
  return text;
};

export const analyzeLogs = async (logs: ForensicLog[]): Promise<AIInsight> => {
  // Prioritize critical and anomaly logs, then limit to 15 for faster analysis
  const criticalLogs = logs.filter(l => l.severity === LogSeverity.CRITICAL || l.severity === LogSeverity.ANOMALY);
  const selectedLogs = [...criticalLogs.slice(0, 10), ...logs.slice(0, 5)].slice(0, 15);
  
  // Create a simplified log summary for better AI processing
  const logSummary = selectedLogs.map((log, i) => 
    `Log ${i + 1}: [${log.severity}] ${log.timestamp} - ${log.event} (User: ${log.user}, IP: ${log.ipAddress}, Source: ${log.source})`
  ).join('\n');
  
  const prompt = `Analyze these ${selectedLogs.length} security logs and provide a forensic security assessment.

${logSummary}

Provide your analysis in this JSON structure:
{
  "summary": "Brief 2-3 sentence overview of the security situation",
  "threatLevel": "Low or Medium or High or Critical",
  "reasoning": "Detailed explanation of why you assigned this threat level based on the logs",
  "suggestedAction": "Specific actionable recommendations for the security team",
  "anomalies": ["list of suspicious patterns or indicators found"]
}`;

  const systemPrompt = "You are a cybersecurity analyst. Analyze the logs and return your assessment as valid JSON.";
  
  // Retry logic with progressively simpler prompts
  let attempts = 0;
  const maxAttempts = 2;
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`[AI Analysis] Attempt ${attempts}/${maxAttempts} - Starting analysis with`, selectedLogs.length, 'logs');
      
      // Use analysis model with JSON formatting enforced
      const response = await callOllama(prompt, systemPrompt, ANALYSIS_MODEL, true);
      console.log('[AI Analysis] Raw response length:', response.length, 'chars');
      console.log('[AI Analysis] Raw response preview:', response.substring(0, 300));
      
      const cleanedResponse = cleanJsonResponse(response);
      console.log('[AI Analysis] Cleaned response length:', cleanedResponse.length, 'chars');
      console.log('[AI Analysis] Cleaned response preview:', cleanedResponse.substring(0, 300));
      
      // Try to parse
      let parsed;
      try {
        parsed = JSON.parse(cleanedResponse);
        console.log('[AI Analysis] JSON parsed successfully!');
      } catch (parseError: any) {
        console.error('[AI Analysis] JSON parse failed:', parseError.message);
        console.error('[AI Analysis] Failed JSON text:', cleanedResponse);
        
        // If this is not the last attempt, wait and try again
        if (attempts < maxAttempts) {
          console.log('[AI Analysis] Waiting 1s before retry...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw parseError;
      }
      
      // Validate the response has required fields
      if (!parsed.summary || !parsed.threatLevel || !parsed.reasoning || !parsed.suggestedAction) {
        console.error('[AI Analysis] Missing required fields. Got:', Object.keys(parsed));
        console.error('[AI Analysis] Parsed object:', JSON.stringify(parsed, null, 2));
        
        // If this is not the last attempt, wait and try again
        if (attempts < maxAttempts) {
          console.log('[AI Analysis] Waiting 1s before retry due to missing fields...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error("Invalid response structure - missing required fields");
      }
      
      // Ensure anomalies is an array
      if (!Array.isArray(parsed.anomalies)) {
        console.warn('[AI Analysis] Anomalies not an array, converting...');
        parsed.anomalies = [];
      }
      
      // Add at least one anomaly if none found
      if (parsed.anomalies.length === 0) {
        const criticalCount = selectedLogs.filter(l => l.severity === LogSeverity.CRITICAL).length;
        const anomalyCount = selectedLogs.filter(l => l.severity === LogSeverity.ANOMALY).length;
        if (criticalCount > 0) parsed.anomalies.push(`${criticalCount} CRITICAL severity events detected`);
        if (anomalyCount > 0) parsed.anomalies.push(`${anomalyCount} ANOMALY events requiring investigation`);
        if (parsed.anomalies.length === 0) parsed.anomalies.push('Multiple security events logged');
      }
      
      console.log('[AI Analysis] ✅ Success! Summary:', parsed.summary);
      return parsed as AIInsight;
      
    } catch (error: any) {
      console.error(`[AI Analysis] Attempt ${attempts} failed:`, error.message);
      
      // If this was the last attempt, fall through to fallback
      if (attempts >= maxAttempts) {
        console.error('[AI Analysis] All attempts failed, using fallback analysis');
        break;
      }
      
      // Wait before next attempt (if not already waited in inner retry)
      console.log('[AI Analysis] Waiting 1s before next attempt...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Fallback analysis if all attempts failed
  console.log('[AI Analysis] Using statistical fallback analysis');
  
  // Create a basic analysis from the logs
  const criticalCount = logs.filter(l => l.severity === LogSeverity.CRITICAL).length;
  const anomalyCount = logs.filter(l => l.severity === LogSeverity.ANOMALY).length;
  const warningCount = logs.filter(l => l.severity === LogSeverity.WARNING).length;
  const uniqueUsers = new Set(logs.map(l => l.user)).size;
  const uniqueIPs = new Set(logs.map(l => l.ipAddress)).size;
    
    // Determine threat level
    let threatLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
    if (criticalCount > 0) threatLevel = 'Critical';
    else if (anomalyCount > 5) threatLevel = 'High';
    else if (anomalyCount > 0 || warningCount > 10) threatLevel = 'Medium';
    
    const anomalies: string[] = [];
    if (criticalCount > 0) anomalies.push(`${criticalCount} CRITICAL severity events detected`);
    if (anomalyCount > 0) anomalies.push(`${anomalyCount} ANOMALY events found`);
    if (uniqueUsers > 10) anomalies.push(`Activity from ${uniqueUsers} different user accounts`);
    if (uniqueIPs > 10) anomalies.push(`Connections from ${uniqueIPs} unique IP addresses`);
    if (anomalies.length === 0 && warningCount > 0) anomalies.push(`${warningCount} WARNING events logged`);
    
    // Generate top events for context
    const topEvents = selectedLogs.slice(0, 3).map(l => l.event).join('; ');
    
    // Fallback analysis with detailed forensic context
    return {
      summary: `Forensic analysis of ${logs.length} log entries reveals ${criticalCount} critical, ${anomalyCount} anomaly, and ${warningCount} warning events. Activity involves ${uniqueUsers} user(s) from ${uniqueIPs} IP address(es).`,
      threatLevel: threatLevel,
      reasoning: `Automated statistical analysis shows: ${criticalCount > 0 ? `CRITICAL EVENTS DETECTED requiring immediate investigation` : anomalyCount > 0 ? `Anomalous patterns identified in system behavior` : `Normal operations with ${warningCount} warnings`}. Event distribution: ${Math.round((criticalCount / logs.length) * 100)}% critical, ${Math.round((anomalyCount / logs.length) * 100)}% anomaly, ${Math.round((warningCount / logs.length) * 100)}% warning. Top events: ${topEvents}.`,
      suggestedAction: criticalCount > 0 
        ? `🚨 IMMEDIATE ACTION REQUIRED: (1) Investigate all CRITICAL events immediately. (2) Isolate affected systems. (3) Review user access patterns for ${uniqueUsers > 1 ? 'all ' + uniqueUsers + ' users' : 'suspicious activity'}. (4) Check for lateral movement indicators. (5) Preserve forensic evidence.`
        : anomalyCount > 0
        ? `⚠️ INVESTIGATION RECOMMENDED: (1) Review anomalous events for false positives. (2) Verify user behavior patterns match expected activity. (3) Check system configurations. (4) Correlate with external threat intelligence. (5) Document findings.`
        : `✅ ROUTINE MONITORING: (1) Continue standard monitoring protocols. (2) Review ${warningCount} warning events during next security audit. (3) Ensure comprehensive logging across all systems. (4) Update correlation rules based on patterns observed.`,
      anomalies: anomalies.length > 0 ? anomalies : ["Standard security events - no immediate threats identified"],
    };
};

export const parseRawLog = async (rawText: string): Promise<ForensicLog[]> => {
  const lines = rawText.split('\n').filter(line => line.trim().length > 0);
  const maxLines = 100;
  const limitedLines = lines.slice(0, maxLines).join('\n');
  
  const prompt = `Parse these ${Math.min(lines.length, maxLines)} log entries into a JSON array. Extract key information from each log line.

${limitedLines}

Return a JSON array where each element has:
{
  "id": "sequential number",
  "timestamp": "ISO timestamp or best guess",
  "source": "application/system/network source",
  "event": "what happened",
  "user": "username or unknown",
  "ipAddress": "IP address or N/A",
  "severity": "INFO or WARNING or CRITICAL or ANOMALY",
  "hash": "simple hash string"
}`;

  const systemPrompt = "You are a log parser. Extract structured data from logs and return a JSON array.";
  
  try {
    // Use faster parsing model with JSON format enforced
    const response = await callOllama(prompt, systemPrompt, PARSING_MODEL, true);
    const cleanedResponse = cleanJsonResponse(response);
    const parsed = JSON.parse(cleanedResponse);
    
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }
    
    // Ensure each log has required fields with defaults
    return parsed.map((log: any, idx: number) => ({
      id: log.id || `log-${idx + 1}`,
      timestamp: log.timestamp || new Date().toISOString(),
      source: log.source || 'System',
      event: log.event || log.message || limitedLines.split('\n')[idx]?.substring(0, 200) || 'Unknown event',
      user: log.user || 'unknown',
      ipAddress: log.ipAddress || 'N/A',
      severity: log.severity || LogSeverity.INFO,
      raw: log.raw || limitedLines.split('\n')[idx] || '',
      hash: log.hash || generateSimpleHash(log.event || '')
    })) as ForensicLog[];
  } catch (error) {
    console.error("AI parsing failed, using regex fallback:", error);
    return parseLogsWithRegex(limitedLines);
  }
};

/**
 * Fast regex-based log parser for large files (no AI needed)
 */
const parseLogsWithRegex = (rawText: string): ForensicLog[] => {
  const lines = rawText.split('\n').filter(line => line.trim().length > 0);
  const logs: ForensicLog[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Extract timestamp (various formats)
    const timestampMatch = line.match(/(\d{4}[-/]\d{2}[-/]\d{2}[T ]?\d{2}:\d{2}:\d{2})|(\d{2}[-/]\d{2}[-/]\d{4}\s+\d{1,2}:\d{2}:\d{2})/);
    const timestamp = timestampMatch ? new Date(timestampMatch[0]).toISOString() : new Date().toISOString();
    
    // Extract severity
    let severity: LogSeverity = LogSeverity.INFO;
    if (/\b(critical|breach|attack|malware)\b/i.test(line)) severity = LogSeverity.CRITICAL;
    else if (/\b(anomal|suspicious|unusual)\b/i.test(line)) severity = LogSeverity.ANOMALY;
    else if (/\b(warning|failed|error|denied)\b/i.test(line)) severity = LogSeverity.WARNING;
    
    // Extract user
    const userMatch = line.match(/\buser[:\s]+([a-zA-Z0-9._-]+)/i) || line.match(/\b(admin|root|system|user\d+)\b/i);
    const user = userMatch ? userMatch[1] : 'unknown';
    
    // Extract IP address
    const ipMatch = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const ipAddress = ipMatch ? ipMatch[0] : 'N/A';
    
    // Extract source
    const sourceMatch = line.match(/\bsource[:\s]+([a-zA-Z0-9._-]+)/i) || line.match(/\[([\w-]+)\]/);
    const source = sourceMatch ? sourceMatch[1] : 'System';
    
    // Generate simple hash
    const hash = generateSimpleHash(line);
    
    logs.push({
      id: `log-${i + 1}`,
      timestamp,
      source,
      event: line.substring(0, 200), // First 200 chars as event description
      user,
      ipAddress,
      severity,
      raw: line,
      hash
    });
  }
  
  return logs;
};

/**
 * Generate a simple hex hash for log entries
 */
const generateSimpleHash = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return (hex + hex + hex + hex).substring(0, 64); // 64 char hex
};

export const naturalLanguageQuery = async (
  query: string,
  contextLogs: ForensicLog[]
): Promise<string> => {
  const evidenceSample = JSON.stringify(contextLogs.slice(0, 15), null, 2);
  
  const prompt = `Investigator's Query: ${query}

Current Evidence Sample:
${evidenceSample}

Provide a precise, technical response. Alert to any missed lateral movement patterns or indicators of compromise.`;

  const systemPrompt = `You are 'Sentinel AI', an advanced Cyber Forensics Expert. 
Be precise, technical, and professional in your analysis. 
Focus on actionable intelligence and forensic indicators.`;

  try {
    console.log('[NL Query] Processing query:', query);
    const response = await callOllama(prompt, systemPrompt);
    return response || "No analysis could be performed.";
  } catch (error: any) {
    console.error("[NL Query] Error:", error);
    return `❌ Query Error: ${error.message}\n\nPlease ensure:\n1. Ollama is running (ollama serve)\n2. Model ${ANALYSIS_MODEL} is installed (ollama pull ${ANALYSIS_MODEL})\n3. Check browser console for detailed logs`;
  }
};

/**
 * Health check to verify Ollama connectivity and model availability
 */
export const checkOllamaHealth = async (): Promise<{ 
  isConnected: boolean; 
  hasModels: boolean; 
  models: string[];
  error?: string;
}> => {
  try {
    console.log('[Health Check] Testing Ollama connection...');
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    
    if (!response.ok) {
      return {
        isConnected: false,
        hasModels: false,
        models: [],
        error: `Server returned ${response.status}: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];
    
    const hasParsingModel = models.includes(PARSING_MODEL);
    const hasAnalysisModel = models.includes(ANALYSIS_MODEL);
    
    console.log('[Health Check] Connected! Models found:', models.join(', '));
    
    if (!hasParsingModel) {
      console.warn(`[Health Check] Parsing model "${PARSING_MODEL}" not found`);
    }
    if (!hasAnalysisModel) {
      console.warn(`[Health Check] Analysis model "${ANALYSIS_MODEL}" not found`);
    }
    
    return {
      isConnected: true,
      hasModels: hasParsingModel && hasAnalysisModel,
      models: models,
      error: (!hasParsingModel || !hasAnalysisModel) 
        ? `Missing models: ${!hasParsingModel ? PARSING_MODEL : ''} ${!hasAnalysisModel ? ANALYSIS_MODEL : ''}`.trim()
        : undefined
    };
    
  } catch (error: any) {
    console.error('[Health Check] Failed:', error);
    return {
      isConnected: false,
      hasModels: false,
      models: [],
      error: error.message.includes('fetch') 
        ? `Cannot connect to Ollama at ${OLLAMA_BASE_URL}. Run "ollama serve" in terminal.`
        : error.message
    };
  }
};
