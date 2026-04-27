import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import type { AgentAction, AgentContext } from "../../core/types/agent";
import { env } from "../../config/env";
import { ZeroGComputeAccountManager } from "./account";

interface OpenAIChatCompletionResponse {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export interface ZeroGComputeInferenceRequest {
  system: string;
  user: string;
  temperature?: number;
  model?: string;
}

const FALLBACK_ACTION: AgentAction = {
  type: "observe",
  direction: "flat",
  confidence: 0,
  rationale: "Inference failed, defaulting to observation."
};

const stripCodeFences = (content: string): string =>
  content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

const clampConfidence = (value: unknown): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numeric));
};

const normalizeAction = (payload: unknown): AgentAction => {
  if (!payload || typeof payload !== "object") {
    return FALLBACK_ACTION;
  }

  const candidate = payload as Partial<AgentAction>;
  const type = candidate.type === "swap" || candidate.type === "hold" || candidate.type === "observe"
    ? candidate.type
    : FALLBACK_ACTION.type;
  const direction =
    candidate.direction === "long" || candidate.direction === "short" || candidate.direction === "flat"
      ? candidate.direction
      : FALLBACK_ACTION.direction;

  return {
    type,
    direction,
    confidence: clampConfidence(candidate.confidence),
    rationale:
      typeof candidate.rationale === "string" && candidate.rationale.trim().length > 0
        ? candidate.rationale.trim()
        : FALLBACK_ACTION.rationale,
    ...(typeof candidate.sizeBps === "number" ? { sizeBps: candidate.sizeBps } : {})
  };
};

const parseActionFromContent = (content: string): AgentAction => {
  try {
    return normalizeAction(JSON.parse(stripCodeFences(content)));
  } catch (error) {
    throw new Error("0G compute returned non-JSON content that could not be parsed into an action.", {
      cause: error
    });
  }
};

const buildPrompt = (context: AgentContext): string =>
  [
    "Return ONLY valid JSON matching this schema:",
    '{"type":"swap|hold|observe","direction":"long|short|flat","confidence":0.0,"rationale":"string","sizeBps":0}',
    "Decide using the task context, market signals, recent memory, and risk threshold below.",
    `Genome ID: ${context.genome.genome_id}`,
    `Risk threshold: ${context.genome.risk_threshold}`,
    `Task: ${JSON.stringify(context.task)}`,
    `Signals: ${JSON.stringify(context.signals)}`,
    `Memory: ${JSON.stringify(context.memory)}`
  ].join("\n");

export class ZeroGComputeAdapter {
  private brokerPromise?: ReturnType<typeof createZGComputeNetworkBroker>;
  private providerAddressPromise?: Promise<string>;
  private readonly accountManager = new ZeroGComputeAccountManager();

  private async getBroker() {
    if (!this.brokerPromise) {
      if (!env.privateKey) {
        throw new Error("Missing PRIVATE_KEY. 0G Compute inference requires a funded wallet private key.");
      }

      const provider = new ethers.JsonRpcProvider(env.RPC_URL);
      const wallet = new ethers.Wallet(env.privateKey, provider);
      this.brokerPromise = createZGComputeNetworkBroker(wallet);
    }

    return this.brokerPromise;
  }

  private async getProviderAddress(): Promise<string> {
    if (!this.providerAddressPromise) {
      this.providerAddressPromise = (async () => {
        if (env.zeroGComputeProviderAddress) {
          return env.zeroGComputeProviderAddress;
        }

        const broker = await this.getBroker();
        const services = await broker.inference.listService();
        const chatbotService = services.find((service) =>
          String(service.serviceType).toLowerCase().includes("chat")
        );

        if (!chatbotService) {
          throw new Error("No chatbot service provider found from 0G Compute listService().");
        }

        return String(chatbotService.provider);
      })();
    }

    return this.providerAddressPromise;
  }

  public async inferRaw(request: ZeroGComputeInferenceRequest): Promise<string> {
    const broker = await this.getBroker();
    const providerAddress = await this.getProviderAddress();

    await this.accountManager.ensureInferenceAccountReady(broker, providerAddress);
    const services = await broker.inference.listService();

    if (services.length === 0) {
      throw new Error("0G Compute returned no services for the current broker/network configuration.");
    }

    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
    const prompt = request.user;
    const headers = await broker.inference.getRequestHeaders(providerAddress, prompt);

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({
        model: request.model || env.zeroGComputeModel || model,
        temperature: request.temperature ?? 0.7,
        messages: [
          {
            role: "system",
            content: request.system
          },
          {
            role: "user",
            content: request.user
          }
        ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `0G Compute request failed with status ${response.status}: ${errorBody || response.statusText}`
      );
    }

    const data = (await response.json()) as OpenAIChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("0G Compute response did not include chat completion content.");
    }

    const chatId =
      response.headers.get("ZG-Res-Key") ||
      response.headers.get("zg-res-key") ||
      data.id;

    if (chatId) {
      try {
        await broker.inference.processResponse(providerAddress, content, chatId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to process response signature: ${message}. Continuing with response content.`);
      }
    }

    return content;
  }

  public async reason(context: AgentContext): Promise<AgentAction> {
    const prompt = buildPrompt(context);
    const content = await this.inferRaw({
      system: context.genome.reasoning_strategy,
      user: prompt,
      temperature: 0.7
    });

    return parseActionFromContent(content);
  }
}
