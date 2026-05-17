import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  Circle,
  Code2,
  Copy,
  Filter,
  Globe2,
  Info,
  MessageSquare,
  Send,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PublicSiteHeader } from "@/components/common/PublicSiteHeader";
import { usePublicModel } from "@/feature/public-models/hooks";
import {
  useUserPortalGroups,
  useUserPortalPlaygroundChat,
  useUserPortalWallet,
} from "@/feature/user-portal/hooks";
import { useUserPortalAuthStore } from "@/store/user-portal-auth";
import { ROUTES } from "@/routes/constants";
import type { PublicModel } from "@/types/public-model";
import type { UserPortalPlaygroundMessage } from "@/types/user-portal";
import {
  buildImagePriceEntries,
  formatPriceValue,
  formatTokenPriceValue,
  getPublicModelDetailPath,
} from "@/lib/model-catalog";
import { cn } from "@/lib/utils";

interface PriceRow {
  label: string;
  value: string;
}

const uniqueTags = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean)));

const categoryColors = ["#9b5cff", "#2f8cff", "#6668ff", "#00a2ff", "#d8951b"];

const capabilityLabels: Record<string, { en: string; zh: string }> = {
  audio: { en: "Audio", zh: "音频" },
  coding: { en: "Coding", zh: "编程" },
  embedding: { en: "Embedding", zh: "嵌入" },
  image: { en: "Image", zh: "图像" },
  json: { en: "JSON", zh: "JSON" },
  reasoning: { en: "Reasoning", zh: "推理" },
  rerank: { en: "Rerank", zh: "重排" },
  text: { en: "Text", zh: "文本" },
  tools: { en: "Tools", zh: "工具" },
  video: { en: "Video", zh: "视频" },
  vision: { en: "Vision", zh: "视觉" },
};

const getSupportedEndpoints = (model?: PublicModel) => {
  const provider = model?.provider?.toLowerCase() || "";
  const modelName = model?.model?.toLowerCase() || "";

  if (provider.includes("anthropic") || modelName.startsWith("claude")) {
    return ["Anthropic", "OpenAI"];
  }

  if (modelName.includes("gemini")) {
    return ["Gemini", "OpenAI"];
  }

  return ["OpenAI"];
};

const decodeModelPath = (value?: string) => {
  if (!value) {
    return "";
  }

  return value
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
};

const updateMetaTag = (
  selector: string,
  attribute: "content" | "href",
  value: string,
) => {
  const element = document.head.querySelector(selector);
  if (element) {
    element.setAttribute(attribute, value);
  }
};

const ensureMetaLink = (href: string) => {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
};

const ensureJsonLd = (id: string, data: unknown) => {
  let element = document.getElementById(id) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(data);
};

const formatTokenCount = (value?: number) => {
  if (!value) {
    return "-";
  }

  return new Intl.NumberFormat().format(value);
};

const formatCompactTokenCount = (value?: number) => {
  if (!value) {
    return "-";
  }

  if (value >= 1_000_000) {
    return `${Number((value / 1_000_000).toFixed(1))}M`;
  }

  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(0))}K`;
  }

  return String(value);
};

const formatCompactCount = (value?: number) => {
  if (!value) {
    return "-";
  }

  if (value >= 1_000_000) {
    return `${Number((value / 1_000_000).toFixed(1))}M`;
  }

  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(1))}K`;
  }

  return String(value);
};

const formatPercent = (value?: number) => {
  if (value == null) {
    return "-";
  }

  return `${Number(value.toFixed(1))}%`;
};

const buildPriceRows = (
  model: PublicModel | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  if (!model) {
    return [];
  }

  const price = model.price || {};
  const rows: PriceRow[] = [
    {
      label: t("publicModelDetail.pricing.input"),
      value:
        formatTokenPriceValue(price.input_price, price.input_price_unit) || "",
    },
    {
      label: t("publicModelDetail.pricing.output"),
      value:
        formatTokenPriceValue(price.output_price, price.output_price_unit) ||
        "",
    },
    {
      label: t("publicModelDetail.pricing.requestInput"),
      value: formatPriceValue(price.input_request_price, 1) || "",
    },
    {
      label: t("publicModelDetail.pricing.requestOutput"),
      value: formatPriceValue(price.output_request_price, 1) || "",
    },
    {
      label: t("publicModelDetail.pricing.cached"),
      value:
        formatTokenPriceValue(price.cached_price, price.cached_price_unit) ||
        "",
    },
    {
      label: t("publicModelDetail.pricing.cacheCreation"),
      value:
        formatTokenPriceValue(
          price.cache_creation_price,
          price.cache_creation_price_unit,
        ) || "",
    },
    {
      label: t("publicModelDetail.pricing.imageInput"),
      value:
        formatTokenPriceValue(
          price.image_input_price,
          price.image_input_price_unit,
        ) || "",
    },
    {
      label: t("publicModelDetail.pricing.imageOutput"),
      value:
        formatTokenPriceValue(
          price.image_output_price,
          price.image_output_price_unit,
        ) || "",
    },
    {
      label: t("publicModelDetail.pricing.audioInput"),
      value:
        formatTokenPriceValue(
          price.audio_input_price,
          price.audio_input_price_unit,
        ) || "",
    },
    {
      label: t("publicModelDetail.pricing.thinking"),
      value:
        formatTokenPriceValue(
          price.thinking_mode_output_price,
          price.thinking_mode_output_price_unit,
        ) || "",
    },
    {
      label: t("publicModelDetail.pricing.webSearch"),
      value:
        formatTokenPriceValue(
          price.web_search_price,
          price.web_search_price_unit,
        ) || "",
    },
  ].filter((row) => row.value);

  const imageRows = buildImagePriceEntries(
    model.image_prices,
    model.image_quality_prices,
  ).map((entry) => ({
    label: `${t("publicModelDetail.pricing.image")} · ${entry.label}`,
    value: entry.value,
  }));

  return [...rows, ...imageRows];
};

const formatCurrencyTokenPrice = (price?: number, unit?: number) => {
  const value = formatTokenPriceValue(price, unit);
  if (!value) {
    return "-";
  }

  const amount = value.split(" / ")[0];
  return amount.startsWith("$") ? amount : `$${amount}`;
};

const getInputPrice = (model?: PublicModel) =>
  formatCurrencyTokenPrice(
    model?.price?.input_price,
    model?.price?.input_price_unit,
  );

const getOutputPrice = (model?: PublicModel) =>
  formatCurrencyTokenPrice(
    model?.price?.output_price,
    model?.price?.output_price_unit,
  );

