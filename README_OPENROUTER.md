# Sentinel Forensic AI: OpenRouter Edition

**Sentinel Forensic AI** is a professional-grade Digital Forensics and Incident Response (DFIR) dashboard. It uses AI to analyze massive log files and identify security threats.

## 🏆 Key Features

1.  **AI-Powered Log Analysis**: 
    - Fast ingestion and structured parsing of massive raw log files
    - Deep reasoning to correlate multiple log entries and find hidden attack patterns
2.  **Chain of Custody Simulation**: Every log entry is hashed on ingestion, simulating a cryptographically secure audit trail
3.  **Explainable AI**: Clear reasoning and logic behind threat assessments
4.  **Dynamic Evidence Timeline**: Visual reconstruction of attack patterns

## 🛠 Tech Stack

- **AI Provider**: **OpenRouter** (fast cloud AI with free tier)
- **Core Engine**: React 19 + TypeScript
- **Data viz**: Recharts
- **Styles**: Tailwind CSS

## 🚀 Quick Start

### 1. Get OpenRouter API Key
1. Go to [OpenRouter](https://openrouter.ai/keys)
2. Sign up for free (includes free tier credits)
3. Copy your API key

### 2. Configure Environment
Create a `.env` file in the project root:
```bash
VITE_OPENROUTER_API_KEY=your_api_key_here
```

### 3. Start the Application
```bash
npm install
npm run dev
```

✅ **That's it!** The app will use OpenRouter's fast cloud AI.

## ⚡ Why OpenRouter?

- **Fast**: Cloud-hosted AI responds in seconds
- **Free Tier**: Start with free credits (no credit card required)
- **No Local Setup**: No need to download models or run local servers
- **Multiple Models**: Access to various AI models through one API
- **Reliable**: Enterprise-grade infrastructure

## 🎯 Requirements

- **Node.js**: 18+ 
- **OpenRouter API Key**: Free from [openrouter.ai](https://openrouter.ai/keys)

## 📝 Using the Dashboard

1. **Upload Logs**: Click "Add Evidence" to upload log files
2. **AI Analysis**: Click "Generate AI Threat Assessment" for automatic analysis
3. **Ask Questions**: Use "Sentinel AI Chat" to query your logs in natural language
4. **Review Timeline**: Check the interactive timeline for attack progression

## 🔧 Available Models

Default (free):
- `meta-llama/llama-3.2-3b-instruct:free` - Fast parsing
- `meta-llama/llama-3.1-8b-instruct:free` - Better analysis

To use paid models for better quality, edit `services/openRouterService.ts`:
- `anthropic/claude-3.5-sonnet` - Best quality
- `openai/gpt-4o` - Excellent quality
- `google/gemini-pro-1.5` - Good balance

---
*Built for modern Cyber Defenders - fast, reliable, and easy to use.*
