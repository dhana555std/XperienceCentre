import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

const SUPPORTED_PROVIDERS = ["openai", "anthropic", "gemini", "ollama"];

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createOpenAIModel() {
  return new ChatOpenAI({
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.7,
  });
}

function createAnthropicModel() {
  return new ChatAnthropic({
    apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
    temperature: 0.7,
  });
}

function createGeminiModel() {
  return new ChatGoogleGenerativeAI({
    apiKey: getRequiredEnv("GOOGLE_API_KEY"),
    model: process.env.GOOGLE_MODEL || "gemini-2.5-flash",
    temperature: 0.7,
  });
}

function createOllamaModel() {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    model: process.env.OLLAMA_MODEL || "llama3.1",
    temperature: 0,
  });
}

export function getProvider() {
  return (process.env.LLM_PROVIDER || "gemini").trim().toLowerCase();
}

export function getSupportedProviders() {
  return [...SUPPORTED_PROVIDERS];
}

export function createChatModel() {
  const provider = getProvider();

  switch (provider) {
    case "openai":
      return createOpenAIModel();
    case "anthropic":
      return createAnthropicModel();
    case "gemini":
      return createGeminiModel();
    case "ollama":
      return createOllamaModel();
    default:
      throw new Error(
        `Unsupported LLM_PROVIDER "${provider}". Supported providers: ${SUPPORTED_PROVIDERS.join(", ")}`,
      );
  }
}

export function getActiveModelName() {
  const provider = getProvider();

  switch (provider) {
    case "openai":
      return process.env.OPENAI_MODEL || "gpt-4o-mini";
    case "anthropic":
      return process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
    case "gemini":
      return process.env.GOOGLE_MODEL || "gemini-2.5-flash";
    case "ollama":
      return process.env.OLLAMA_MODEL || "llama3.1";
    default:
      return "unknown";
  }
}
