# LLM REST API

A small Node.js REST API built with Express and LangChain. You can switch between OpenAI, Anthropic, Google Gemini, and Ollama by changing environment variables only.

## Setup

```bash
npm install
npm start
```

The server reads configuration from `.env`.

## Environment variables

- `LLM_PROVIDER`: `gemini`, `openai`, `anthropic`, or `ollama`
- `SYSTEM_PROMPT`: Optional system instruction applied to every request
- `PORT`: Port for the API

Provider-specific variables:

- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`
- Anthropic: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- Gemini: `GOOGLE_API_KEY`, `GOOGLE_MODEL`
- Ollama: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`

## Endpoints

### `GET /health`

Returns the active provider and model.

### `POST /api/generate`

Request body:

```json
{
  "text": "Explain what LangChain does."
}
```

Success response:

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "response": "LangChain is a framework..."
}
```

Validation errors return `400`. Successful generations return `200`.

## Switching providers

Set `LLM_PROVIDER` in `.env` and update the matching credentials:

```env
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL=gemini-2.5-flash
```
