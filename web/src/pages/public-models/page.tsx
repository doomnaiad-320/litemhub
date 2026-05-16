import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Layers3,
  Loader2,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PublicSiteHeader } from "@/components/common/PublicSiteHeader";
import { usePublicModels } from "@/feature/public-models/hooks";
import { useUserPortalAuthStore } from "@/store/user-portal-auth";
import { ROUTES } from "@/routes/constants";
import type { PublicModel } from "@/types/public-model";
import { cn } from "@/lib/utils";
import {
  DISPLAY_TOKEN_PRICE_UNIT_LABEL,
  buildImagePriceEntries,
  formatPriceNumber,
  formatTokenPriceValue,
  getPublicModelDetailPath,
  sortCapabilities,
} from "@/lib/model-catalog";

const ALL_VALUE = "__all__";
const FEATURED_CAPABILITIES = ["reasoning", "vision", "tools", "json", "embedding", "coding"];
const FEATURED_PROVIDERS_LIMIT = 8;
const MODEL_TYPE_FILTERS = ["video", "image", "llm"] as const;
const MODEL_SORT_FILTERS = ["latest", "popular", "priceAsc", "priceDesc"] as const;

type ModelTypeFilter = (typeof MODEL_TYPE_FILTERS)[number];
type ModelSortFilter = (typeof MODEL_SORT_FILTERS)[number];

interface StatItem {
  icon: LucideIcon;
  key: "models" | "providers" | "capabilities" | "groups";
  value: number;
}

