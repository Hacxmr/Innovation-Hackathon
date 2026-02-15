import { ForensicLog, AIInsight, LogSeverity } from "../types";

/**
 * OpenRouter API Configuration
 * Get your API key from: https://openrouter.ai/keys
 * Set it as VITE_OPENROUTER_API_KEY in your .env file
 */
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || "";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Debug logging
console.log("=== OpenRouter Configuration ===");
console.log("API Key present:", !!OPENROUTER_API_KEY);
console.log("API Key length:", OPENROUTER_API_KEY.length);
if (OPENROUTER_API_KEY) {
  console.log("API Key preview:", OPENROUTER_API_KEY.substring(0, 20) + "...");
}
console.log("All VITE_ env vars:", Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
console.log("================================");

// Fast and reliable models that work on OpenRouter
const PARSING_MODEL = "openai/gpt-3.5-turbo"; // Fast, cheap ($0.50/$1.50 per 1M tokens)
const ANALYSIS_MODEL = "openai/gpt-3.5-turbo"; // Reliable and fast
// Alternative models:
// Free options (limited availability):
// - "nousresearch/hermes-3-llama-3.1-405b:free" - Free but may have rate limits
// Faster premium options:
// - "openai/gpt-4o-mini" - Faster and smarter ($0.15/$0.60 per 1M tokens)
// - "anthropic/claude-3.5-sonnet" - Best quality ($3/$15 per 1M tokens)
// - "google/gemini-pro-1.5" - Good balance ($1.25/$5 per 1M tokens)

/**
 * Helper to call OpenRouter API
 */
const callOpenRouter = async (
  prompt: string,
  systemPrompt?: string,
  modelOverride?: string
): Promise<string> => {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OpenRouter API key not found. Please set VITE_OPENROUTER_API_KEY in your .env file. Get your key from https://openrouter.ai/keys"
    );
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Sentinel Forensic AI",
      },
      body: JSON.stringify({
        model: modelOverride || ANALYSIS_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || response.statusText;
      console.error("OpenRouter API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
        apiKeyPreview: OPENROUTER_API_KEY.substring(0, 20) + "...",
      });
      
      // Provide specific guidance for 401 errors
      if (response.status === 401) {
        throw new Error(
          `OpenRouter API authentication failed (401): ${errorMessage}. ` +
          `Your API key may be invalid or expired. ` +
          `Please get a fresh API key from https://openrouter.ai/keys and update your .env file.`
        );
      }
      
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorMessage}`
      );
    }

    const data = await response.json();
    console.log("OpenRouter API Response:", { 
      model: data.model, 
      hasContent: !!data.choices?.[0]?.message?.content 
    });
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    if (error instanceof Error && error.message.includes("API key")) {
      throw error;
    }
    throw new Error(
      `Failed to connect to OpenRouter: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

/**
 * Helper to clean JSON responses that might have markdown or extra text
 */
const cleanJsonResponse = (text: string): string => {
  // Remove markdown code blocks
  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Try to extract JSON if it's embedded in other text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  // Check for array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  return text;
};

