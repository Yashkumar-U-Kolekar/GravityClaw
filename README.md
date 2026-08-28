# 🦞 Gravity Claw

> **A lean, secure, local-first personal AI agent built from scratch.**  
> Inspired by OpenClaw, redesigned with security-by-default, Telegram long-polling, and OpenRouter multi-model tool calling.

---

## 🔒 Security Principles (Non-Negotiable)

1. **User ID Whitelist**: Only authorized Telegram user IDs can interact. All unauthorized incoming updates are silently dropped without response.
2. **No Web Server / No Open Ports**: Operates strictly via Telegram long-polling (`bot.start()`). No ports are exposed to the local network or internet.
3. **Zero Secrets in Code or Logs**: All credentials are kept in `.env` and never logged or exposed.
4. **Agentic Safety**: Max iteration limit prevents runaway tool loops.
5. **Local-First & Auditable**: Every line of code is modular, transparent, and runs on your machine.

---

## 📁 Project Structure

```
.
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules (secrets, dist, node_modules)
├── package.json              # ES module configuration & dependencies
├── tsconfig.json             # Strict TypeScript configuration
├── README.md                 # Documentation
└── src/
    ├── index.ts              # Application bootstrap & graceful shutdown
    ├── config/
    │   └── env.ts            # Zod-validated environment loader
    ├── bot/
    │   ├── telegram.ts       # grammY bot setup & lifecycle
    │   ├── middleware/
    │   │   └── auth.ts       # Telegram user ID whitelist security
    │   └── handlers/
    │       └── message.ts    # User message & typing indicator handler
    ├── agent/
    │   ├── agent.ts          # Multi-step OpenRouter agentic loop runner
    │   ├── prompts.ts        # System prompt & persona
    │   └── types.ts          # Agent interfaces
    ├── tools/
    │   ├── types.ts          # Tool interfaces & OpenAI schema converters
    │   ├── registry.ts       # Tool registration & safe execution
    │   └── builtins/
    │       └── getCurrentTime.ts # Level 1 built-in tool
    └── utils/
        └── logger.ts         # Timestamped logger with log levels
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Telegram Bot Token**: Get one from [@BotFather](https://t.me/BotFather) on Telegram
- **Telegram User ID**: Find your numeric user ID by messaging [@userinfobot](https://t.me/userinfobot) or [@raw_data_bot](https://t.me/raw_data_bot)
- **OpenRouter API Key**: Obtain from [OpenRouter](https://openrouter.ai/keys)

### 2. Installation

```bash
npm install
```

### 3. Configuration

Configure your credentials in `.env`:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_ALLOWED_USER_IDS=your_user_id_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
MAX_AGENT_ITERATIONS=10
LOG_LEVEL=info
```

Supported `OPENROUTER_MODEL` values include:
- `anthropic/claude-3.5-sonnet` (Default)
- `anthropic/claude-3.7-sonnet`
- `openai/gpt-4o`
- `deepseek/deepseek-chat`
- `meta-llama/llama-3.3-70b-instruct`
- Any model supported by OpenRouter!

### 4. Running Gravity Claw

```bash
# Start development server with live reload
npm run dev

# Check TypeScript types
npm run typecheck

# Build for production
npm run build

# Run production build
npm run start
```

---

## 🗺️ Build Roadmap

- [x] **Level 1 — Foundation**
  - Telegram bot + OpenRouter LLM + Autonomous agentic loop
  - Whitelist security & Long-polling
  - Built-in tool: `get_current_time`
- [x] **Level 2 — Memory**
  - Persistent SQLite storage + FTS5 full-text search
  - Episodic & semantic memory tools
- [ ] **Level 3 — Voice** (Skipped for now)
- [x] **Level 4 — Tools & MCP Bridge** *(Current)*
  - Tools + MCP bridge (shell, files, external services)
  - Auditable file & shell operations with confirmation safeguards
  - Whisper transcription for Telegram voice notes
  - ElevenLabs text-to-speech audio responses
- [ ] **Level 5 — Heartbeat**
  - Proactive briefings and check-ins (cron/interval based)
  - Memory summarization passes

---

## 🛡️ License

MIT
