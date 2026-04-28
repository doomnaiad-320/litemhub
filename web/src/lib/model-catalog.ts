import type { ModelPrice } from "@/types/model";

export interface CatalogPriceSource {
  imagePrices?: Record<string, number>;
  imageQualityPrices?: Record<string, Record<string, number>>;
  price?: ModelPrice;
}

export const CAPABILITY_ORDER = [
  "text",
  "reasoning",
  "vision",
  "tools",
  "json",
  "image",
  "audio",
  "video",
  "coding",
  "embedding",
  "rerank",
] as const;

const DEFAULT_PRICE_UNIT = 1000;
export const DISPLAY_TOKEN_PRICE_UNIT = 1_000_000;
export const DISPLAY_TOKEN_PRICE_UNIT_LABEL = "1M Tokens";

export const inferProvider = (model: string) => {
  const normalized = model.toLowerCase();

  if (
    normalized.startsWith("gpt") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4")
  ) {
    return "OpenAI";
  }
  if (normalized.startsWith("claude")) {
    return "Anthropic";
  }
  if (normalized.startsWith("gemini")) {
    return "Google";
  }
  if (normalized.startsWith("grok")) {
    return "xAI";
  }
  if (normalized.startsWith("qwen")) {
    return "Qwen";
  }
  if (normalized.startsWith("deepseek")) {
    return "DeepSeek";
  }
  if (normalized.startsWith("kimi")) {
    return "Moonshot";
  }
  if (normalized.startsWith("glm")) {
    return "Zhipu";
  }
  if (normalized.startsWith("doubao")) {
    return "Doubao";
  }
  if (normalized.startsWith("llama")) {
    return "Meta";
  }
  if (normalized.startsWith("mistral")) {
    return "Mistral";
  }

  return "Model";
};

export const sortCapabilities = (capabilities: string[]) => {
  return [...capabilities].sort((left, right) => {
    const leftIndex = CAPABILITY_ORDER.indexOf(
      left as (typeof CAPABILITY_ORDER)[number],
    );
    const rightIndex = CAPABILITY_ORDER.indexOf(
      right as (typeof CAPABILITY_ORDER)[number],
    );

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
};

export const inferCapabilities = (model: string) => {
  const normalized = model.toLowerCase();
  const capabilities = new Set<string>();

  const isEmbedding = /(embedding|text-embedding|bge|gte|e5)/.test(normalized);
  const isRerank = /(rerank|reranker)/.test(normalized);
  const isImage =
    /(gpt-image|dall|image|imagen|flux|stable-diffusion|sdxl|sd-)/.test(
      normalized,
    );
  const isAudio = /(audio|speech|tts|whisper|voice|realtime|transcribe)/.test(
    normalized,
  );
  const isVideo = /(video|veo|sora|wanx)/.test(normalized);
  const isVision = /(vision|vl|omni|gpt-4o|gemini|claude|pixtral|llava)/.test(
    normalized,
  );
  const isReasoning =
    /(^o1($|-)|^o3($|-)|^o4($|-)|reason|thinking|r1|sonnet-4|opus-4)/.test(
      normalized,
    );
  const isCoding =
    /(coder|codestral|devstral|codegen|codegemma|qwen.*coder|deepseek-coder)/.test(
      normalized,
    );

  if (isVision) capabilities.add("vision");
  if (isReasoning) capabilities.add("reasoning");
  if (isImage) capabilities.add("image");
  if (isAudio) capabilities.add("audio");
  if (isVideo) capabilities.add("video");
  if (isCoding) capabilities.add("coding");
  if (isEmbedding) capabilities.add("embedding");
  if (isRerank) capabilities.add("rerank");

  if (
    (!isEmbedding && !isRerank && !isImage && !isAudio && !isVideo) ||
    isVision ||
    isReasoning ||
    isCoding
  ) {
    capabilities.add("text");
  }

  return sortCapabilities([...capabilities]);
};

export const formatPriceNumber = (value: number) => {
  const digits = Math.abs(value) >= 1 ? 4 : 6;
  return Number(value.toFixed(digits)).toString();
};

export const formatPriceValue = (price?: number, unit?: number) => {
  if (price == null || price === 0) {
    return null;
  }

  return `${formatPriceNumber(price)} / ${unit || DEFAULT_PRICE_UNIT}`;
};

export const formatTokenPriceValue = (price?: number, unit?: number) => {
  if (price == null || price === 0) {
    return null;
  }

  const effectiveUnit = unit || DEFAULT_PRICE_UNIT;
  const normalizedPrice = (price * DISPLAY_TOKEN_PRICE_UNIT) / effectiveUnit;

  return `${formatPriceNumber(normalizedPrice)} / ${DISPLAY_TOKEN_PRICE_UNIT_LABEL}`;
};

export const buildImagePriceEntries = (
  imagePrices?: Record<string, number>,
  imageQualityPrices?: Record<string, Record<string, number>>,
): Array<{ label: string; value: string }> => {
  const entries: Array<{ label: string; value: string }> = [];

  if (imageQualityPrices) {
    const sizes = Object.keys(imageQualityPrices).sort((left, right) =>
      left.localeCompare(right),
    );
    for (const size of sizes) {
      const qualityPrices = imageQualityPrices[size];
      if (!qualityPrices) {
        continue;
      }

      for (const quality of Object.keys(qualityPrices).sort((left, right) =>
        left.localeCompare(right),
      )) {
        entries.push({
          label: `${size} ${quality}`,
          value: `${formatPriceNumber(qualityPrices[quality])} / img`,
        });
      }
    }
  }

  if (entries.length > 0) {
    return entries;
  }

  if (!imagePrices) {
    return entries;
  }

  for (const size of Object.keys(imagePrices).sort((left, right) =>
    left.localeCompare(right),
  )) {
    const value = imagePrices[size];
    if (value === 0) {
      continue;
    }

    entries.push({
      label: size,
      value: `${formatPriceNumber(value)} / img`,
    });
  }

  return entries;
};

export const hasPriceData = (source?: CatalogPriceSource) => {
  if (!source) {
    return false;
  }

  const price = source.price;
  const hasStructuredPrice =
    !!price &&
    [
      price.input_price,
      price.output_price,
      price.per_request_price,
      price.cached_price,
      price.cache_creation_price,
      price.image_input_price,
      price.image_output_price,
      price.audio_input_price,
      price.thinking_mode_output_price,
      price.web_search_price,
    ].some((value) => value != null && value !== 0);

  return (
    hasStructuredPrice ||
    buildImagePriceEntries(
      source.imagePrices,
      source.imageQualityPrices,
    ).length > 0
  );
};

export const getPublicModelDetailPath = (model: string) =>
  `/models/${model
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