const formatContextLength = (value?: number) => {
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

const getInputPrice = (model: PublicModel) =>
  formatTokenPriceValue(model.price?.input_price, model.price?.input_price_unit) ||
  formatTokenPriceValue(
    model.price?.image_input_price,
    model.price?.image_input_price_unit,
  ) ||
  formatTokenPriceValue(
    model.price?.audio_input_price,
    model.price?.audio_input_price_unit,
  );

const formatRequestPriceValue = (price: number | undefined, unitLabel: string) => {
  if (price == null || price === 0) {
    return null;
  }

  return `${formatPriceNumber(price)}/${unitLabel}`;
};

const getOutputPrice = (model: PublicModel, requestUnitLabel = "次") =>
  formatTokenPriceValue(model.price?.output_price, model.price?.output_price_unit) ||
  formatRequestPriceValue(model.price?.output_request_price, requestUnitLabel) ||
  formatTokenPriceValue(
    model.price?.image_output_price,
    model.price?.image_output_price_unit,
  ) ||
  formatTokenPriceValue(
    model.price?.thinking_mode_output_price,
    model.price?.thinking_mode_output_price_unit,
  ) ||
  buildImagePriceEntries(model.image_prices, model.image_quality_prices)[0]?.value;

const getPriceNumber = (value?: string | null) => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Number(value.split("/")[0]?.trim());
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const compareModelName = (left: PublicModel, right: PublicModel) =>
  left.model.localeCompare(right.model);

const getComparableModelPrice = (model: PublicModel) =>
  Math.min(getPriceNumber(getInputPrice(model)), getPriceNumber(getOutputPrice(model)));

const compareModelPrice = (
  left: PublicModel,
  right: PublicModel,
  direction: "asc" | "desc",
) => {
  const leftPrice = getComparableModelPrice(left);
  const rightPrice = getComparableModelPrice(right);
  const leftHasPrice = Number.isFinite(leftPrice);
  const rightHasPrice = Number.isFinite(rightPrice);

  if (!leftHasPrice && !rightHasPrice) {
    return compareModelName(left, right);
  }

  if (!leftHasPrice) {
    return 1;
  }

  if (!rightHasPrice) {
    return -1;
  }

  return direction === "asc"
    ? leftPrice - rightPrice || compareModelName(left, right)
    : rightPrice - leftPrice || compareModelName(left, right);
};

const getModelRecency = (model: PublicModel) => model.updated_at || model.created_at || 0;

const getModelPopularityScore = (model: PublicModel) =>
  (model.available_groups || []).length * 10 + (model.available_sets || []).length;

const getModelHealthScore = () => 100;

const getHealthToneClass = (score: number) => {
  if (score >= 95) {
    return "border-[#24c37a]/25 bg-[#24c37a]/10 text-[#0f8f5f] dark:border-[#24c37a]/30 dark:bg-[#24c37a]/15 dark:text-[#6ee7ad]";
  }

  if (score >= 90) {
    return "border-[#d8951b]/30 bg-[#d8951b]/10 text-[#9a6400] dark:border-[#d8951b]/35 dark:bg-[#d8951b]/15 dark:text-[#f0c36a]";
  }

  return "border-[#dc2626]/25 bg-[#dc2626]/10 text-[#b91c1c] dark:border-[#ef4444]/35 dark:bg-[#ef4444]/15 dark:text-[#fca5a5]";
};

const isModelType = (model: PublicModel, type: ModelTypeFilter) => {
  const capabilities = model.capabilities || [];

  if (type === "video") {
    return capabilities.includes("video");
  }

  if (type === "image") {
    return capabilities.includes("image") && !capabilities.includes("video");
  }

  return !capabilities.includes("video") && !capabilities.includes("image");
};

const updateMetaTag = (selector: string, attribute: "content" | "href", value: string) => {
  const element = document.head.querySelector(selector);
  if (element) {
    element.setAttribute(attribute, value);
  }
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

export default function PublicModelsPage() {
  const { t: rawT, i18n } = useTranslation();
  const t = rawT as (key: string, options?: Record<string, unknown>) => string;
  const navigate = useNavigate();
  const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated);
  const { data, isLoading, isError } = usePublicModels();
  const [keyword, setKeyword] = useState("");
  const [modelTypeFilter, setModelTypeFilter] = useState<ModelTypeFilter>("llm");
  const [providerFilter, setProviderFilter] = useState(ALL_VALUE);
  const [capabilityFilter, setCapabilityFilter] = useState(ALL_VALUE);
  const [sortBy, setSortBy] = useState<ModelSortFilter>("latest");

  const models = useMemo(() => data?.models || [], [data?.models]);

  useEffect(() => {
    const title = t("publicModels.seo.title");
    const description = t("publicModels.seo.description");
    document.title = title;
    updateMetaTag('meta[name="description"]', "content", description);
    updateMetaTag('meta[property="og:title"]', "content", title);
    updateMetaTag('meta[property="og:description"]', "content", description);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}${ROUTES.PUBLIC_MODELS}`);
  }, [t, i18n.resolvedLanguage]);

  useEffect(() => {
    ensureJsonLd("public-models-jsonld", {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: t("publicModels.seo.itemListName"),
      description: t("publicModels.seo.description"),
      itemListElement: models.slice(0, 50).map((model, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: model.model,
        description: model.description || `${model.model} API`,
        url: `${window.location.origin}${getPublicModelDetailPath(model.model)}`,
      })),
    });
  }, [models, t, i18n.resolvedLanguage]);

  const providerOptions = useMemo(
    () =>
      Array.from(new Set(models.map((model) => model.provider))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [models],
  );

  const capabilityOptions = useMemo(
    () =>
      sortCapabilities(
        Array.from(new Set(models.flatMap((model) => model.capabilities || []))),
      ),
    [models],
  );

  const modelTypeOptions = useMemo(
    () =>
      MODEL_TYPE_FILTERS.map((type) => ({
        type,
        count: models.filter((model) => isModelType(model, type)).length,
      })),
    [models],
  );

  const visibleCapabilityOptions = useMemo(
    () =>
      FEATURED_CAPABILITIES.filter(
        (capability) =>
          capabilityOptions.includes(capability) &&
          models.some(
            (model) =>
              isModelType(model, modelTypeFilter) &&
              (model.capabilities || []).includes(capability),
          ),
      ),
    [capabilityOptions, modelTypeFilter, models],
  );

  const visibleProviderOptions = useMemo(
    () =>
      providerOptions
        .filter((provider) =>
          models.some(
            (model) => model.provider === provider && isModelType(model, modelTypeFilter),
          ),
        )
        .slice(0, FEATURED_PROVIDERS_LIMIT),
    [modelTypeFilter, models, providerOptions],
  );

  const filteredModels = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const filtered = models
      .filter((model) => isModelType(model, modelTypeFilter))
      .filter((model) => providerFilter === ALL_VALUE || model.provider === providerFilter)
      .filter(
        (model) =>
          capabilityFilter === ALL_VALUE ||
          (model.capabilities || []).includes(capabilityFilter),
      )
      .filter((model) => {
        if (!normalizedKeyword) {
          return true;
        }

        return (
          model.model.toLowerCase().includes(normalizedKeyword) ||
          model.provider.toLowerCase().includes(normalizedKeyword) ||
          (model.description || "").toLowerCase().includes(normalizedKeyword) ||
          (model.capabilities || []).some((capability) =>
            t(`portal.models.capability.${capability}`)
              .toLowerCase()
              .includes(normalizedKeyword),
          )
        );
      });

    return [...filtered].sort((left, right) => {
      switch (sortBy) {
        case "popular":
          return (
            getModelPopularityScore(right) - getModelPopularityScore(left) ||
            compareModelName(left, right)
          );
        case "priceAsc":
          return compareModelPrice(left, right, "asc");
        case "priceDesc":
          return compareModelPrice(left, right, "desc");
        case "latest":
        default:
          return getModelRecency(right) - getModelRecency(left) || compareModelName(left, right);
      }
    });
  }, [capabilityFilter, keyword, modelTypeFilter, models, providerFilter, sortBy, t]);

  const stats = useMemo(
    () => ({
      models: models.length,
      providers: providerOptions.length,
      capabilities: capabilityOptions.length,
      groups: new Set(models.flatMap((model) => model.available_groups || [])).size,
    }),
    [capabilityOptions.length, models, providerOptions.length],
  );

  const copyModelId = async (model: string) => {
    try {
      await navigator.clipboard.writeText(model);
      toast.success(t("publicModels.copied"));
    } catch {
      toast.error(t("publicModels.copyFailed"));
    }
  };

  const clearFilters = () => {
    setKeyword("");
    setModelTypeFilter("llm");
    setProviderFilter(ALL_VALUE);
    setCapabilityFilter(ALL_VALUE);
    setSortBy("latest");
  };

  const hasActiveFilters =
    keyword.trim().length > 0 ||
    modelTypeFilter !== "llm" ||
    providerFilter !== ALL_VALUE ||
    capabilityFilter !== ALL_VALUE ||
    sortBy !== "latest";

  return (
    <div className="min-h-screen bg-white font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] dark:bg-[#111827] dark:text-white">
      <PublicSiteHeader activeItem="models" />

      <main>
        <section className="relative overflow-hidden border-b border-[#f2f3f5] dark:border-white/10">
          <div className="pointer-events-none absolute right-[-9rem] top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[#1456f0]/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-10rem] left-[-8rem] h-[24rem] w-[24rem] rounded-full bg-[#ea5ec1]/10 blur-3xl" />
          <div className="relative mx-auto grid w-full max-w-[1504px] gap-10 px-4 py-14 lg:grid-cols-[0.96fr_1.04fr] lg:items-end lg:py-20">
            <div className="space-y-7">
              <Badge className="rounded-full border-[#e5e7eb] bg-white px-3 py-1 text-[#45515e] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] dark:border-white/10 dark:bg-white/5 dark:text-white/70" variant="outline">
                <Sparkles className="h-3.5 w-3.5 text-[#1456f0]" />
                {t("publicModels.badge")}
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-4xl font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-5xl font-medium leading-[1.1] tracking-tight text-[#222222] dark:text-white sm:text-6xl lg:text-[80px]">
                  {t("publicModels.title")}
                </h1>
                <p className="max-w-2xl text-lg font-normal leading-[1.5] text-[#45515e] dark:text-white/70 md:text-xl">
                  {t("publicModels.description")}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href="#model-catalog">
                  <Button size="lg" className="h-12 rounded-lg bg-[#181e25] px-6 text-white shadow-[rgba(44,30,116,0.16)_0px_0px_15px] hover:bg-[#111827]">
                    {t("publicModels.searchModels")}
                    <Search className="h-4 w-4" />
                  </Button>
                </a>
                <Link to={isAuthenticated ? ROUTES.USER_KEYS : ROUTES.USER_REGISTER}>
                  <Button size="lg" variant="outline" className="h-12 rounded-lg border-0 bg-[#f0f0f0] px-6 text-[#333333] shadow-none hover:bg-[#e8e8e8] dark:bg-white/10 dark:text-white">
                    {t("publicModels.getApiKey")}
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { key: "models", value: stats.models, icon: Database },
                { key: "providers", value: stats.providers, icon: Layers3 },
                { key: "capabilities", value: stats.capabilities, icon: SlidersHorizontal },
                { key: "groups", value: stats.groups, icon: CheckCircle2 },
              ] satisfies StatItem[]).map(({ key, value, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-[20px] bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:ring-white/10"
                >
                  <div>
                    <div className="text-sm font-medium text-[#8e8e93]">
                      {t(`publicModels.stats.${key}`)}
                    </div>
                    <div className="mt-2 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-3xl font-semibold tabular-nums text-[#18181b] dark:text-white">
                      {isLoading ? "-" : value}
                    </div>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#f0f0f0] text-[#1456f0] dark:bg-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="model-catalog" className="mx-auto w-full max-w-[1504px] px-4 py-14 lg:py-20">
          <div className="-mx-4 mb-8 overflow-hidden rounded-[20px] bg-white shadow-[rgba(15,23,42,0.04)_0px_12px_24px] dark:bg-[#0b0f18] dark:shadow-none">
            <div className="border-b border-[#f2f3f5] px-4 py-3 dark:border-white/10">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-1 overflow-x-auto">
                  {modelTypeOptions.map(({ type, count }) => (
                    <button
                      key={type}
                      type="button"
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition active:scale-[0.98]",
                        modelTypeFilter === type
                          ? "bg-[#181e25] text-white dark:bg-white dark:text-[#181e25]"
                          : "bg-transparent text-[#45515e] hover:bg-black/[0.05] dark:text-white/60 dark:hover:bg-white/10",
                      )}
                      onClick={() => {
                        setModelTypeFilter(type);
                        setCapabilityFilter(ALL_VALUE);
                        setProviderFilter(ALL_VALUE);
                      }}
                    >
                      <span>{t(`publicModels.typeMenu.${type}`)}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                          modelTypeFilter === type
                            ? "bg-white/15 text-white dark:bg-[#181e25]/10 dark:text-[#181e25]"
                            : "bg-black/[0.06] text-[#8e8e93] dark:bg-white/10 dark:text-white/45",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:justify-end">
                  <div className="relative w-full sm:min-w-[260px] lg:w-[320px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
                    <Input
                      id="public-model-search"
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder={t("publicModels.searchPlaceholder")}
                      aria-label={t("publicModels.searchLabel")}
                      className="h-10 rounded-full border-[#e5e7eb] bg-white pl-10 text-[#222222] shadow-none placeholder:text-[#8e8e93] dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>

                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as ModelSortFilter)}
                  >
                    <SelectTrigger
                      aria-label={t("publicModels.sort.label")}
                      className="h-10 w-full rounded-full border-[#e5e7eb] bg-white px-4 text-[#222222] shadow-none dark:border-white/10 dark:bg-white/5 dark:text-white sm:w-[176px]"
                    >
                      <SelectValue placeholder={t("publicModels.sort.label")} />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_SORT_FILTERS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(`publicModels.sort.${option}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-4 lg:grid-cols-[224px_minmax(0,1fr)] lg:p-5">
              <aside className="space-y-5 lg:pr-5">
                <FilterPillGroup
                  label={t("publicModels.provider")}
                  options={[
                    { value: ALL_VALUE, label: t("publicModels.allProviders") },
                    ...visibleProviderOptions.map((provider) => ({
                      value: provider,
                      label: provider,
                    })),
                  ]}
                  value={providerFilter}
                  onChange={setProviderFilter}
                />

                <FilterPillGroup
                  label={t("publicModels.capability")}
                  options={[
                    { value: ALL_VALUE, label: t("publicModels.allCapabilities") },
                    ...visibleCapabilityOptions.map((capability) => ({
                      value: capability,
                      label: t(`portal.models.capability.${capability}`),
                    })),
                  ]}
                  value={capabilityFilter}
                  onChange={setCapabilityFilter}
                />
              </aside>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="rounded-[16px] border border-[#f2f3f5] bg-[#fbfbfc] px-4 py-3 text-sm text-[#8e8e93] dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45" aria-live="polite">
                    {t("publicModels.results", { count: filteredModels.length })}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-lg border-0 bg-[#f0f0f0] px-5 text-[#333333] shadow-none hover:bg-[#e8e8e8] dark:bg-white/10 dark:text-white sm:w-auto"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                  >
                    {t("publicModels.clear")}
                  </Button>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-[286px] rounded-[20px]" />
                    ))
                  ) : isError ? (
                    <div className="rounded-[20px] bg-white p-8 text-center text-sm text-[#45515e] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:text-white/70 dark:ring-white/10 md:col-span-2 xl:col-span-3">
                      {t("publicModels.loadError")}
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <div className="rounded-[20px] bg-white p-8 text-center text-sm text-[#45515e] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:text-white/70 dark:ring-white/10 md:col-span-2 xl:col-span-3">
                      {t("publicModels.empty")}
                    </div>
                  ) : (
                    filteredModels.map((model) => {
                      const healthScore = getModelHealthScore();

                      return (
                        <article
                          key={model.model}
                          id={encodeURIComponent(model.model)}
                          role="link"
                          tabIndex={0}
                          aria-label={`${t("publicModels.viewDetails")}: ${model.model}`}
                          className="group flex cursor-pointer flex-col rounded-[20px] bg-white p-[10px] shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] transition duration-200 hover:-translate-y-0.5 hover:shadow-[rgba(44,30,116,0.16)_0px_0px_15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1456f0]/35 dark:bg-white/5 dark:ring-white/10"
                          onClick={() => navigate(getPublicModelDetailPath(model.model))}
                          onKeyDown={(event) => {
                            if (event.currentTarget !== event.target) {
                              return;
                            }

                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              navigate(getPublicModelDetailPath(model.model));
                            }
                          }}
                        >
                          <div className="mb-[5px] flex items-start justify-between gap-3">
                            <Badge className="rounded-full bg-[#1456f0] px-3 py-1 text-white hover:bg-[#1456f0]">
                              {model.provider}
                            </Badge>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 shrink-0 rounded-lg border-[#e5e7eb] bg-white text-[#45515e] shadow-none hover:bg-[#f0f0f0] dark:border-white/10 dark:bg-white/5 dark:text-white"
                              aria-label={`${t("publicModels.copyModelId")}: ${model.model}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                void copyModelId(model.model);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>

                          <Link
                            to={getPublicModelDetailPath(model.model)}
                            className="break-words font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[18px] font-normal leading-[1.25] text-[#18181b] transition hover:text-[#1456f0] dark:text-white"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {model.model}
                          </Link>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-[#45515e] dark:text-white/70">
                            <span
                              className={cn(
                                "inline-flex h-6 items-center rounded-full border px-2.5 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-xs font-semibold tabular-nums",
                                getHealthToneClass(healthScore),
                              )}
                            >
                              {t("publicModels.health")} {healthScore}%
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <span className="text-[#8e8e93]">{t("publicModels.table.input")}</span>
                              <span className="truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold text-[#18181b] dark:text-white">
                                {getInputPrice(model) || t("publicModels.freePrice")}
                              </span>
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <span className="text-[#8e8e93]">{t("publicModels.table.output")}</span>
                              <span className="truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold text-[#18181b] dark:text-white">
                                {getOutputPrice(
                                  model,
                                  t("publicModels.perRequestUnit"),
                                ) || "-"}
                              </span>
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm leading-[1.7] text-[#45515e] dark:text-white/70">
                            {model.description || t("publicModels.defaultDescription")}
                          </p>

                          <div className="mt-5 flex flex-wrap gap-1.5">
                            <Badge className="rounded-full border-[#1456f0]/20 bg-[#1456f0] px-2.5 py-1 text-xs font-semibold text-white shadow-[rgba(20,86,240,0.18)_0px_4px_10px] hover:bg-[#1456f0] dark:border-[#60a5fa]/30 dark:bg-[#2563eb] dark:text-white">
                              {t("publicModels.table.context")} {formatContextLength(model.context_length)}
                            </Badge>
                            {(model.capabilities || []).slice(0, 5).map((capability) => (
                              <Badge
                                key={capability}
                                variant="outline"
                                className="rounded-full border-[#e5e7eb] bg-white px-2.5 py-1 text-xs font-normal text-[#45515e] dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                              >
                                {t(`portal.models.capability.${capability}`)}
                              </Badge>
                            ))}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#f2f3f5] bg-white dark:border-white/10">
          <div className="mx-auto grid w-full max-w-[1504px] gap-8 px-4 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20">
            <div className="space-y-4">
              <Badge variant="outline" className="rounded-full border-[#e5e7eb] bg-white text-[#45515e] dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                <Code2 className="h-3.5 w-3.5" />
                {t("publicModels.apiExample.badge")}
              </Badge>
              <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[31px] font-semibold leading-[1.5] tracking-tight text-[#222222] dark:text-white">
                {t("publicModels.apiExample.title")}
              </h2>
              <p className="leading-[1.5] text-[#45515e] dark:text-white/70">
                {t("publicModels.apiExample.description")}
              </p>
            </div>
            <div className="overflow-hidden rounded-[20px] bg-[#181e25] shadow-[rgba(44,30,116,0.16)_0px_0px_15px]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <Badge className="rounded-full bg-white/10 text-white hover:bg-white/10">
                  OpenAI compatible
                </Badge>
              </div>
              <pre className="overflow-x-auto p-5 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-sm leading-7 text-white/80">
{`curl https://api.yourdomain.com/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Hello"}]
  }'`}
              </pre>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#181e25] py-8 text-sm text-white/70">
        <div className="mx-auto flex w-full max-w-[1504px] flex-col items-center justify-between gap-3 px-4 sm:flex-row">
          <div>© {new Date().getFullYear()} LiteMHub. AI model distribution platform.</div>
          <div className="inline-flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("publicModels.priceUnit", { unit: DISPLAY_TOKEN_PRICE_UNIT_LABEL })}
          </div>
        </div>
      </footer>
    </div>
  );
}

function FilterPillGroup({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#8e8e93] dark:text-white/45">
        {label}
      </div>
      <div className="space-y-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "flex h-8 w-full min-w-0 items-center gap-2 rounded-[6px] px-1.5 text-left text-sm font-medium transition active:scale-[0.98]",
              value === option.value
                ? "text-[#18181b] dark:text-white"
                : "text-[#45515e] hover:bg-black/[0.04] dark:text-white/70 dark:hover:bg-white/[0.06]",
            )}
            onClick={() => onChange(option.value)}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition",
                value === option.value
                  ? "border-[#181e25] bg-[#181e25] text-white dark:border-white dark:bg-white dark:text-[#181e25]"
                  : "border-[#d8dce3] bg-white dark:border-white/15 dark:bg-white/5",
              )}
            >
              {value === option.value && <CheckCircle2 className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="truncate">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