export const analyzeLogs = async (logs: ForensicLog[]): Promise<AIInsight> => {
  // Limit to 20 most recent logs for faster analysis
  const logSnippet = JSON.stringify(logs.slice(0, 20), null, 2);

  const prompt = `Analyze these ${Math.min(
    logs.length,
    20
  )} forensic logs. Identify threats and provide recommendations.

${logSnippet}

Return JSON only:
{"summary":"brief summary","threatLevel":"Low|Medium|High|Critical","reasoning":"why","suggestedAction":"what to do","anomalies":["ioc1","ioc2"]}`;

  const systemPrompt = "DFIR analyst. JSON only, no markdown.";

  try {
    const response = await callOpenRouter(prompt, systemPrompt, ANALYSIS_MODEL);
    const cleanedResponse = cleanJsonResponse(response);
    const parsed = JSON.parse(cleanedResponse);

    // Validate the response has required fields
    if (
      !parsed.summary ||
      !parsed.threatLevel ||
      !parsed.reasoning ||
      !parsed.suggestedAction ||
      !parsed.anomalies
    ) {
      throw new Error("Invalid response structure from AI");
    }

    return parsed as AIInsight;
  } catch (error) {
    console.error("Error in analyzeLogs:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Return a fallback response with the actual error
    return {
      summary: `Unable to generate complete analysis. Error: ${errorMessage}`,
      threatLevel: "Medium",
      reasoning: `Analysis incomplete due to AI service error: ${errorMessage}`,
      suggestedAction:
        "Review logs manually and check browser console for detailed error information.",
      anomalies: ["AI analysis unavailable - see console for details"],
    };
  }
};

export const parseRawLog = async (rawText: string): Promise<ForensicLog[]> => {
  const lines = rawText.split("\n").filter((line) => line.trim().length > 0);
  const maxLines = 100;
  const limitedLines = lines.slice(0, maxLines).join("\n");

  const prompt = `Parse these ${Math.min(
    lines.length,
    maxLines
  )} log entries into JSON. Extract key info.

${limitedLines}

Return JSON array:
[{"id":"1","timestamp":"ISO","source":"app","event":"what happened","user":"who","ipAddress":"IP","severity":"INFO|WARNING|CRITICAL|ANOMALY","hash":"hex64"}]`;

  const systemPrompt = "JSON array only. No text.";

  try {
    const response = await callOpenRouter(prompt, systemPrompt, PARSING_MODEL);
    const cleanedResponse = cleanJsonResponse(response);
    const parsed = JSON.parse(cleanedResponse);

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    // Ensure each log has required fields with defaults
    return parsed.map((log: any, idx: number) => ({
      id: log.id || `log-${idx + 1}`,
      timestamp: log.timestamp || new Date().toISOString(),
      source: log.source || "System",
      event:
        log.event ||
        log.message ||
        limitedLines.split("\n")[idx]?.substring(0, 200) ||
        "Unknown event",
      user: log.user || "unknown",
      ipAddress: log.ipAddress || "N/A",
      severity: log.severity || LogSeverity.INFO,
      raw: log.raw || limitedLines.split("\n")[idx] || "",
      hash: log.hash || generateSimpleHash(log.event || ""),
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
  const lines = rawText.split("\n").filter((line) => line.trim().length > 0);
  const logs: ForensicLog[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract timestamp (various formats)
    const timestampMatch = line.match(
      /(\d{4}[-/]\d{2}[-/]\d{2}[T ]?\d{2}:\d{2}:\d{2})|(\d{2}[-/]\d{2}[-/]\d{4}\s+\d{1,2}:\d{2}:\d{2})/
    );
    const timestamp = timestampMatch
      ? new Date(timestampMatch[0]).toISOString()
      : new Date().toISOString();

    // Extract severity
    let severity: LogSeverity = LogSeverity.INFO;
    if (/\b(critical|breach|attack|malware)\b/i.test(line))
      severity = LogSeverity.CRITICAL;
    else if (/\b(anomal|suspicious|unusual)\b/i.test(line))
      severity = LogSeverity.ANOMALY;
    else if (/\b(warning|failed|error|denied)\b/i.test(line))
      severity = LogSeverity.WARNING;

    // Extract user
    const userMatch =
      line.match(/\buser[:\s]+([a-zA-Z0-9._-]+)/i) ||
      line.match(/\b(admin|root|system|user\d+)\b/i);
    const user = userMatch ? userMatch[1] : "unknown";

    // Extract IP address
    const ipMatch = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    const ipAddress = ipMatch ? ipMatch[0] : "N/A";

    // Extract source
    const sourceMatch =
      line.match(/\bsource[:\s]+([a-zA-Z0-9._-]+)/i) ||
      line.match(/\[([\w-]+)\]/);
    const source = sourceMatch ? sourceMatch[1] : "System";

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
      hash,
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
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(16, "0");
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
    const response = await callOpenRouter(prompt, systemPrompt);
    return response || "No analysis could be performed.";
  } catch (error) {
    console.error("Error in natural language query:", error);
    return `Unable to process query. ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
  }
};
