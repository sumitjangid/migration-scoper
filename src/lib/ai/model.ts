import { gateway, type LanguageModel } from "ai";

export type ResolvedAIModel = {
  modelId: string;
  model: LanguageModel;
};

export type AIModelResolution =
  | { enabled: false; reason: string }
  | { enabled: true; modelId: string; model: LanguageModel };

type AIEnvironment = {
  AI_ENABLED?: string;
  AI_MODEL?: string;
  AI_GATEWAY_API_KEY?: string;
  VERCEL_OIDC_TOKEN?: string;
};

export function resolveAIModel(env: AIEnvironment = {
  AI_ENABLED: process.env.AI_ENABLED,
  AI_MODEL: process.env.AI_MODEL,
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
}): AIModelResolution {
  if (env.AI_ENABLED !== "true") {
    return { enabled: false, reason: "AI is disabled." };
  }

  const modelId = env.AI_MODEL?.trim();
  if (!modelId) {
    return { enabled: false, reason: "AI_MODEL is missing." };
  }
  if (!modelId.includes("/")) {
    return { enabled: false, reason: "AI_MODEL must use provider/model format." };
  }
  if (!env.AI_GATEWAY_API_KEY?.trim() && !env.VERCEL_OIDC_TOKEN?.trim()) {
    return { enabled: false, reason: "No AI Gateway credentials are configured." };
  }

  return {
    enabled: true,
    modelId,
    model: gateway(modelId),
  };
}
