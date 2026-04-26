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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        url: `${window.location.origin}${ROUTES.PUBLIC_MODELS}#${encodeURIComponent(model.model)}`,
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
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/88 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/86">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">LiteMHub</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                AI Model Router
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-slate-600 dark:text-slate-300 md:flex">
            <Link to={ROUTES.PUBLIC_MODELS} className="font-medium text-slate-950 dark:text-white">
              {t("publicModels.nav.models")}
            </Link>
            <Link to="/#billing" className="transition hover:text-slate-950 dark:hover:text-white">
              {t("publicModels.nav.billing")}
            </Link>
            <Link to="/#workflow" className="transition hover:text-slate-950 dark:hover:text-white">
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
              <Button variant="ghost" className="rounded-full">
                {t("publicModels.nav.login")}
              </Button>
            </Link>
            <Link to={isAuthenticated ? ROUTES.USER_DASHBOARD : ROUTES.USER_REGISTER}>
              <Button className="rounded-full bg-slate-950 px-4 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90 sm:px-5">
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
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.96fr_1.04fr] lg:items-end lg:py-20">
            <div className="space-y-7">
              <Badge className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200" variant="outline">
                <Sparkles className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" />
                {t("publicModels.badge")}
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                  {t("publicModels.title")}
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                  {t("publicModels.description")}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href="#model-catalog">
                  <Button size="lg" className="h-12 rounded-full bg-sky-700 px-6 text-white hover:bg-sky-800">
                    {t("publicModels.searchModels")}
                    <Search className="h-4 w-4" />
                  </Button>
                </a>
                <Link to={isAuthenticated ? ROUTES.USER_KEYS : ROUTES.USER_REGISTER}>
                  <Button size="lg" variant="outline" className="h-12 rounded-full border-slate-300 bg-white px-6 dark:border-slate-700 dark:bg-slate-900">
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
                <Card key={key} className="gap-0 rounded-lg border-slate-200 bg-slate-50 shadow-none dark:border-slate-800 dark:bg-slate-900/70">
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t(`publicModels.stats.${key}`)}
                      </div>
                      <div className="mt-1 text-3xl font-semibold tabular-nums">
                        {isLoading ? "-" : value}
                      </div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm dark:bg-slate-950 dark:text-sky-300">
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="model-catalog" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-sky-700 dark:text-sky-300">
                {t("publicModels.catalogEyebrow")}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("publicModels.catalogTitle")}
              </h2>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
              {t("publicModels.results", { count: filteredModels.length })}
            </div>
          </div>

          <Card className="mb-5 gap-0 rounded-lg border-slate-200 bg-white py-0 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_180px_160px_auto]">
                <div className="relative">
                  <label className="sr-only" htmlFor="public-model-search">
                    {t("publicModels.searchLabel")}
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="public-model-search"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder={t("publicModels.searchPlaceholder")}
                    className="h-11 rounded-lg border-slate-200 bg-white pl-10 shadow-none dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>

                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
                  <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
                  <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
                  className="h-11 rounded-lg border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
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
                    "h-9 shrink-0 rounded-full border-slate-200 px-3 shadow-none dark:border-slate-800",
                    capabilityFilter === ALL_VALUE && "border-sky-700 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
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
                      "h-9 shrink-0 rounded-full border-slate-200 px-3 shadow-none dark:border-slate-800",
                      capabilityFilter === capability && "border-sky-700 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
                    )}
                    onClick={() => setCapabilityFilter(capability)}
                  >
                    {t(`portal.models.capability.${capability}`)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60 lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-3">{t("publicModels.table.model")}</TableHead>
                  <TableHead className="px-4 py-3">{t("publicModels.table.provider")}</TableHead>
                  <TableHead className="px-4 py-3">{t("publicModels.table.capabilities")}</TableHead>
                  <TableHead className="px-4 py-3">{t("publicModels.table.context")}</TableHead>
                  <TableHead className="px-4 py-3">{t("publicModels.table.input")}</TableHead>
                  <TableHead className="px-4 py-3">{t("publicModels.table.output")}</TableHead>
                  <TableHead className="px-4 py-3 text-right">{t("publicModels.table.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell className="px-4 py-4" colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      {t("publicModels.loadError")}
                    </TableCell>
                  </TableRow>
                ) : filteredModels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      {t("publicModels.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredModels.map((model) => (
                    <TableRow key={model.model} id={encodeURIComponent(model.model)}>
                      <TableCell className="max-w-[320px] px-4 py-4">
                        <div className="space-y-1">
                          <div className="break-words font-medium text-slate-950 dark:text-white">
                            {model.model}
                          </div>
                          <div className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {model.description || t("publicModels.defaultDescription")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">{model.provider}</TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex max-w-[280px] flex-wrap gap-1.5">
                          {(model.capabilities || []).slice(0, 4).map((capability) => (
                            <Badge key={capability} variant="outline" className="rounded-full border-slate-200 px-2 font-normal dark:border-slate-700">
                              {t(`portal.models.capability.${capability}`)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 font-mono text-sm">
                        {formatContextLength(model.context_length)}
                      </TableCell>
                      <TableCell className="px-4 py-4 font-mono text-sm">
                        {getInputPrice(model) || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-4 font-mono text-sm">
                        {getOutputPrice(model) || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-lg"
                            aria-label={`${t("publicModels.copyModelId")}: ${model.model}`}
                            onClick={() => copyModelId(model.model)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Link to={isAuthenticated ? ROUTES.USER_KEYS : ROUTES.USER_REGISTER}>
                            <Button size="sm" className="h-9 rounded-lg bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">
                              {t("publicModels.startUsing")}
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-[178px] rounded-lg" />
              ))
            ) : isError ? (
              <Card className="rounded-lg border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="p-6 text-center text-sm text-slate-500">
                  {t("publicModels.loadError")}
                </CardContent>
              </Card>
            ) : filteredModels.length === 0 ? (
              <Card className="rounded-lg border-slate-200 bg-white shadow-none dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="p-6 text-center text-sm text-slate-500">
                  {t("publicModels.empty")}
                </CardContent>
              </Card>
            ) : (
              filteredModels.map((model) => (
                <Card key={model.model} className="gap-0 rounded-lg border-slate-200 bg-white py-0 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words font-semibold">{model.model}</div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {model.provider} · {formatContextLength(model.context_length)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0 rounded-lg"
                        aria-label={`${t("publicModels.copyModelId")}: ${model.model}`}
                        onClick={() => copyModelId(model.model)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(model.capabilities || []).slice(0, 5).map((capability) => (
                        <Badge key={capability} variant="outline" className="rounded-full border-slate-200 px-2 font-normal dark:border-slate-700">
                          {t(`portal.models.capability.${capability}`)}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                        <div className="text-xs text-slate-500">{t("publicModels.table.input")}</div>
                        <div className="mt-1 font-mono">{getInputPrice(model) || "-"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                        <div className="text-xs text-slate-500">{t("publicModels.table.output")}</div>
                        <div className="mt-1 font-mono">{getOutputPrice(model) || "-"}</div>
                      </div>
                    </div>
                    <Link to={isAuthenticated ? ROUTES.USER_KEYS : ROUTES.USER_REGISTER}>
                      <Button className="h-10 w-full rounded-lg bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">
                        {t("publicModels.startUsing")}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="space-y-4">
              <Badge variant="outline" className="rounded-full border-slate-200 dark:border-slate-700">
                <Code2 className="h-3.5 w-3.5" />
                {t("publicModels.apiExample.badge")}
              </Badge>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("publicModels.apiExample.title")}
              </h2>
              <p className="leading-7 text-slate-600 dark:text-slate-300">
                {t("publicModels.apiExample.description")}
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-2xl">
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
              <pre className="overflow-x-auto p-5 text-sm leading-7 text-slate-200">
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

      <footer className="border-t border-slate-200 py-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
