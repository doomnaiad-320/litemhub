import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BrainCircuit,
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
import { LanguageSelector } from "@/components/common/LanguageSelector";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { usePublicModels } from "@/feature/public-models/hooks";
import { useUserPortalAuthStore } from "@/store/user-portal-auth";
import { ROUTES } from "@/routes/constants";
import type { PublicModel } from "@/types/public-model";
import { cn } from "@/lib/utils";
import {
  DISPLAY_TOKEN_PRICE_UNIT_LABEL,
  buildImagePriceEntries,
  formatTokenPriceValue,
  getPublicModelDetailPath,
  sortCapabilities,
} from "@/lib/model-catalog";

const ALL_VALUE = "__all__";
const FEATURED_CAPABILITIES = ["reasoning", "vision", "tools", "json", "image", "embedding"];

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

const getOutputPrice = (model: PublicModel) =>
  formatTokenPriceValue(model.price?.output_price, model.price?.output_price_unit) ||
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
  const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated);
  const { data, isLoading, isError } = usePublicModels();
  const [keyword, setKeyword] = useState("");
  const [providerFilter, setProviderFilter] = useState(ALL_VALUE);
  const [capabilityFilter, setCapabilityFilter] = useState(ALL_VALUE);
  const [sortBy, setSortBy] = useState("name");

  const models = data?.models || [];

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

  const filteredModels = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const filtered = models
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
        case "provider":
          return (
            left.provider.localeCompare(right.provider) ||
            left.model.localeCompare(right.model)
          );
        case "input":
          return getPriceNumber(getInputPrice(left)) - getPriceNumber(getInputPrice(right));
        case "output":
          return getPriceNumber(getOutputPrice(left)) - getPriceNumber(getOutputPrice(right));
        case "context":
          return (right.context_length || 0) - (left.context_length || 0);
        default:
          return left.model.localeCompare(right.model);
      }
    });
  }, [capabilityFilter, keyword, models, providerFilter, sortBy, t]);

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
    setProviderFilter(ALL_VALUE);
    setCapabilityFilter(ALL_VALUE);
    setSortBy("name");
  };

  const hasActiveFilters =
    keyword.trim().length > 0 ||
    providerFilter !== ALL_VALUE ||
    capabilityFilter !== ALL_VALUE ||
    sortBy !== "name";

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
            <Link to={isAuthenticated ? ROUTES.USER_DASHBOARD : ROUTES.USER_REGISTER}>
              <Button className="rounded-lg bg-[#181e25] px-4 text-white shadow-[rgba(0,0,0,0.08)_0px_4px_6px] hover:bg-[#111827] dark:bg-white dark:text-[#181e25] dark:hover:bg-white/90 sm:px-5">
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
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.96fr_1.04fr] lg:items-end lg:py-20">
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

        <section id="model-catalog" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-[#1456f0]">
                {t("publicModels.catalogEyebrow")}
              </div>
              <h2 className="mt-2 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[31px] font-semibold leading-[1.5] tracking-tight text-[#222222] dark:text-white">
                {t("publicModels.catalogTitle")}
              </h2>
            </div>
            <div className="text-sm text-[#8e8e93]" aria-live="polite">
              {t("publicModels.results", { count: filteredModels.length })}
            </div>
          </div>

          <div className="mb-8 rounded-[24px] bg-white p-4 shadow-[rgba(0,0,0,0.08)_0px_0px_22.576px] ring-1 ring-[#f2f3f5] dark:bg-white/5 dark:ring-white/10 sm:p-5">
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_180px_160px_auto]">
                <div className="relative">
                  <label className="sr-only" htmlFor="public-model-search">
                    {t("publicModels.searchLabel")}
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8e93]" />
                  <Input
                    id="public-model-search"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder={t("publicModels.searchPlaceholder")}
                    className="h-11 rounded-[13px] border-[#e5e7eb] bg-white pl-10 text-[#222222] shadow-none placeholder:text-[#8e8e93] dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>

                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="h-11 rounded-[13px] border-[#e5e7eb] bg-white dark:border-white/10 dark:bg-white/5">
                    <SelectValue placeholder={t("publicModels.provider")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t("publicModels.allProviders")}</SelectItem>
                    {providerOptions.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={capabilityFilter} onValueChange={setCapabilityFilter}>
                  <SelectTrigger className="h-11 rounded-[13px] border-[#e5e7eb] bg-white dark:border-white/10 dark:bg-white/5">
                    <SelectValue placeholder={t("publicModels.capability")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t("publicModels.allCapabilities")}</SelectItem>
                    {capabilityOptions.map((capability) => (
                      <SelectItem key={capability} value={capability}>
                        {t(`portal.models.capability.${capability}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-11 rounded-[13px] border-[#e5e7eb] bg-white dark:border-white/10 dark:bg-white/5">
                    <SelectValue placeholder={t("publicModels.sort.label")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{t("publicModels.sort.name")}</SelectItem>
                    <SelectItem value="provider">{t("publicModels.sort.provider")}</SelectItem>
                    <SelectItem value="input">{t("publicModels.sort.input")}</SelectItem>
                    <SelectItem value="output">{t("publicModels.sort.output")}</SelectItem>
                    <SelectItem value="context">{t("publicModels.sort.context")}</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg border-0 bg-[#f0f0f0] px-5 text-[#333333] shadow-none hover:bg-[#e8e8e8] dark:bg-white/10 dark:text-white"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  {t("publicModels.clear")}
                </Button>
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 shrink-0 rounded-full border-transparent bg-black/[0.05] px-3 text-[#45515e] shadow-none hover:bg-black/[0.08] dark:bg-white/10 dark:text-white/70",
                    capabilityFilter === ALL_VALUE && "bg-[#181e25] text-white hover:bg-[#181e25] dark:bg-white dark:text-[#181e25]",
                  )}
                  onClick={() => setCapabilityFilter(ALL_VALUE)}
                >
                  {t("common.all")}
                </Button>
                {FEATURED_CAPABILITIES.filter((item) =>
                  capabilityOptions.includes(item),
                ).map((capability) => (
                  <Button
                    key={capability}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 shrink-0 rounded-full border-transparent bg-black/[0.05] px-3 text-[#45515e] shadow-none hover:bg-black/[0.08] dark:bg-white/10 dark:text-white/70",
                      capabilityFilter === capability && "bg-[#181e25] text-white hover:bg-[#181e25] dark:bg-white dark:text-[#181e25]",
                    )}
                    onClick={() => setCapabilityFilter(capability)}
                  >
                    {t(`portal.models.capability.${capability}`)}
                  </Button>
                ))}
              </div>
            </div>
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
              filteredModels.map((model) => (
                <article
                  key={model.model}
                  id={encodeURIComponent(model.model)}
                  className="group flex min-h-[286px] flex-col rounded-[20px] bg-white p-5 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] transition duration-200 hover:-translate-y-0.5 hover:shadow-[rgba(44,30,116,0.16)_0px_0px_15px] dark:bg-white/5 dark:ring-white/10"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <Badge className="rounded-full bg-[#1456f0] px-3 py-1 text-white hover:bg-[#1456f0]">
                      {model.provider}
                    </Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 shrink-0 rounded-lg border-[#e5e7eb] bg-white text-[#45515e] shadow-none hover:bg-[#f0f0f0] dark:border-white/10 dark:bg-white/5 dark:text-white"
                      aria-label={`${t("publicModels.copyModelId")}: ${model.model}`}
                      onClick={() => copyModelId(model.model)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <Link
                    to={getPublicModelDetailPath(model.model)}
                    className="break-words font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-2xl font-semibold leading-[1.25] text-[#18181b] transition hover:text-[#1456f0] dark:text-white"
                  >
                    {model.model}
                  </Link>
                  <p className="mt-3 line-clamp-2 text-sm leading-[1.7] text-[#45515e] dark:text-white/70">
                    {model.description || t("publicModels.defaultDescription")}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-1.5">
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

                  <div className="mt-auto grid grid-cols-3 gap-3 pt-6">
                    {[
                      {
                        label: t("publicModels.table.context"),
                        value: formatContextLength(model.context_length),
                      },
                      {
                        label: t("publicModels.table.input"),
                        value: getInputPrice(model) || "-",
                      },
                      {
                        label: t("publicModels.table.output"),
                        value: getOutputPrice(model) || "-",
                      },
                    ].map((item) => (
                      <div key={item.label} className="min-w-0">
                        <div className="text-xs font-medium text-[#8e8e93]">{item.label}</div>
                        <div className="mt-1 truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-sm font-semibold text-[#18181b] dark:text-white">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <Link to={getPublicModelDetailPath(model.model)}>
                      <Button variant="outline" className="h-10 w-full rounded-lg border-0 bg-[#f0f0f0] text-[#333333] shadow-none hover:bg-[#e8e8e8] dark:bg-white/10 dark:text-white">
                        {t("publicModels.viewDetails")}
                      </Button>
                    </Link>
                    <Link to={isAuthenticated ? ROUTES.USER_KEYS : ROUTES.USER_REGISTER}>
                      <Button className="h-10 w-full rounded-lg bg-[#181e25] text-white hover:bg-[#111827] dark:bg-white dark:text-[#181e25]">
                        {t("publicModels.startUsing")}
                      </Button>
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="border-t border-[#f2f3f5] bg-white dark:border-white/10">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20">
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
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
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