const getCachedPrice = (model?: PublicModel) =>
  formatCurrencyTokenPrice(
    model?.price?.cached_price,
    model?.price?.cached_price_unit,
  );

const humanizeModelName = (value: string) => {
  const parts = value.split("/");
  const modelName = parts[parts.length - 1] || value;
  const tokens = modelName.split(/[-_\s]+/).filter(Boolean);
  const words: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const part = tokens[index];
    const lower = part.toLowerCase();
    const next = tokens[index + 1];

    if (lower === "gpt" && next && /^\d/.test(next)) {
      words.push(`GPT-${next}`);
      index += 1;
      continue;
    }

    if (["ai", "api", "gpt", "json", "tts"].includes(lower)) {
      words.push(lower.toUpperCase());
      continue;
    }

    if (/^o\d/.test(lower)) {
      words.push(lower.toUpperCase());
      continue;
    }

    if (/^\d/.test(part)) {
      words.push(part);
      continue;
    }

    words.push(`${part.slice(0, 1).toUpperCase()}${part.slice(1)}`);
  }

  return words.join(" ");
};

const formatModelPath = (model: PublicModel, providerName: string) => {
  if (model.model.includes("/")) {
    return model.model.replace(/\//g, " / ");
  }

  return `${providerName.toLowerCase()} / ${model.model}`;
};

const buildCategoryPills = (
  capabilityTags: string[],
  isChinese: boolean,
): Array<{ color: string; label: string }> => {
  const defaults = isChinese
    ? [
        "学术界 (#4)",
        "金融 (#34)",
        "健康 (#37)",
        "法律 (#17)",
        "市场营销 (#34)",
      ]
    : [
        "Academia (#4)",
        "Finance (#34)",
        "Health (#37)",
        "Legal (#17)",
        "Marketing (#34)",
      ];

  const source =
    capabilityTags.length >= 5 ? capabilityTags.slice(0, 5) : defaults;

  return source.slice(0, 5).map((label, index) => ({
    color: categoryColors[index % categoryColors.length],
    label,
  }));
};

export default function PublicModelDetailPage() {
  const { t: rawT, i18n } = useTranslation();
  const t = rawT as (key: string, options?: Record<string, unknown>) => string;
  const params = useParams();
  const modelId = decodeModelPath(params["*"]);
  const isAuthenticated = useUserPortalAuthStore(
    (state) => state.isAuthenticated,
  );
  const modelQuery = usePublicModel(modelId);
  const model = modelQuery.data;
  const isLoading = modelQuery.isLoading || !modelId;
  const signUpTarget = isAuthenticated
    ? ROUTES.USER_KEYS
    : ROUTES.USER_REGISTER;
  const apiBase = typeof window === "undefined" ? "" : window.location.origin;
  const isChinese = (i18n.resolvedLanguage || i18n.language || "").startsWith(
    "zh",
  );

  const priceRows = useMemo(() => buildPriceRows(model, t), [model, t]);
  const capabilityTags = useMemo(
    () =>
      uniqueTags(model?.capabilities || []).map((capability) => {
        const translated = t(`portal.models.capability.${capability}`);
        if (
          translated &&
          translated !== `portal.models.capability.${capability}`
        ) {
          return translated;
        }
        return (
          capabilityLabels[capability]?.[isChinese ? "zh" : "en"] || capability
        );
      }),
    [model?.capabilities, t, isChinese],
  );
  const supportedEndpoints = useMemo(
    () => getSupportedEndpoints(model),
    [model],
  );
  const accessGroups = useMemo(
    () =>
      uniqueTags([
        ...(model?.available_groups || []),
        ...(model?.available_sets || []),
      ]),
    [model?.available_groups, model?.available_sets],
  );

  const curlExample = useMemo(() => {
    const currentModel = model?.model || modelId || "gpt-4o-mini";

    return `curl ${apiBase}/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${currentModel}",
    "messages": [
      {
        "role": "user",
        "content": "Explain why model routing matters."
      }
    ],
    "stream": true
  }'`;
  }, [apiBase, model?.model, modelId]);

  const javascriptExample = useMemo(() => {
    const currentModel = model?.model || modelId || "gpt-4o-mini";

    return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.LITEMHUB_API_KEY,
  baseURL: "${apiBase}/v1"
});

const response = await client.chat.completions.create({
  model: "${currentModel}",
  messages: [
    { role: "user", content: "Explain why model routing matters." }
  ],
  stream: true
});`;
  }, [apiBase, model?.model, modelId]);

  useEffect(() => {
    const readableName =
      model?.model || modelId || t("publicModelDetail.fallbackModel");
    const title = t("publicModelDetail.seo.title", { model: readableName });
    const description = t("publicModelDetail.seo.description", {
      model: readableName,
      provider: model?.provider || t("publicModelDetail.fallbackProvider"),
    });
    document.title = title;
    updateMetaTag('meta[name="description"]', "content", description);
    updateMetaTag('meta[property="og:title"]', "content", title);
    updateMetaTag('meta[property="og:description"]', "content", description);

    const canonicalPath = model
      ? getPublicModelDetailPath(model.model)
      : `${ROUTES.PUBLIC_MODELS}/${modelId
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/")}`;
    ensureMetaLink(`${window.location.origin}${canonicalPath}`);
  }, [model, modelId, t, i18n.resolvedLanguage]);

  useEffect(() => {
    if (!model) {
      return;
    }

    ensureJsonLd("public-model-detail-jsonld", {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `${model.model} API`,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        model.description ||
        t("publicModelDetail.seo.description", {
          model: model.model,
          provider: model.provider,
        }),
      offers: priceRows.map((row) => ({
        "@type": "Offer",
        name: row.label,
        priceSpecification: row.value,
      })),
      url: `${window.location.origin}${getPublicModelDetailPath(model.model)}`,
      provider: {
        "@type": "Organization",
        name: "LiteMHub",
      },
    });
  }, [model, priceRows, t, i18n.resolvedLanguage]);

  const copyText = async (value: string, successKey: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t(successKey));
    } catch {
      toast.error(t("publicModels.copyFailed"));
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f8fafc] font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] text-[#18181b] transition-colors duration-200 dark:bg-[#0b0b0d] dark:text-[#d7d8dd]">
      <PublicSiteHeader
        activeItem="models"
        className="dark:border-[#24262b] dark:bg-[#0b0b0d]/92"
      />

      <main className="mx-auto w-full max-w-[976px] px-4 pb-20 pt-8 sm:px-6 md:px-0 md:pt-[32px]">
        {isLoading ? (
          <ModelDetailSkeleton />
        ) : modelQuery.isError || !model ? (
          <Alert className="border-red-200 bg-red-50 text-red-950 dark:border-[#352629] dark:bg-[#160f12] dark:text-[#f1d5d8]">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("publicModelDetail.notFoundTitle")}</AlertTitle>
            <AlertDescription>
              {t("publicModelDetail.notFoundDescription", {
                model: modelId || "-",
              })}
            </AlertDescription>
          </Alert>
        ) : (
          <ModelDetailContent
            accessGroups={accessGroups}
            capabilityTags={capabilityTags}
            copyText={copyText}
            curlExample={curlExample}
            isChinese={isChinese}
            javascriptExample={javascriptExample}
            model={model}
            priceRows={priceRows}
            signUpTarget={signUpTarget}
            supportedEndpoints={supportedEndpoints}
            t={t}
          />
        )}
      </main>
    </div>
  );
}

