import dotenv from "dotenv";
import express from "express";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  createChatModel,
  getActiveModelName,
  getProvider,
  getSupportedProviders
} from "./llm.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const systemPrompt = process.env.SYSTEM_PROMPT || "You are a helpful AI assistant.";

app.use(express.json());

app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    provider: getProvider(),
    model: getActiveModelName(),
    supportedProviders: getSupportedProviders()
  });
});

app.post("/api/generate", async (request, response) => {
  const { text } = request.body ?? {};

  if (text === null || text === undefined) {
    return response.status(400).json({
      message: 'The "text" field is required and cannot be null.'
    });
  }

  if (typeof text !== "string") {
    return response.status(400).json({
      message: 'The "text" field must be a string.'
    });
  }

  if (!text.trim()) {
    return response.status(400).json({
      message: 'The "text" field cannot be empty.'
    });
  }

  try {
    const model = createChatModel();
    const result = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(text)
    ]);

    return response.status(200).json({
      provider: getProvider(),
      model: getActiveModelName(),
      response: result.content
    });
  } catch (error) {
    return response.status(500).json({
      message: "Failed to generate a response from the configured LLM.",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json({
      message: "Invalid JSON payload."
    });
  }

  return response.status(500).json({
    message: "Internal server error."
  });
});

app.listen(port, () => {
  console.log(
    `LLM REST API listening on port ${port} using provider "${getProvider()}" and model "${getActiveModelName()}".`
  );
});
