import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageSelector } from "@/components/common/LanguageSelector";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { usePublicModel, usePublicModels } from "@/feature/public-models/hooks";
import { useUserPortalAuthStore } from "@/store/user-portal-auth";
import { ROUTES } from "@/routes/constants";
import type { PublicModel } from "@/types/public-model";
import {
  DISPLAY_TOKEN_PRICE_UNIT_LABEL,
  buildImagePriceEntries,
  formatPriceValue,
  formatTokenPriceValue,
  getPublicModelDetailPath,
  hasPriceData,
} from "@/lib/model-catalog";

interface PriceRow {
  label: string;
  value: string;
}

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

const updateMetaTag = (selector: string, attribute: "content" | "href", value: string) => {
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

const getInputPrice = (model?: PublicModel) =>
  model
    ? formatTokenPriceValue(model.price?.input_price, model.price?.input_price_unit) ||
      formatTokenPriceValue(
        model.price?.image_input_price,
        model.price?.image_input_price_unit,
      ) ||
      formatTokenPriceValue(
        model.price?.audio_input_price,
        model.price?.audio_input_price_unit,
      ) ||
      "-"
    : "-";

const getOutputPrice = (model?: PublicModel) =>
  model
    ? formatTokenPriceValue(model.price?.output_price, model.price?.output_price_unit) ||
      formatTokenPriceValue(
        model.price?.image_output_price,
        model.price?.image_output_price_unit,
      ) ||
      formatTokenPriceValue(
        model.price?.thinking_mode_output_price,
        model.price?.thinking_mode_output_price_unit,
      ) ||
      buildImagePriceEntries(model.image_prices, model.image_quality_prices)[0]?.value ||
      "-"
    : "-";

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
      value: formatTokenPriceValue(price.input_price, price.input_price_unit) || "",
    },
    {
      label: t("publicModelDetail.pricing.output"),
      value: formatTokenPriceValue(price.output_price, price.output_price_unit) || "",
    },
    {
      label: t("publicModelDetail.pricing.request"),
      value: formatPriceValue(price.per_request_price, 1) || "",
    },
    {
      label: t("publicModelDetail.pricing.cached"),
      value: formatTokenPriceValue(price.cached_price, price.cached_price_unit) || "",
    },
    {
      label: t("publicModelDetail.pricing.cacheCreation"),
      value:
        formatTokenPriceValue(price.cache_creation_price, price.cache_creation_price_unit) ||
        "",
    },
    {
      label: t("publicModelDetail.pricing.imageInput"),
      value:
        formatTokenPriceValue(price.image_input_price, price.image_input_price_unit) || "",
    },
    {
      label: t("publicModelDetail.pricing.imageOutput"),
      value:
        formatTokenPriceValue(price.image_output_price, price.image_output_price_unit) || "",
    },
    {
      label: t("publicModelDetail.pricing.audioInput"),
      value:
        formatTokenPriceValue(price.audio_input_price, price.audio_input_price_unit) || "",
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
      value: formatTokenPriceValue(price.web_search_price, price.web_search_price_unit) || "",
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

export default function PublicModelDetailPage() {
  const { t: rawT, i18n } = useTranslation();
  const t = rawT as (key: string, options?: Record<string, unknown>) => string;
  const params = useParams();
  const modelId = decodeModelPath(params["*"]);
  const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated);
  const modelQuery = usePublicModel(modelId);
  const modelsQuery = usePublicModels();
  const model = modelQuery.data;
  const allModels = modelsQuery.data?.models || [];
  const isLoading = modelQuery.isLoading || !modelId;
  const signUpTarget = isAuthenticated ? ROUTES.USER_KEYS : ROUTES.USER_REGISTER;
  const apiBase = typeof window === "undefined" ? "" : window.location.origin;

  const priceRows = useMemo(() => buildPriceRows(model, t), [model, t, i18n.resolvedLanguage]);

  const relatedModels = useMemo(() => {
    if (!model) {
      return [];
    }

    const capabilitySet = new Set(model.capabilities || []);
    return allModels
      .filter((item) => item.model !== model.model)
      .map((item) => ({
        ...item,
        score:
          (item.provider === model.provider ? 3 : 0) +
          (item.capabilities || []).filter((capability) => capabilitySet.has(capability))
            .length,
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.model.localeCompare(right.model))
      .slice(0, 3);
  }, [allModels, model]);

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
    const readableName = model?.model || modelId || t("publicModelDetail.fallbackModel");
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
      description: model.description || t("publicModelDetail.seo.description", {
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
    <div className="min-h-screen bg-white font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:bg-[#111827] dark:text-white">
      <header className="sticky top-0 z-40 border-b border-[#f2f3f5] bg-white/92 backdrop-blur-xl dark:border-white/10 dark:bg-[#111827]/92">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#181e25] text-white shadow-[rgba(44,30,116,0.16)_0px_0px_15px]">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-medium tracking-tight text-[#18181b] dark:text-white">
                LiteMHub
              </div>
              <div className="text-xs leading-[1.7] text-[#8e8e93]">
                AI Model Router
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 text-sm font-medium text-[#45515e] dark:text-white/70 md:flex">
            <Link
              to={ROUTES.PUBLIC_MODELS}
              className="rounded-full bg-black/[0.05] px-4 py-2 text-[#18181b] dark:bg-white/10 dark:text-white"
            >
              {t("publicModels.nav.models")}
            </Link>
            <Link to="/#billing" className="rounded-full px-4 py-2 transition hover:bg-black/[0.05] hover:text-[#18181b] dark:hover:bg-white/10 dark:hover:text-white">
              {t("publicModels.nav.billing")}
            </Link>
            <Link to="/#workflow" className="rounded-full px-4 py-2 transition hover:bg-black/[0.05] hover:text-[#18181b] dark:hover:bg-white/10 dark:hover:text-white">
              {t("publicModels.nav.workflow")}
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <div className="hidden sm:block">
              <LanguageSelector variant="minimal" />
            </div>
            <Link to={ROUTES.USER_LOGIN}>
              <Button variant="ghost" className="rounded-full text-[#18181b] dark:text-white">
                {t("publicModels.nav.login")}
              </Button>
            </Link>
            <Link to={signUpTarget}>
              <Button className="rounded-lg bg-[#181e25] px-5 text-white shadow-[rgba(0,0,0,0.08)_0px_4px_6px] hover:bg-[#111827] dark:bg-white dark:text-[#181e25] dark:hover:bg-white/90">
                {isAuthenticated
                  ? t("publicModels.nav.console")
                  : t("publicModels.nav.start")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-[#f2f3f5] dark:border-white/10">
          <div className="pointer-events-none absolute right-[-9rem] top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[#1456f0]/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-10rem] left-[-8rem] h-[24rem] w-[24rem] rounded-full bg-[#ea5ec1]/10 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20">
            <div className="text-sm font-medium text-[#8e8e93]">
              <Link to={ROUTES.PUBLIC_MODELS} className="transition hover:text-[#18181b] dark:hover:text-white">
                {t("publicModels.nav.models")}
              </Link>
              <span className="mx-2">/</span>
              <span>{model?.provider || t("publicModelDetail.fallbackProvider")}</span>
            </div>

            {isLoading ? (
              <div className="mt-10 space-y-5">
                <Skeleton className="h-12 w-full max-w-3xl" />
                <Skeleton className="h-24 w-full max-w-4xl" />
                <Skeleton className="h-16 w-full max-w-5xl" />
              </div>
            ) : modelQuery.isError || !model ? (
              <Alert className="mt-8 max-w-2xl border-red-200 bg-red-50 text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("publicModelDetail.notFoundTitle")}</AlertTitle>
                <AlertDescription>
                  {t("publicModelDetail.notFoundDescription", { model: modelId || "-" })}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <div className="min-w-0">
                  <h1 className="max-w-5xl break-words font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-5xl font-medium leading-[1.1] tracking-tight text-[#222222] dark:text-white md:text-7xl">
                    {model.model}
                  </h1>
                  <p className="mt-6 max-w-3xl text-lg font-normal leading-[1.5] text-[#45515e] dark:text-white/70 md:text-xl">
                    {model.description || t("publicModels.defaultDescription")}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Badge className="rounded-full bg-[#1456f0] px-3 py-1 text-white hover:bg-[#1456f0]">
                      {model.provider}
                    </Badge>
                    {(model.capabilities || []).map((capability) => (
                      <Badge
                        key={capability}
                        variant="outline"
                        className="rounded-full border-[#e5e7eb] bg-white px-3 py-1 font-normal text-[#45515e] dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                      >
                        {t(`portal.models.capability.${capability}`)}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Link to={signUpTarget}>
                    <Button size="lg" className="h-12 w-full rounded-lg bg-[#181e25] px-6 text-white shadow-[rgba(44,30,116,0.16)_0px_0px_15px] hover:bg-[#111827] dark:bg-white dark:text-[#181e25]">
                      {t("publicModelDetail.startUsing")}
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="h-12 w-full rounded-lg border-[#e5e7eb] bg-[#f0f0f0] px-6 text-[#333333] shadow-none hover:bg-[#e8e8e8] dark:border-white/10 dark:bg-white/10 dark:text-white"
                    onClick={() => copyText(model.model, "publicModels.copied")}
                  >
                    {t("publicModelDetail.copyModel")}
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {model && (
          <section className="mx-auto grid max-w-7xl gap-16 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-20">
            <div className="min-w-0 space-y-20">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: t("publicModelDetail.metrics.context"),
                    value: formatCompactTokenCount(model.context_length),
                  },
                  {
                    label: t("publicModelDetail.metrics.input"),
                    value: getInputPrice(model),
                  },
                  {
                    label: t("publicModelDetail.metrics.output"),
                    value: getOutputPrice(model),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[20px] bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:ring-white/10"
                  >
                    <div className="text-sm font-medium text-[#8e8e93]">{item.label}</div>
                    <div className="mt-3 break-words font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-2xl font-semibold text-[#18181b] dark:text-white">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <section aria-labelledby="capabilities-title">
                <h2 id="capabilities-title" className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[31px] font-semibold leading-[1.5] tracking-tight text-[#222222] dark:text-white">
                  {t("publicModelDetail.capabilitiesTitle")}
                </h2>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {(model.capabilities || []).map((capability) => (
                    <div
                      key={capability}
                      className="rounded-[20px] bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:ring-white/10"
                    >
                      <div className="flex items-center gap-2 font-['Poppins',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-medium text-[#18181b] dark:text-white">
                        <CheckCircle2 className="h-4 w-4 text-[#1456f0]" />
                        {t(`portal.models.capability.${capability}`)}
                      </div>
                      <p className="mt-3 text-sm leading-[1.7] text-[#45515e] dark:text-white/70">
                        {t("publicModels.defaultDescription")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="pricing-title">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                  <div>
                    <h2 id="pricing-title" className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[31px] font-semibold leading-[1.5] tracking-tight text-[#222222] dark:text-white">
                      {t("publicModelDetail.pricingTitle")}
                    </h2>
                    <p className="mt-3 text-sm leading-[1.7] text-[#45515e] dark:text-white/70">
                      {t("publicModelDetail.pricingUnit", {
                        unit: DISPLAY_TOKEN_PRICE_UNIT_LABEL,
                      })}
                    </p>
                  </div>
                </div>

                {!hasPriceData({
                  price: model.price,
                  imagePrices: model.image_prices,
                  imageQualityPrices: model.image_quality_prices,
                }) ? (
                  <div className="mt-6 rounded-[16px] bg-white p-5 text-sm text-[#45515e] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:text-white/70 dark:ring-white/10">
                    {t("publicModelDetail.pricingEmpty")}
                  </div>
                ) : (
                  <div className="mt-6 overflow-hidden rounded-[20px] bg-white shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:ring-white/10">
                    {priceRows.map((row) => (
                      <div
                        key={`${row.label}-${row.value}`}
                        className="grid gap-2 border-b border-[#f2f3f5] px-6 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] dark:border-white/10"
                      >
                        <div className="text-sm font-medium text-[#45515e] dark:text-white/70">
                          {row.label}
                        </div>
                        <div className="font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-sm font-semibold text-[#18181b] dark:text-white">{row.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="api-title">
                <h2 id="api-title" className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[31px] font-semibold leading-[1.5] tracking-tight text-[#222222] dark:text-white">
                  {t("publicModelDetail.apiTitle")}
                </h2>
                <Tabs defaultValue="curl" className="mt-6">
                  <TabsList className="h-10 rounded-full bg-black/[0.05] p-1 dark:bg-white/10">
                    <TabsTrigger value="curl" className="rounded-full px-4">
                      cURL
                    </TabsTrigger>
                    <TabsTrigger value="javascript" className="rounded-full px-4">
                      JavaScript
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="curl" className="mt-4">
                    <CodePanel
                      code={curlExample}
                      copyLabel={t("publicModelDetail.copyExample")}
                      onCopy={() => copyText(curlExample, "publicModelDetail.exampleCopied")}
                    />
                  </TabsContent>
                  <TabsContent value="javascript" className="mt-4">
                    <CodePanel
                      code={javascriptExample}
                      copyLabel={t("publicModelDetail.copyExample")}
                      onCopy={() =>
                        copyText(javascriptExample, "publicModelDetail.exampleCopied")
                      }
                    />
                  </TabsContent>
                </Tabs>
              </section>

              <section aria-labelledby="related-title">
                <h2 id="related-title" className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[31px] font-semibold leading-[1.5] tracking-tight text-[#222222] dark:text-white">
                  {t("publicModelDetail.relatedTitle")}
                </h2>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {modelsQuery.isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-28 rounded-lg" />
                    ))
                  ) : relatedModels.length === 0 ? (
                    <div className="text-sm text-[#8e8e93]">
                      {t("publicModelDetail.relatedEmpty")}
                    </div>
                  ) : (
                    relatedModels.map((item) => (
                      <Link
                        key={item.model}
                        to={getPublicModelDetailPath(item.model)}
                        className="rounded-[20px] bg-white p-5 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] transition hover:shadow-[rgba(44,30,116,0.16)_0px_0px_15px] dark:bg-white/5 dark:ring-white/10"
                      >
                        <div className="break-words font-medium text-[#18181b] dark:text-white">{item.model}</div>
                        <div className="mt-2 text-sm text-[#8e8e93]">
                          {item.provider} · {formatCompactTokenCount(item.context_length)}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-[24px] bg-white p-6 shadow-[rgba(44,30,116,0.16)_0px_0px_15px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:ring-white/10">
                <div className="flex items-center gap-2">
                  <ServerIcon />
                  <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-lg font-semibold text-[#18181b] dark:text-white">Model specifications</h2>
                </div>
                <dl className="mt-5 space-y-4 text-sm">
                  {[
                    {
                      label: t("publicModelDetail.modelId"),
                      value: model.model,
                      copy: true,
                    },
                    {
                      label: t("publicModelDetail.metrics.provider"),
                      value: model.provider,
                    },
                    {
                      label: t("publicModelDetail.limits.context"),
                      value: formatTokenCount(model.context_length),
                    },
                    {
                      label: t("publicModelDetail.limits.input"),
                      value: formatTokenCount(model.max_input_tokens),
                    },
                    {
                      label: t("publicModelDetail.limits.output"),
                      value: formatTokenCount(model.max_output_tokens),
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-[#8e8e93]">{item.label}</dt>
                      <dd className="mt-1 flex items-start gap-2 font-medium">
                        <span className="min-w-0 break-words font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-sm text-[#18181b] dark:text-white">
                          {item.value}
                        </span>
                        {item.copy && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 rounded-md"
                            aria-label={t("publicModels.copyModelId")}
                            onClick={() => copyText(model.model, "publicModels.copied")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <Link to={signUpTarget}>
                  <Button className="mt-6 h-10 w-full rounded-lg bg-[#181e25] text-white hover:bg-[#111827] dark:bg-white dark:text-[#181e25]">
                    {t("publicModelDetail.startUsing")}
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </aside>
          </section>
        )}
      </main>

      <footer className="border-t border-[#f2f3f5] bg-[#181e25] py-8 text-sm text-white/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
          <div>© {new Date().getFullYear()} LiteMHub. AI model distribution platform.</div>
          <div className="inline-flex items-center gap-2">
            {modelQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("publicModels.priceUnit", { unit: DISPLAY_TOKEN_PRICE_UNIT_LABEL })}
          </div>
        </div>
      </footer>
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
    <div className="overflow-hidden rounded-[20px] bg-[#181e25] text-white shadow-[rgba(44,30,116,0.16)_0px_0px_15px]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-lg border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
          aria-label={copyLabel}
          onClick={onCopy}
        >
          <Copy className="h-4 w-4" />
          {copyLabel}
        </Button>
      </div>
      <pre className="overflow-x-auto p-5 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-sm leading-[1.7] text-white/80">{code}</pre>
    </div>
  );
}

function ServerIcon() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-[13px] bg-[#e8ffea] text-[#1456f0]">
      <CheckCircle2 className="h-4 w-4" />
    </div>
  );
}