function ModelDetailContent({
  accessGroups,
  capabilityTags,
  copyText,
  curlExample,
  isChinese,
  javascriptExample,
  model,
  priceRows,
  signUpTarget,
  supportedEndpoints,
  t,
}: {
  accessGroups: string[];
  capabilityTags: string[];
  copyText: (value: string, successKey: string) => Promise<void>;
  curlExample: string;
  isChinese: boolean;
  javascriptExample: string;
  model: PublicModel;
  priceRows: PriceRow[];
  signUpTarget: string;
  supportedEndpoints: string[];
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const providerName =
    model.provider || t("publicModelDetail.fallbackProvider");
  const displayModel = humanizeModelName(model.model);
  const modelPath = formatModelPath(model, providerName);
  const categoryPills = buildCategoryPills(capabilityTags, isChinese);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const tabLabels = isChinese
    ? [
        ["overview", "概述"],
        ["playground", "操场"],
        ["providers", "提供者"],
        ["performance", "表现"],
        ["pricing", "定价"],
        ["benchmarks", "基准"],
        ["apps", "应用"],
        ["activity", "活动"],
        ["uptime", "正常运行时间"],
        ["api", "API"],
      ]
    : [
        ["overview", "Overview"],
        ["playground", "Playground"],
        ["providers", "Providers"],
        ["performance", "Performance"],
        ["pricing", "Pricing"],
        ["benchmarks", "Benchmarks"],
        ["apps", "Apps"],
        ["activity", "Activity"],
        ["uptime", "Uptime"],
        ["api", "API"],
      ];

  const metaItems = isChinese
    ? [
        "发布日期：2026年3月17日",
        "知识截止日期：2025年8月31日",
        `${formatTokenCount(model.context_length)}个上下文`,
        `${getInputPrice(model)} /百万输入令牌`,
        `${getOutputPrice(model)} /百万个输出代币`,
      ]
    : [
        "Release date: Mar 17, 2026",
        "Knowledge cutoff: Aug 31, 2025",
        `${formatTokenCount(model.context_length)} context`,
        `${getInputPrice(model)} / 1M input tokens`,
        `${getOutputPrice(model)} / 1M output tokens`,
      ];

  return (
    <Tabs defaultValue="overview" className="w-full">
      <section className="relative">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-[1.25] tracking-[-0.012em] text-[#18181b] dark:text-[#e2e3e8]">
              {providerName}: {displayModel}
            </h1>

            <div className="mt-[11px] flex min-w-0 items-center gap-2 text-[14px] font-medium leading-none text-[#6b7280] dark:text-[#6f7480]">
              <span className="truncate">{modelPath}</span>
              <button
                type="button"
                className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border border-[#d8dce3] bg-white text-[#6b7280] transition hover:border-[#b8c0cc] hover:text-[#18181b] active:scale-[0.98] dark:border-[#2a2c31] dark:bg-[#141519] dark:text-[#818691] dark:hover:border-[#3a3d44] dark:hover:text-[#b8bcc7]"
                aria-label={t("publicModelDetail.copyModel")}
                onClick={() => copyText(model.model, "publicModels.copied")}
              >
                <Copy className="h-[11px] w-[11px]" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-[9px] sm:pt-0">
            <Button
              asChild
              className="h-[32px] w-[105px] rounded-[5px] bg-[#1456f0] px-0 text-[14px] font-semibold text-white shadow-none transition hover:bg-[#0f49d4] active:scale-[0.98] dark:bg-[#5c5ce8] dark:hover:bg-[#6464f1]"
            >
              <Link to={signUpTarget}>
                {isChinese ? "聊天" : "Chat"}
                <MessageSquare
                  className="h-[12px] w-[12px]"
                  strokeWidth={2.2}
                />
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-[32px] w-[96px] rounded-[5px] border-[#d8dce3] bg-white px-0 text-[14px] font-semibold text-[#45515e] shadow-none transition hover:border-[#b8c0cc] hover:bg-[#f1f5f9] hover:text-[#18181b] active:scale-[0.98] dark:border-[#24262c] dark:bg-transparent dark:text-[#9ca3b2] dark:hover:border-[#343742] dark:hover:bg-[#111217] dark:hover:text-[#c8cad3]"
              onClick={() => copyText(model.model, "publicModels.copied")}
            >
              {isChinese ? "比较" : "Compare"}
              <Scale className="h-[12px] w-[12px]" strokeWidth={2.1} />
            </Button>
          </div>
        </div>

        <div className="mt-[13px] flex flex-wrap items-center gap-x-[7px] gap-y-1 text-[14px] font-medium leading-[1.45] text-[#6b7280] dark:text-[#656a75]">
          {metaItems.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="inline-flex items-center gap-[7px]"
            >
              {index > 0 && (
                <span className="text-[#c8cdd6] dark:text-[#333640]">|</span>
              )}
              <span>{item}</span>
            </span>
          ))}
        </div>

        <div className="mt-[18px] flex flex-wrap items-center gap-[7px]">
          {categoryPills.map((pill) => (
            <CategoryPill key={pill.label} color={pill.color}>
              {pill.label}
            </CategoryPill>
          ))}
          <MoreCategoryPill isChinese={isChinese} />
        </div>

        <button
          type="button"
          className={cn(
            "group relative mt-[18px] w-full overflow-hidden pr-8 text-left text-[14px] font-medium leading-[1.55] text-[#5f6b7a] transition active:scale-[0.998] dark:text-[#6f7480]",
            isDescriptionExpanded ? "max-h-none" : "max-h-[44px]",
          )}
          aria-expanded={isDescriptionExpanded}
          onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
        >
          <p>{model.description || t("publicModels.defaultDescription")}</p>
          {!isDescriptionExpanded && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#f8fafc] to-transparent dark:from-[#0b0b0d]" />
          )}
          <ChevronDown
            className={cn(
              "absolute right-[3px] top-[3px] h-[14px] w-[14px] text-[#7b8492] transition-transform dark:text-[#686d78]",
              isDescriptionExpanded && "rotate-180",
            )}
            strokeWidth={1.8}
          />
        </button>
      </section>

      <div className="mt-[64px] border-b border-[#d8dce3] dark:border-[#24262b]">
        <TabsList className="h-[45px] w-full justify-start gap-[21px] overflow-x-auto rounded-none bg-transparent p-0 text-[#6b7280] dark:text-[#7d828e]">
          {tabLabels.map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-[45px] rounded-none border-b border-transparent px-0 pb-[10px] pt-[13px] text-[14px] font-semibold leading-none text-[#6b7280] shadow-none transition data-[state=active]:border-[#18181b] data-[state=active]:bg-transparent data-[state=active]:text-[#18181b] data-[state=active]:shadow-none dark:text-[#777c87] dark:data-[state=active]:border-[#9a9ca5] dark:data-[state=active]:text-[#dfe1e7]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview" className="mt-[38px] focus-visible:ring-0">
        <ProviderOverviewSection
          accessGroups={accessGroups}
          isChinese={isChinese}
          model={model}
          supportedEndpoints={supportedEndpoints}
        />
      </TabsContent>

      <TabsContent value="playground" className="mt-[38px] focus-visible:ring-0">
        <PlaygroundPanel
          isChinese={isChinese}
          model={model}
          signUpTarget={signUpTarget}
        />
      </TabsContent>

      <TabsContent value="providers" className="mt-[38px] focus-visible:ring-0">
        <ProviderOverviewSection
          accessGroups={accessGroups}
          isChinese={isChinese}
          model={model}
          supportedEndpoints={supportedEndpoints}
        />
      </TabsContent>

      <TabsContent value="pricing" className="mt-[38px] focus-visible:ring-0">
        <PricingPanel isChinese={isChinese} priceRows={priceRows} />
      </TabsContent>

      <TabsContent value="api" className="mt-[38px] focus-visible:ring-0">
        <ApiPanel
          copyText={copyText}
          curlExample={curlExample}
          isChinese={isChinese}
          javascriptExample={javascriptExample}
          t={t}
        />
      </TabsContent>

      {["performance", "benchmarks", "apps", "activity", "uptime"].map((value) => (
        <TabsContent
          key={value}
          value={value}
          className="mt-[38px] focus-visible:ring-0"
        >
          <EmptyTabPanel isChinese={isChinese} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ProviderOverviewSection({
  accessGroups,
  isChinese,
  model,
  supportedEndpoints,
}: {
  accessGroups: string[];
  isChinese: boolean;
  model: PublicModel;
  supportedEndpoints: string[];
}) {
  return (
    <section>
      <h2 className="text-[24px] font-semibold leading-[1.35] tracking-[-0.01em] text-[#18181b] dark:text-[#e4e5eb]">
        {displayModelTitle(model, isChinese)}
      </h2>
      <p className="mt-[5px] text-[14px] font-medium leading-[1.6] text-[#5f6b7a] dark:text-[#737985]">
        {isChinese ? (
          <>
            OpenRouter将
            <span className="text-[#1456f0] dark:text-[#5c5ce8]">请求路由</span>
            到能够处理您的提示大小和参数的最佳提供商，并设置回退机制以最大限度地延长
            <span className="text-[#1456f0] dark:text-[#5c5ce8]">
              正常运行时间
            </span>
            。
          </>
        ) : (
          <>
            OpenRouter routes requests to the best provider for your prompt size
            and parameters, with fallbacks to maximize uptime.
          </>
        )}
        <Info className="ml-2 inline h-[12px] w-[12px] translate-y-[1px] text-[#7b8492] dark:text-[#6e7480]" />
      </p>

      <div className="mt-[18px] flex items-center gap-[10px]">
        <Filter
          className="h-[13px] w-[13px] text-[#7b8492] dark:text-[#6a707b]"
          strokeWidth={1.8}
        />
        <button
          type="button"
          className="inline-flex h-[30px] w-[132px] items-center justify-between rounded-full border border-[#d8dce3] bg-white px-[11px] text-[14px] font-medium text-[#5f6b7a] transition hover:border-[#b8c0cc] hover:text-[#18181b] active:scale-[0.98] dark:border-[#24262b] dark:bg-[#0f1013] dark:text-[#747985] dark:hover:border-[#343741] dark:hover:text-[#aeb3bf]"
        >
          <span>{isChinese ? "排序方式" : "Sort by"}</span>
          <ChevronDown className="h-[12px] w-[12px]" strokeWidth={1.8} />
        </button>
      </div>

      <ProviderResultsCard
        accessGroups={accessGroups}
        isChinese={isChinese}
        model={model}
        supportedEndpoints={supportedEndpoints}
      />
    </section>
  );
}

function displayModelTitle(model: PublicModel, isChinese: boolean) {
  const displayModel = humanizeModelName(model.model);
  return isChinese ? `${displayModel} 的提供商` : `${displayModel} providers`;
}

function formatWalletAmount(value?: number) {
  return `$${(value || 0).toFixed(4)}`;
}

function formatGroupMultiplier(value?: number, fallback = 1) {
  const multiplier =
    typeof value === "number" && !Number.isNaN(value) ? value : fallback;

  if (multiplier < 0) {
    return "";
  }

  return `x${multiplier.toFixed(2)}`;
}

function getPlaygroundErrorMessage(error: unknown, isChinese: boolean) {
  if (error instanceof Error) {
    if (error.message === "wallet balance not enough") {
      return isChinese ? "余额不足，请先充值后再试。" : "Wallet balance is not enough.";
    }

    return error.message;
  }

  return isChinese ? "请求失败，请稍后再试。" : "Request failed. Please try again.";
}

function isPlaygroundIntroMessage(message: UserPortalPlaygroundMessage, modelName: string) {
  return (
    message.role === "assistant" &&
    (message.content === `当前模型：${modelName}。` ||
      message.content === `Current model: ${modelName}.`)
  );
}

function PlaygroundPanel({
  isChinese,
  model,
  signUpTarget,
}: {
  isChinese: boolean;
  model: PublicModel;
  signUpTarget: string;
}) {
  const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated);
  const [input, setInput] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(model.available_groups?.[0] || "");
  const introMessage = useMemo<UserPortalPlaygroundMessage>(
    () => ({
      role: "assistant",
      content: isChinese ? `当前模型：${model.model}。` : `Current model: ${model.model}.`,
    }),
    [isChinese, model.model],
  );
  const [messages, setMessages] = useState<UserPortalPlaygroundMessage[]>([introMessage]);
  const walletQuery = useUserPortalWallet(isAuthenticated);
  const groupsQuery = useUserPortalGroups(isAuthenticated);
  const chatMutation = useUserPortalPlaygroundChat();

  const modelGroups = useMemo(
    () =>
      (groupsQuery.data?.groups || []).filter((group) =>
        group.models.some((groupModel) => groupModel.toLowerCase() === model.model.toLowerCase()),
      ),
    [groupsQuery.data?.groups, model.model],
  );
  const visibleGroups = useMemo(
    () => (modelGroups.length ? modelGroups.map((group) => group.group) : model.available_groups || []),
    [model.available_groups, modelGroups],
  );
  const activeGroup = selectedGroup || visibleGroups[0] || "";
  const wallet = walletQuery.data?.wallet;
  const canSend =
    isAuthenticated &&
    input.trim().length > 0 &&
    !chatMutation.isPending &&
    (visibleGroups.length > 0 || model.available_groups?.length === 0);

  useEffect(() => {
    const nextGroup = visibleGroups[0] || "";
    setSelectedGroup((current) => {
      if (!current || (visibleGroups.length > 0 && !visibleGroups.includes(current))) {
        return nextGroup;
      }

      return current;
    });
  }, [visibleGroups]);

  useEffect(() => {
    setMessages([introMessage]);
    setInput("");
  }, [introMessage]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !isAuthenticated) {
      return;
    }

    const nextMessages: UserPortalPlaygroundMessage[] = [
      ...messages.filter((message) => message.role !== "assistant" || message.content.trim()),
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setInput("");

    try {
      const response = await chatMutation.mutateAsync({
        group: activeGroup || undefined,
        max_tokens: 1024,
        messages: nextMessages.filter(
          (message) => !isPlaygroundIntroMessage(message, model.model),
        ),
        model: model.model,
        temperature: 0.7,
      });
      const assistantContent =
        response.choices?.[0]?.message?.content ||
        (isChinese ? "模型没有返回内容。" : "The model returned no content.");
      setMessages((current) => [...current, { role: "assistant", content: assistantContent }]);
    } catch (error) {
      const errorMessage = getPlaygroundErrorMessage(error, isChinese);
      setMessages((current) => [...current, { role: "assistant", content: errorMessage }]);
      toast.error(errorMessage);
    }
  };

  return (
    <section className="overflow-hidden rounded-[4px] border border-[#d8dce3] bg-white shadow-[rgba(15,23,42,0.04)_0px_8px_24px] dark:border-[#292b31] dark:bg-[#0d0e11] dark:shadow-none">
      <div className="grid min-h-[520px] lg:grid-cols-[minmax(0,1fr)_246px]">
        <div className="flex min-h-[520px] flex-col border-b border-[#e6e9ef] dark:border-[#24262b] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-[#e6e9ef] px-4 py-3 dark:border-[#24262b]">
            <div className="min-w-0">
              <h2 className="truncate text-[24px] font-semibold leading-[1.25] text-[#18181b] dark:text-[#e4e5eb]">
                {isChinese ? "模型操练场" : "Model Playground"}
              </h2>
              <p className="mt-1 truncate text-[14px] font-medium text-[#6b7280] dark:text-[#737985]">
                {model.model}
              </p>
            </div>
            <span className="ml-3 inline-flex h-[24px] shrink-0 items-center rounded-full border border-[#d8dce3] px-2 text-[14px] font-semibold text-[#5f6b7a] dark:border-[#292b31] dark:text-[#818792]">
              {isChinese ? "扣余额" : "Wallet"}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!isAuthenticated ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                <MessageSquare className="h-5 w-5 text-[#7b8492] dark:text-[#686e7a]" strokeWidth={1.8} />
                <div className="mt-3 text-[24px] font-semibold text-[#18181b] dark:text-[#d3d5dc]">
                  {isChinese ? "登录后开始对话" : "Sign in to chat"}
                </div>
                <p className="mt-2 max-w-[360px] text-[14px] leading-[1.6] text-[#5f6b7a] dark:text-[#707682]">
                  {isChinese
                    ? "操练场会使用你的账户余额结算本次模型调用。"
                    : "Playground calls are charged against your wallet balance."}
                </p>
                <Button
                  asChild
                  className="mt-5 h-[32px] rounded-[5px] bg-[#1456f0] px-4 text-[14px] font-semibold text-white shadow-none hover:bg-[#0f49d4] active:scale-[0.98] dark:bg-[#5c5ce8] dark:hover:bg-[#6464f1]"
                >
                  <Link to={signUpTarget}>{isChinese ? "开始使用" : "Get started"}</Link>
                </Button>
              </div>
            ) : (
              messages.map((message, index) => (
                <PlaygroundMessageBubble key={`${message.role}-${index}`} message={message} />
              ))
            )}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="rounded-[7px] border border-[#e6e9ef] bg-[#f8fafc] px-3 py-2 text-[14px] font-medium text-[#6b7280] dark:border-[#24262b] dark:bg-[#111217] dark:text-[#858b96]">
                  {isChinese ? "模型正在生成..." : "Generating..."}
                </div>
              </div>
            )}
          </div>

          {isAuthenticated && (
            <div className="border-t border-[#e6e9ef] p-4 dark:border-[#24262b]">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isChinese ? "输入一条消息..." : "Type a message..."}
                className="min-h-[92px] resize-none rounded-[5px] border-[#d8dce3] bg-white text-[14px] font-medium leading-[1.5] text-[#18181b] shadow-none focus-visible:ring-[#1456f0] dark:border-[#292b31] dark:bg-[#0f1013] dark:text-[#d7d9e0]"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="text-[14px] font-semibold text-[#6b7280] transition hover:text-[#18181b] active:scale-[0.98] dark:text-[#777c87] dark:hover:text-[#dfe1e7]"
                  onClick={() =>
                    setMessages([introMessage])
                  }
                >
                  {isChinese ? "清空上下文" : "Clear context"}
                </button>
                <Button
                  type="button"
                  disabled={!canSend}
                  className="h-[32px] w-[96px] rounded-[5px] bg-[#1456f0] px-0 text-[14px] font-semibold text-white shadow-none transition hover:bg-[#0f49d4] active:scale-[0.98] disabled:opacity-50 dark:bg-[#5c5ce8] dark:hover:bg-[#6464f1]"
                  onClick={sendMessage}
                >
                  {isChinese ? "发送" : "Send"}
                  <Send className="h-[12px] w-[12px]" strokeWidth={2.1} />
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4 bg-[#fbfcfe] p-4 dark:bg-[#0b0c0f]">
          <PlaygroundSideMetric
            label={isChinese ? "可用余额" : "Available"}
            value={walletQuery.isLoading ? "-" : formatWalletAmount(wallet?.available_balance)}
          />
          <PlaygroundSideMetric
            label={isChinese ? "冻结余额" : "Frozen"}
            value={walletQuery.isLoading ? "-" : formatWalletAmount(wallet?.frozen_balance)}
          />
          <div>
            <div className="text-[14px] font-semibold text-[#7b8492] dark:text-[#626773]">
              {isChinese ? "分组" : "Group"}
            </div>
            <select
              value={activeGroup}
              disabled={!isAuthenticated || visibleGroups.length <= 1}
              onChange={(event) => setSelectedGroup(event.target.value)}
              className="mt-2 h-[34px] w-full rounded-[5px] border border-[#d8dce3] bg-white px-2 text-[14px] font-semibold text-[#18181b] outline-none transition focus:border-[#1456f0] disabled:opacity-60 dark:border-[#292b31] dark:bg-[#0f1013] dark:text-[#d7d9e0]"
            >
              {visibleGroups.length ? (
                visibleGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))
              ) : (
                <option value="">{isChinese ? "自动选择" : "Auto select"}</option>
              )}
            </select>
          </div>
          <div className="rounded-[5px] border border-[#e6e9ef] bg-white p-3 dark:border-[#24262b] dark:bg-[#0f1013]">
            <div className="text-[14px] font-semibold text-[#18181b] dark:text-[#d7d9e0]">
              {isChinese ? "本次调用" : "Request"}
            </div>
            <p className="mt-2 text-[14px] font-medium leading-[1.55] text-[#6b7280] dark:text-[#777c87]">
              {isChinese
                ? "调用会经过当前账户钱包预占，并在模型返回后按实际用量结算。"
                : "Calls reserve wallet balance first and settle after the model response returns."}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function PlaygroundMessageBubble({ message }: { message: UserPortalPlaygroundMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] whitespace-pre-wrap rounded-[7px] px-3 py-2 text-[14px] font-medium leading-[1.55]",
          isUser
            ? "bg-[#1456f0] text-white dark:bg-[#5c5ce8]"
            : "border border-[#e6e9ef] bg-[#f8fafc] text-[#4b5563] dark:border-[#24262b] dark:bg-[#111217] dark:text-[#b8bdc8]",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function PlaygroundSideMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[14px] font-semibold text-[#7b8492] dark:text-[#626773]">{label}</div>
      <div className="mt-1 font-mono text-[24px] font-semibold leading-[1.15] text-[#18181b] dark:text-[#d7d9e0]">
        {value}
      </div>
    </div>
  );
}

function ProviderResultsCard({
  accessGroups,
  isChinese,
  model,
  supportedEndpoints,
}: {
  accessGroups: string[];
  isChinese: boolean;
  model: PublicModel;
  supportedEndpoints: string[];
}) {
  const groupRows = model.available_groups?.length
    ? model.available_groups
    : [""];

  return (
    <div className="mt-[17px] overflow-x-auto rounded-[4px] border border-[#d8dce3] bg-white shadow-[rgba(15,23,42,0.04)_0px_8px_24px] dark:border-[#292b31] dark:bg-[#0d0e11] dark:shadow-none">
      <div className="min-w-full divide-y divide-[#e6e9ef] dark:divide-[#24262b]">
        {groupRows.map((groupName, index) => (
          <ProviderResultRow
            accessGroups={accessGroups}
            groupName={groupName}
            isChinese={isChinese}
            key={`${groupName || "empty-group"}-${index}`}
            model={model}
            supportedEndpoints={supportedEndpoints}
          />
        ))}
      </div>
    </div>
  );
}

function ProviderResultRow({
  accessGroups,
  groupName,
  isChinese,
  model,
  supportedEndpoints,
}: {
  accessGroups: string[];
  groupName: string;
  isChinese: boolean;
  model: PublicModel;
  supportedEndpoints: string[];
}) {
  const metricLabels = isChinese
    ? {
        cache: "缓存读取",
        context: "上下文",
        input: "输入价格",
        output: "输出价格",
        maxOutput: "最大输出",
        throughput: "成功率",
        uptime: "健康度",
        latency: "请求数",
      }
    : {
        cache: "Cache read",
        context: "Context",
        input: "Input price",
        output: "Output price",
        maxOutput: "Max output",
        throughput: "Success",
        uptime: "Health",
        latency: "Requests",
  };
  const unit = isChinese ? "/M 代币" : "/M tokens";
  const displayGroupName = groupName ? `${groupName} 分组` : "";
  const multiplierLabel = formatGroupMultiplier(
    model.available_group_multipliers?.[groupName],
  );
  const health = groupName ? model.group_health?.[groupName] : model.health;
  const healthPercent = health?.health_percent;
  const successRatePercent =
    health?.success_rate == null ? undefined : health.success_rate * 100;

  return (
    <article className="min-h-[138px] w-full min-w-0 px-[12px] pb-[14px] pt-[14px]">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-h-[35px] min-w-0 flex-1 items-center gap-[10px]">
          <button
            type="button"
            className="block min-w-0 max-w-[260px] truncate text-left text-[14px] font-semibold leading-none text-[#4b5563] underline decoration-[#9aa3b2] underline-offset-[2px] transition hover:text-[#18181b] dark:text-[#858b97] dark:decoration-[#686d77] dark:hover:text-[#c9ccd5]"
          >
            {displayGroupName}
          </button>
          <span className="inline-flex h-[26px] shrink-0 items-center rounded-full border border-[#1456f0]/25 bg-[#1456f0]/10 px-[9px] font-mono text-[14px] font-semibold leading-none text-[#1456f0] shadow-[rgba(20,86,240,0.12)_0px_4px_12px] dark:border-[#5c5ce8]/35 dark:bg-[#5c5ce8]/16 dark:text-[#aeb2ff] dark:shadow-none">
            {isChinese ? "倍率" : "Rate"} {multiplierLabel}
          </span>
        </div>

        <div className="mr-4 grid w-[238px] grid-cols-[68px_84px_74px] items-center gap-2 whitespace-nowrap text-right">
          <ProviderTopMetric
            label={metricLabels.latency}
            value={formatCompactCount(health?.request_count)}
          />
          <ProviderTopMetric
            label={metricLabels.throughput}
            value={formatPercent(successRatePercent)}
          />
          <div className="flex min-h-[35px] flex-col justify-center">
            <div className="text-[14px] font-semibold leading-none text-[#7b8492] dark:text-[#5e6370]">
              {metricLabels.uptime}
            </div>
            <HealthBars score={healthPercent} />
          </div>
        </div>
      </div>

      <div className="mt-[11px] grid grid-cols-5 border-t border-[#e6e9ef] pt-[13px] dark:border-[#24262b]">
        <ProviderBottomMetric
          label={metricLabels.context}
          subValue={isChinese ? undefined : "tokens"}
          value={formatCompactTokenCount(model.context_length)}
        />
        <ProviderBottomMetric
          label={metricLabels.maxOutput}
          subValue={isChinese ? undefined : "tokens"}
          value={formatCompactTokenCount(model.max_output_tokens)}
        />
        <ProviderBottomMetric
          label={metricLabels.input}
          subValue={unit}
          value={getInputPrice(model)}
        />
        <ProviderBottomMetric
          label={metricLabels.output}
          subValue={unit}
          value={getOutputPrice(model)}
        />
        <ProviderBottomMetric
          label={metricLabels.cache}
          subValue={unit}
          value={getCachedPrice(model)}
        />
      </div>

      <div className="sr-only">
        {[...supportedEndpoints, ...accessGroups].join(", ")}
      </div>
    </article>
  );
}

function CategoryPill({
  children,
  color,
}: {
  children: ReactNode;
  color: string;
}) {
  return (
    <span className="inline-flex h-[25px] items-center gap-[6px] rounded-full border border-[#d8dce3] bg-white px-[9px] text-[14px] font-semibold leading-none text-[#4b5563] shadow-[rgba(15,23,42,0.04)_0px_2px_8px] dark:border-[#2c2f35] dark:bg-[#101114] dark:text-[#a1a6b2] dark:shadow-none">
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{ backgroundColor: color }}
      />
      {children}
    </span>
  );
}

function MoreCategoryPill({ isChinese }: { isChinese: boolean }) {
  return (
    <span className="inline-flex h-[25px] items-center gap-[7px] rounded-full border border-[#d8dce3] bg-white px-[9px] text-[14px] font-semibold leading-none text-[#4b5563] shadow-[rgba(15,23,42,0.04)_0px_2px_8px] dark:border-[#2c2f35] dark:bg-[#101114] dark:text-[#a1a6b2] dark:shadow-none">
      <span className="flex -space-x-[2px]">
        <span className="h-[7px] w-[7px] rounded-full bg-[#8f5cff] ring-1 ring-white dark:ring-[#101114]" />
        <span className="h-[7px] w-[7px] rounded-full bg-[#09a271] ring-1 ring-white dark:ring-[#101114]" />
        <span className="h-[7px] w-[7px] rounded-full bg-[#00a4ff] ring-1 ring-white dark:ring-[#101114]" />
      </span>
      <span>+ 6</span>
      <span>{isChinese ? "个类别" : "categories"}</span>
    </span>
  );
}

function ProviderTopMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[35px] min-w-0 flex-col justify-center whitespace-nowrap">
      <div className="text-[14px] font-semibold leading-none text-[#7b8492] dark:text-[#5e6370]">
        {label}
      </div>
      <div className="mt-[8px] font-mono text-[14px] font-semibold leading-none text-[#18181b] dark:text-[#c9ccd5]">
        {value}
      </div>
    </div>
  );
}

function HealthBars({ score }: { score?: number }) {
  const normalizedScore = Math.max(0, Math.min(100, score ?? 0));
  const activeBars = normalizedScore > 0 ? Math.ceil(normalizedScore / 20) : 0;

  return (
    <div
      className="mt-[8px] flex justify-end gap-[3px]"
      aria-label={`${normalizedScore}%`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-[14px] w-[4px] rounded-[1px]",
            index < activeBars
              ? "bg-[#24c37a]"
              : "bg-[#d8dce3] dark:bg-[#2a2d34]",
          )}
        />
      ))}
    </div>
  );
}

function ProviderBottomMetric({
  label,
  subValue,
  value,
}: {
  label: string;
  subValue?: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[14px] font-semibold leading-none text-[#7b8492] dark:text-[#565b67]">
        {label}
      </div>
      <div className="mt-[9px] break-words font-mono text-[14px] font-semibold leading-[1.05] text-[#18181b] dark:text-[#c7cad2]">
        {value}
      </div>
      {subValue && (
        <div className="mt-[5px] font-mono text-[14px] font-semibold leading-none text-[#8b95a5] dark:text-[#5d626e]">
          {subValue}
        </div>
      )}
    </div>
  );
}

function PricingPanel({
  isChinese,
  priceRows,
}: {
  isChinese: boolean;
  priceRows: PriceRow[];
}) {
  if (priceRows.length === 0) {
    return <EmptyTabPanel isChinese={isChinese} />;
  }

  return (
    <section className="rounded-[4px] border border-[#d8dce3] bg-white shadow-[rgba(15,23,42,0.04)_0px_8px_24px] dark:border-[#292b31] dark:bg-[#0d0e11] dark:shadow-none">
      <div className="grid grid-cols-[minmax(0,1fr)_180px] border-b border-[#e6e9ef] px-4 py-3 text-[14px] font-semibold uppercase tracking-[0.04em] text-[#7b8492] dark:border-[#24262b] dark:text-[#626773]">
        <span>{isChinese ? "计费项" : "Meter"}</span>
        <span>{isChinese ? "价格" : "Price"}</span>
      </div>
      <div className="divide-y divide-[#e6e9ef] dark:divide-[#24262b]">
        {priceRows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="grid grid-cols-[minmax(0,1fr)_180px] gap-4 px-4 py-3 text-[14px]"
          >
            <span className="text-[#5f6b7a] dark:text-[#8b909c]">
              {row.label}
            </span>
            <span className="break-words font-mono font-semibold text-[#18181b] dark:text-[#d7d9e0]">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ApiPanel({
  copyText,
  curlExample,
  isChinese,
  javascriptExample,
  t,
}: {
  copyText: (value: string, successKey: string) => Promise<void>;
  curlExample: string;
  isChinese: boolean;
  javascriptExample: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <Tabs defaultValue="curl">
      <TabsList className="h-[31px] rounded-[5px] border border-[#d8dce3] bg-white p-[3px] text-[#6b7280] dark:border-[#292b31] dark:bg-[#0f1013] dark:text-[#7d828e]">
        <TabsTrigger
          value="curl"
          className="h-[26px] rounded-[4px] px-3 text-[14px] data-[state=active]:bg-[#eef2f7] data-[state=active]:text-[#18181b] dark:data-[state=active]:bg-[#252832] dark:data-[state=active]:text-[#dfe1e7]"
        >
          cURL
        </TabsTrigger>
        <TabsTrigger
          value="javascript"
          className="h-[26px] rounded-[4px] px-3 text-[14px] data-[state=active]:bg-[#eef2f7] data-[state=active]:text-[#18181b] dark:data-[state=active]:bg-[#252832] dark:data-[state=active]:text-[#dfe1e7]"
        >
          JavaScript
        </TabsTrigger>
      </TabsList>
      <TabsContent value="curl" className="mt-4 focus-visible:ring-0">
        <CodePanel
          code={curlExample}
          copyLabel={t("publicModelDetail.copyExample")}
          onCopy={() =>
            copyText(curlExample, "publicModelDetail.exampleCopied")
          }
        />
      </TabsContent>
      <TabsContent value="javascript" className="mt-4 focus-visible:ring-0">
        <CodePanel
          code={javascriptExample}
          copyLabel={t("publicModelDetail.copyExample")}
          onCopy={() =>
            copyText(javascriptExample, "publicModelDetail.exampleCopied")
          }
        />
      </TabsContent>
      <div className="mt-4 flex flex-wrap gap-2 text-[14px] text-[#5f6b7a] dark:text-[#707682]">
        <ApiBadge icon={<Code2 className="h-[11px] w-[11px]" />}>
          {isChinese ? "OpenAI 兼容" : "OpenAI compatible"}
        </ApiBadge>
        <ApiBadge icon={<Globe2 className="h-[11px] w-[11px]" />}>
          /v1/chat/completions
        </ApiBadge>
      </div>
    </Tabs>
  );
}

function ApiBadge({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <span className="inline-flex h-[24px] items-center gap-1 rounded-full border border-[#d8dce3] bg-white px-2 dark:border-[#292b31] dark:bg-[#0f1013]">
      {icon}
      {children}
    </span>
  );
}

function EmptyTabPanel({ isChinese }: { isChinese: boolean }) {
  return (
    <div className="rounded-[4px] border border-dashed border-[#cbd5e1] bg-white px-4 py-8 text-center dark:border-[#292b31] dark:bg-[#0d0e11]">
      <Activity
        className="mx-auto h-5 w-5 text-[#7b8492] dark:text-[#686e7a]"
        strokeWidth={1.8}
      />
      <div className="mt-3 text-[24px] font-semibold text-[#18181b] dark:text-[#d3d5dc]">
        {isChinese ? "该视图尚未开放" : "This view is not available yet"}
      </div>
      <p className="mx-auto mt-2 max-w-[360px] text-[14px] leading-[1.6] text-[#5f6b7a] dark:text-[#707682]">
        {isChinese
          ? "当前公开 API 暂未返回该标签页所需的细分指标。"
          : "The public API does not return the detailed metrics needed for this tab yet."}
      </p>
    </div>
  );
}

function ModelDetailSkeleton() {
  return (
    <div className="space-y-[18px]">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-[12px]">
          <Skeleton className="h-[24px] w-[230px] rounded-[5px] bg-[#e6e9ef] dark:bg-[#17181d]" />
          <Skeleton className="h-[16px] w-[180px] rounded-[4px] bg-[#e6e9ef] dark:bg-[#17181d]" />
        </div>
        <div className="hidden gap-[9px] sm:flex">
          <Skeleton className="h-[32px] w-[105px] rounded-[5px] bg-[#e6e9ef] dark:bg-[#17181d]" />
          <Skeleton className="h-[32px] w-[96px] rounded-[5px] bg-[#e6e9ef] dark:bg-[#17181d]" />
        </div>
      </div>
      <Skeleton className="h-[14px] w-full rounded-[4px] bg-[#e6e9ef] dark:bg-[#17181d]" />
      <div className="flex gap-[7px]">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[21px] w-[80px] rounded-full bg-[#e6e9ef] dark:bg-[#17181d]"
          />
        ))}
      </div>
      <Skeleton className="h-[41px] w-full rounded-[4px] bg-[#e6e9ef] dark:bg-[#17181d]" />
      <Skeleton className="h-[27px] w-[125px] rounded-full bg-[#e6e9ef] dark:bg-[#17181d]" />
      <div className="pt-[46px]">
        <Skeleton className="h-[45px] w-full rounded-none bg-[#e6e9ef] dark:bg-[#17181d]" />
      </div>
      <div className="pt-[20px]">
        <Skeleton className="h-[384px] w-full rounded-[4px] bg-[#e6e9ef] dark:bg-[#17181d]" />
      </div>
    </div>
  );
}

function CodePanel({
  code,
  copyLabel,
  onCopy,
}: {
  code: string;
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-[#d8dce3] bg-white text-[#18181b] shadow-[rgba(15,23,42,0.04)_0px_8px_24px] dark:border-[#292b31] dark:bg-[#0d0e11] dark:text-[#d7d9e0] dark:shadow-none">
      <div className="flex items-center justify-between border-b border-[#e6e9ef] px-4 py-3 dark:border-[#24262b]">
        <div className="flex items-center gap-[6px]">
          <Circle className="h-[7px] w-[7px] fill-[#db6060] text-[#db6060]" />
          <Circle className="h-[7px] w-[7px] fill-[#d0a24a] text-[#d0a24a]" />
          <Circle className="h-[7px] w-[7px] fill-[#2fbf7f] text-[#2fbf7f]" />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-[30px] rounded-[5px] border-[#d8dce3] bg-white px-3 text-[14px] text-[#5f6b7a] shadow-none hover:bg-[#f1f5f9] hover:text-[#18181b] dark:border-[#30333a] dark:bg-[#14161b] dark:text-[#a4aab5] dark:hover:bg-[#1b1e25] dark:hover:text-[#d7d9e0]"
          aria-label={copyLabel}
          onClick={onCopy}
        >
          <Copy className="h-[12px] w-[12px]" />
          {copyLabel}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[14px] leading-[1.65] text-[#334155] dark:text-[#aeb4c0]">
        {code}
      </pre>
    </div>
  );
}
