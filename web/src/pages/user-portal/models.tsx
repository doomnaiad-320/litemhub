import {
  Building2,
  Copy,
  Cpu,
  Info,
  Layers3,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { type ComponentType, type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserPortalGroups } from "@/feature/user-portal/hooks";
import type { ModelPrice } from "@/types/model";
import type { UserPortalGroupModelOption } from "@/types/user-portal";
import { cn } from "@/lib/utils";
import {
  buildImagePriceEntries,
  formatPriceNumber,
  formatPriceValue,
  formatTokenPriceValue,
  hasPriceData,
  inferCapabilities,
  inferProvider,
  sortCapabilities,
} from "@/lib/model-catalog";

interface ModelAccessGroup {
  availableSets: string[];
  description?: string;
  group: string;
  imagePrices?: Record<string, number>;
  imageQualityPrices?: Record<string, Record<string, number>>;
  price?: ModelPrice;
  priceMultiplier: number;
}

interface ModelCardItem {
  accessGroups: ModelAccessGroup[];
  capabilities: string[];
  model: string;
  provider: string;
}

const scalePriceNumber = (value: number | undefined, multiplier: number) => {
  if (value == null) {
    return undefined;
  }

  if (!multiplier || multiplier === 1) {
    return value;
  }

  return value / multiplier;
};

const scalePriceMap = (prices?: Record<string, number>, multiplier = 1) => {
  if (!prices || Object.keys(prices).length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(prices).map(([key, value]) => [
      key,
      scalePriceNumber(value, multiplier) || 0,
    ]),
  );
};

const scaleImageQualityPriceMap = (
  prices?: Record<string, Record<string, number>>,
  multiplier = 1,
) => {
  if (!prices || Object.keys(prices).length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(prices).map(([size, qualityPrices]) => [
      size,
      Object.fromEntries(
        Object.entries(qualityPrices).map(([quality, value]) => [
          quality,
          scalePriceNumber(value, multiplier) || 0,
        ]),
      ),
    ]),
  );
};

const scaleModelPrice = (
  price?: ModelPrice,
  multiplier = 1,
): ModelPrice | undefined => {
  if (!price) {
    return undefined;
  }

  return {
    ...price,
    input_price: scalePriceNumber(price.input_price, multiplier),
    output_price: scalePriceNumber(price.output_price, multiplier),
    input_request_price: scalePriceNumber(price.input_request_price, multiplier),
    output_request_price: scalePriceNumber(price.output_request_price, multiplier),
    cached_price: scalePriceNumber(price.cached_price, multiplier),
    cache_creation_price: scalePriceNumber(
      price.cache_creation_price,
      multiplier,
    ),
    image_input_price: scalePriceNumber(price.image_input_price, multiplier),
    image_output_price: scalePriceNumber(price.image_output_price, multiplier),
    audio_input_price: scalePriceNumber(price.audio_input_price, multiplier),
    thinking_mode_output_price: scalePriceNumber(
      price.thinking_mode_output_price,
      multiplier,
    ),
    web_search_price: scalePriceNumber(price.web_search_price, multiplier),
    conditional_prices: price.conditional_prices?.map((item) => ({
      condition: item.condition,
      price: scaleModelPrice(item.price, multiplier) || ({} as ModelPrice),
    })),
  };
};

interface FilterChipProps {
  active?: boolean;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}

function FilterChip({
  active = false,
  children,
  className,
  onClick,
}: FilterChipProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-9 shrink-0 rounded-md border-border bg-background px-3 text-sm font-normal shadow-none hover:bg-muted/40",
        active &&
          "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

interface FilterSectionProps {
  children: ReactNode;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

function FilterSection({ children, icon: Icon, label }: FilterSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {children}
      </div>
    </div>
  );
}

export default function UserPortalModelsPage() {
  const { t: rawT } = useTranslation();
  const t = rawT as (key: string, options?: Record<string, unknown>) => string;
  const [keyword, setKeyword] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState("__all__");
  const [providerFilter, setProviderFilter] = useState("__all__");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [selectedModel, setSelectedModel] = useState<ModelCardItem | null>(
    null,
  );
  const [selectedPricingGroup, setSelectedPricingGroup] = useState("");
  const { data, isLoading } = useUserPortalGroups(true);
  const groups = data?.groups || [];
  const groupItems = useMemo(
    () =>
      [...groups].sort((left, right) => left.group.localeCompare(right.group)),
    [groups],
  );

  const modelCards = useMemo<ModelCardItem[]>(() => {
    const groupedModels = new Map<string, ModelCardItem>();

    groups.forEach((group) => {
      const modelDetailMap = new Map<string, UserPortalGroupModelOption>(
        (group.model_details || []).map((detail) => [
          detail.model.toLowerCase(),
          detail,
        ]),
      );

      group.models.forEach((model) => {
        const current = groupedModels.get(model) || {
          model,
          capabilities: inferCapabilities(model),
          provider: inferProvider(model),
          accessGroups: [],
        };
        const modelDetail = modelDetailMap.get(model.toLowerCase());

        current.accessGroups.push({
          group: group.group,
          description: group.description,
          priceMultiplier: group.price_multiplier,
          availableSets: [...group.available_sets].sort((left, right) =>
            left.localeCompare(right),
          ),
          price: modelDetail?.price,
          imagePrices: modelDetail?.image_prices,
          imageQualityPrices: modelDetail?.image_quality_prices,
        });

        groupedModels.set(model, current);
      });
    });

    return Array.from(groupedModels.values())
      .map((item) => ({
        ...item,
        accessGroups: item.accessGroups.sort((left, right) => {
          if (left.priceMultiplier === right.priceMultiplier) {
            return left.group.localeCompare(right.group);
          }

          return left.priceMultiplier - right.priceMultiplier;
        }),
      }))
      .sort((left, right) => left.model.localeCompare(right.model));
  }, [groups]);

  const providerOptions = useMemo(
    () =>
      Array.from(new Set(modelCards.map((item) => item.provider))).sort(
        (left, right) => left.localeCompare(right),
      ),
    [modelCards],
  );

  const capabilityOptions = useMemo(
    () =>
      sortCapabilities(
        Array.from(new Set(modelCards.flatMap((item) => item.capabilities))),
      ),
    [modelCards],
  );

  const buildPriceEntries = (accessGroup?: ModelAccessGroup) => {
    if (!accessGroup) {
      return [];
    }

    const price = accessGroup.price;
    const entries: Array<{ label: string; value: string }> = [];

    const prioritizedCandidates: Array<{ key: string; value: string | null }> =
      [
        {
          key: "input",
          value: formatTokenPriceValue(
            price?.input_price,
            price?.input_price_unit,
          ),
        },
        {
          key: "output",
          value: formatTokenPriceValue(
            price?.output_price,
            price?.output_price_unit,
          ),
        },
        {
          key: "requestInput",
          value:
            price?.input_request_price != null
              ? formatPriceNumber(price.input_request_price)
              : null,
        },
        {
          key: "requestOutput",
          value:
            price?.output_request_price != null
              ? formatPriceNumber(price.output_request_price)
              : null,
        },
        {
          key: "imageInput",
          value: formatTokenPriceValue(
            price?.image_input_price,
            price?.image_input_price_unit,
          ),
        },
        {
          key: "imageOutput",
          value: formatTokenPriceValue(
            price?.image_output_price,
            price?.image_output_price_unit,
          ),
        },
        {
          key: "audioInput",
          value: formatTokenPriceValue(
            price?.audio_input_price,
            price?.audio_input_price_unit,
          ),
        },
      ];

    prioritizedCandidates.forEach((candidate) => {
      if (!candidate.value) {
        return;
      }

      entries.push({
        label: t(`portal.models.price.${candidate.key}`),
        value: candidate.value,
      });
    });

    if (entries.length > 0) {
      return entries;
    }

    return buildImagePriceEntries(
      accessGroup.imagePrices,
      accessGroup.imageQualityPrices,
    ).map((entry) => ({
      label: `${t("portal.models.price.imageSize")} ${entry.label}`,
      value: entry.value,
    }));
  };

  const getBaseAccessGroup = (item: ModelCardItem) => {
    const exactBase = item.accessGroups.find(
      (group) =>
        Math.abs(group.priceMultiplier - 1) < 0.0001 && hasPriceData(group),
    );
    if (exactBase) {
      return exactBase;
    }

    const pricedGroup = item.accessGroups.find((group) => hasPriceData(group));
    if (!pricedGroup) {
      return undefined;
    }

    return {
      ...pricedGroup,
      priceMultiplier: 1,
      price: scaleModelPrice(pricedGroup.price, pricedGroup.priceMultiplier),
      imagePrices: scalePriceMap(
        pricedGroup.imagePrices,
        pricedGroup.priceMultiplier,
      ),
      imageQualityPrices: scaleImageQualityPriceMap(
        pricedGroup.imageQualityPrices,
        pricedGroup.priceMultiplier,
      ),
    };
  };

  const getPreviewAccessGroup = (item: ModelCardItem) => {
    if (groupFilter === "__all__") {
      return getBaseAccessGroup(item);
    }

    return (
      item.accessGroups.find((group) => hasPriceData(group)) ||
      item.accessGroups[0]
    );
  };

  const getPreviewPriceEntries = (item: ModelCardItem) => {
    return buildPriceEntries(getPreviewAccessGroup(item));
  };

  const getGroupPricingTableData = (accessGroup: ModelAccessGroup) => {
    const price = accessGroup.price;
    const imageEntries = buildImagePriceEntries(
      accessGroup.imagePrices,
      accessGroup.imageQualityPrices,
    );
    const input =
      formatTokenPriceValue(price?.input_price, price?.input_price_unit) ||
      formatTokenPriceValue(
        price?.image_input_price,
        price?.image_input_price_unit,
      ) ||
      formatTokenPriceValue(
        price?.audio_input_price,
        price?.audio_input_price_unit,
      );

    let output =
      formatTokenPriceValue(price?.output_price, price?.output_price_unit) ||
      formatTokenPriceValue(
        price?.image_output_price,
        price?.image_output_price_unit,
      ) ||
      formatTokenPriceValue(
        price?.thinking_mode_output_price,
        price?.thinking_mode_output_price_unit,
      );

    const request =
      price?.output_request_price != null
        ? formatPriceNumber(price.output_request_price)
        : price?.input_request_price != null
          ? formatPriceNumber(price.input_request_price)
          : null;

    const extraEntries: Array<{ label: string; value: string }> = [];
    const extraCandidates: Array<{ key: string; value: string | null }> = [
      {
        key: "requestInput",
        value:
          price?.input_request_price != null &&
          price?.output_request_price != null
            ? formatPriceNumber(price.input_request_price)
            : null,
      },
      {
        key: "requestOutput",
        value:
          price?.output_request_price != null &&
          price?.input_request_price != null
            ? formatPriceNumber(price.output_request_price)
            : null,
      },
      {
        key: "cached",
        value: formatTokenPriceValue(
          price?.cached_price,
          price?.cached_price_unit,
        ),
      },
      {
        key: "cacheCreate",
        value: formatTokenPriceValue(
          price?.cache_creation_price,
          price?.cache_creation_price_unit,
        ),
      },
      {
        key: "webSearch",
        value: formatPriceValue(
          price?.web_search_price,
          price?.web_search_price_unit,
        ),
      },
    ];

    extraCandidates.forEach((candidate) => {
      if (!candidate.value) {
        return;
      }

      extraEntries.push({
        label: t(`portal.models.price.${candidate.key}`),
        value: candidate.value,
      });
    });

    if (!output && imageEntries.length > 0) {
      output = imageEntries[0].value;
      extraEntries.push(...imageEntries.slice(1));
    } else if (imageEntries.length > 0) {
      extraEntries.push(...imageEntries);
    }

    return {
      input: input || t("portal.models.noPrice"),
      output: output || t("portal.models.noPrice"),
      request: request || t("portal.models.noPrice"),
      extras: extraEntries,
    };
  };

  const filteredModels = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return modelCards
      .map((item) => ({
        ...item,
        accessGroups:
          groupFilter === "__all__"
            ? item.accessGroups
            : item.accessGroups.filter((group) => group.group === groupFilter),
      }))
      .filter((item) => item.accessGroups.length > 0)
      .filter(
        (item) =>
          providerFilter === "__all__" || item.provider === providerFilter,
      )
      .filter(
        (item) =>
          capabilityFilter === "__all__" ||
          item.capabilities.includes(capabilityFilter),
      )
      .filter((item) => {
        if (!normalizedKeyword) {
          return true;
        }

        return (
          item.model.toLowerCase().includes(normalizedKeyword) ||
          item.provider.toLowerCase().includes(normalizedKeyword) ||
          item.capabilities.some(
            (capability) =>
              capability.toLowerCase().includes(normalizedKeyword) ||
              t(`portal.models.capability.${capability}`)
                .toLowerCase()
                .includes(normalizedKeyword),
          ) ||
          item.accessGroups.some(
            (group) =>
              group.group.toLowerCase().includes(normalizedKeyword) ||
              group.availableSets.some((setName) =>
                setName.toLowerCase().includes(normalizedKeyword),
              ),
          )
        );
      });
  }, [capabilityFilter, groupFilter, keyword, modelCards, providerFilter, t]);

  const hasActiveFilters =
    keyword.trim().length > 0 ||
    capabilityFilter !== "__all__" ||
    providerFilter !== "__all__" ||
    groupFilter !== "__all__";
  const resetFilters = () => {
    setKeyword("");
    setCapabilityFilter("__all__");
    setProviderFilter("__all__");
    setGroupFilter("__all__");
  };

  const openModelDetails = (item: ModelCardItem) => {
    setSelectedModel(item);
    setSelectedPricingGroup(item.accessGroups[0]?.group || "");
  };

  const closeModelDetails = () => {
    setSelectedModel(null);
    setSelectedPricingGroup("");
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <Card className="gap-0 overflow-hidden rounded-md border-border bg-background shadow-none">
        <CardContent className="space-y-5 px-4 py-4 sm:space-y-7 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="relative w-full sm:max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t("portal.models.searchPlaceholder")}
                className="h-11 rounded-md border-border bg-background pl-10 shadow-none"
              />
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:self-end xl:self-auto">
              <Badge
                variant="outline"
                className="rounded-md px-3 py-1 text-xs"
              >
                {t("portal.models.results", { count: filteredModels.length })}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-md px-3 py-1 text-xs"
              >
                {t("portal.models.totalModels")}: {modelCards.length}
              </Badge>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-md border-border px-3 sm:h-10 sm:px-4"
                  onClick={resetFilters}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  {t("portal.models.resetFilters")}
                </Button>
              )}
            </div>
          </div>

          <FilterSection
            icon={Building2}
            label={t("portal.models.providerFilter")}
          >
            <FilterChip
              active={providerFilter === "__all__"}
              onClick={() => setProviderFilter("__all__")}
            >
              {t("common.all")}
            </FilterChip>
            {providerOptions.map((provider) => (
              <FilterChip
                key={provider}
                active={providerFilter === provider}
                onClick={() => setProviderFilter(provider)}
              >
                {provider}
              </FilterChip>
            ))}
          </FilterSection>

          <FilterSection
            icon={Sparkles}
            label={t("portal.models.capabilities")}
          >
            <FilterChip
              active={capabilityFilter === "__all__"}
              onClick={() => setCapabilityFilter("__all__")}
            >
              {t("common.all")}
            </FilterChip>
            {capabilityOptions.map((capability) => (
              <FilterChip
                key={capability}
                active={capabilityFilter === capability}
                onClick={() => setCapabilityFilter(capability)}
              >
                {t(`portal.models.capability.${capability}`)}
              </FilterChip>
            ))}
          </FilterSection>

          <FilterSection
            icon={Layers3}
            label={t("portal.models.groupFilterLabel")}
          >
            <FilterChip
              active={groupFilter === "__all__"}
              onClick={() => setGroupFilter("__all__")}
            >
              {t("common.all")}
            </FilterChip>
            <TooltipProvider delayDuration={200}>
              {groupItems.map((group) => {
                const description = group.description?.trim();
                const chip = (
                  <FilterChip
                    active={groupFilter === group.group}
                    className="h-10 px-3"
                    onClick={() => setGroupFilter(group.group)}
                  >
                    <span className="flex items-center gap-2">
                      <span>{group.group}</span>
                      <span
                        className={cn(
                          "rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground",
                          groupFilter === group.group &&
                            "bg-primary/15 text-primary",
                        )}
                      >
                        {group.models.length}
                      </span>
                      <span
                        className={cn(
                          "rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
                          groupFilter === group.group &&
                            "bg-primary/15 text-primary",
                        )}
                      >
                        x{group.price_multiplier.toFixed(2)}
                      </span>
                    </span>
                  </FilterChip>
                );

                if (!description) {
                  return <span key={group.group}>{chip}</span>;
                }

                return (
                  <Tooltip key={group.group}>
                    <TooltipTrigger asChild>
                      <span>{chip}</span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-72 bg-slate-950 px-3 py-2 text-left text-xs leading-5 text-white dark:bg-slate-100 dark:text-slate-950"
                    >
                      {description}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </FilterSection>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {isLoading ? (
          <>
            <Skeleton className="h-[136px] rounded-md" />
            <Skeleton className="h-[136px] rounded-md" />
            <Skeleton className="h-[136px] rounded-md" />
            <Skeleton className="h-[136px] rounded-md" />
            <Skeleton className="h-[136px] rounded-md" />
          </>
        ) : filteredModels.length > 0 ? (
          filteredModels.map((item) => {
            const priceEntries = getPreviewPriceEntries(item);
            const inputEntry = priceEntries.find(
              (entry) => entry.label === t("portal.models.price.input"),
            );
            const outputEntry = priceEntries.find(
              (entry) => entry.label === t("portal.models.price.output"),
            );
            const requestEntry = priceEntries.find(
              (entry) => entry.label === t("portal.models.price.request"),
            );
            const fallbackEntries = priceEntries.filter(
              (entry) => entry !== inputEntry && entry !== outputEntry,
            );
            const primaryEntry = inputEntry || fallbackEntries[0];
            const secondaryEntry =
              outputEntry ||
              (primaryEntry === fallbackEntries[0]
                ? fallbackEntries[1]
                : fallbackEntries[0]);
            const extractNumber = (value?: string) =>
              value ? value.split("/")[0].trim() : null;
            const primaryValue = extractNumber(primaryEntry?.value);
            const secondaryValue = extractNumber(secondaryEntry?.value);
            const requestValue = requestEntry?.value;
            const tokenPriceParts = [
              inputEntry && primaryValue
                ? `${t("portal.models.price.input")} ${primaryValue}`
                : null,
              outputEntry && secondaryValue
                ? `${t("portal.models.price.output")} ${secondaryValue}`
                : null,
            ].filter(Boolean);
            const fallbackPriceText =
              tokenPriceParts.length === 0 && primaryEntry
                ? `${primaryEntry.label} ${primaryEntry.value}`
                : null;
            const priceSummary = [
              tokenPriceParts.length > 0
                ? `${tokenPriceParts.join(" · ")} / ${t("portal.models.tokenUnitShort")}`
                : fallbackPriceText,
              requestValue
                ? `${t("portal.models.price.request")} ${requestValue} / ${t("portal.models.perRequestUnit")}`
                : null,
            ]
              .filter(Boolean)
              .join(` ${t("portal.models.priceOr")} `);
            const previewCapabilities = item.capabilities.slice(0, 2);
            const hiddenCapabilityCount = Math.max(
              0,
              item.capabilities.length - previewCapabilities.length,
            );
            const descriptionCapabilities = item.capabilities
              .slice(0, 3)
              .map((capability) => t(`portal.models.capability.${capability}`))
              .join(" / ");

            return (
              <div
                key={item.model}
                role="button"
                tabIndex={0}
                aria-label={`${t("portal.models.openDetails")}: ${item.model}`}
                className="group relative flex min-h-[126px] cursor-pointer flex-col overflow-hidden rounded-md border border-border bg-background p-3.5 shadow-none transition-colors duration-200 hover:border-primary/35 hover:bg-muted/20 dark:bg-background sm:min-h-[136px] sm:p-4"
                onClick={() => openModelDetails(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openModelDetails(item);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                    <Cpu className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-start gap-1.5">
                      <div
                        className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground"
                        title={item.model}
                      >
                        {item.model}
                      </div>
                      <button
                        type="button"
                        className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground/70 opacity-70 transition-colors hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        aria-label={`${t("portal.models.copyModel")}: ${item.model}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void navigator.clipboard?.writeText(item.model);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div
                      className="line-clamp-1 break-all font-mono text-[12px] font-semibold tabular-nums text-foreground/90"
                      title={priceSummary || t("portal.models.noPrice")}
                    >
                      {priceSummary || t("portal.models.noPrice")}
                    </div>
                  </div>
                </div>

                <div className="mt-3 min-h-[32px] text-[12px] leading-4 text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {item.provider}
                  </span>
                  {descriptionCapabilities && (
                    <span> · {descriptionCapabilities}</span>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-6 items-center rounded-md border border-border/70 bg-muted/45 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary",
                      providerFilter === item.provider &&
                        "border-primary/35 bg-primary/10 text-primary",
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      setProviderFilter(item.provider);
                    }}
                  >
                    {item.provider}
                  </button>
                  {previewCapabilities.map((capability) => (
                    <button
                      key={`${item.model}-${capability}`}
                      type="button"
                      className={cn(
                        "inline-flex h-6 items-center rounded-md border border-border/70 bg-muted/45 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary",
                        capabilityFilter === capability &&
                          "border-primary/35 bg-primary/10 text-primary",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        setCapabilityFilter(capability);
                      }}
                    >
                      {t(`portal.models.capability.${capability}`)}
                    </button>
                  ))}
                  {hiddenCapabilityCount > 0 && (
                    <span className="inline-flex h-6 items-center rounded-md border border-dashed border-border/70 px-2 text-[11px] text-muted-foreground/80">
                      +{hiddenCapabilityCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <Card className="gap-0 rounded-md border-border bg-background shadow-none sm:col-span-2 lg:col-span-3 2xl:col-span-5">
            <CardContent className="flex min-h-44 flex-col items-center justify-center space-y-3 p-5 text-center sm:p-8">
              <div className="text-lg font-semibold">
                {t("portal.models.emptyTitle")}
              </div>
              <p className="max-w-xl text-sm text-muted-foreground">
                {t("portal.models.emptyDescription")}
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Sheet
        open={!!selectedModel}
        onOpenChange={(open) => !open && closeModelDetails()}
      >
        <SheetContent side="right" className="w-full max-w-none gap-0 p-0 sm:max-w-3xl">
          {selectedModel && (
            <>
              <SheetHeader className="border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5">
                <div className="space-y-1 pr-8">
                  <SheetTitle className="break-all text-xl tracking-tight sm:text-2xl">
                    {selectedModel.model}
                  </SheetTitle>
                  <SheetDescription>{selectedModel.provider}</SheetDescription>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
                <div className="space-y-5 sm:space-y-6">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <span>{t("portal.models.infoSection")}</span>
                    </div>
                    <div className="rounded-md border border-border bg-background p-4 sm:p-5">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            {t("portal.models.providerFilter")}
                          </div>
                          <div className="font-medium">
                            {selectedModel.provider}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            {t("portal.models.billingType")}
                          </div>
                          <Badge className="rounded-md px-2.5 py-1">
                            {t("portal.models.usageBilling")}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            {t("portal.models.accessGroups")}
                          </div>
                          <div className="font-medium">
                            {selectedModel.accessGroups.length}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {selectedModel.capabilities.map((capability) => (
                          <Badge
                            key={`${selectedModel.model}-sheet-${capability}`}
                            variant="outline"
                            className="rounded-md px-2 py-0.5"
                          >
                            {t(`portal.models.capability.${capability}`)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="text-base font-semibold">
                      {t("portal.models.groupPricing")}
                    </div>
                    <Tabs
                      value={
                        selectedPricingGroup ||
                        selectedModel.accessGroups[0]?.group
                      }
                      onValueChange={setSelectedPricingGroup}
                      className="overflow-hidden rounded-md border border-border bg-background"
                    >
                      <div className="flex flex-col border-b border-border/60 bg-muted/10 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <TabsList className="min-h-8 min-w-0 flex-1 justify-start gap-0 overflow-x-auto rounded-none bg-transparent px-0 py-[5px]">
                          {selectedModel.accessGroups.map((group) => (
                            <TabsTrigger
                              key={`${selectedModel.model}-tab-${group.group}`}
                              value={group.group}
                              className="h-8 shrink-0 rounded-none border-r border-border/60 bg-transparent px-2.5 text-[16px] font-normal shadow-none last:border-r-0 data-[state=active]:bg-background data-[state=active]:font-medium data-[state=active]:text-amber-700 data-[state=active]:shadow-none dark:data-[state=active]:text-amber-300"
                            >
                              {group.group}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {(() => {
                          const activeGroup =
                            selectedModel.accessGroups.find(
                              (group) => group.group === selectedPricingGroup,
                            ) || selectedModel.accessGroups[0];

                          if (!activeGroup) {
                            return null;
                          }

                          return (
                            <div className="shrink-0 border-t border-border/60 px-3 py-2 text-[14px] text-muted-foreground sm:border-l sm:border-t-0 sm:py-0">
                              {t("portal.models.priceMultiplier")}
                              <span className="ml-1 font-mono text-amber-700 tabular-nums dark:text-amber-300">
                                x {activeGroup.priceMultiplier.toFixed(2)}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      {selectedModel.accessGroups.map((group) => {
                        const pricing = getGroupPricingTableData(group);
                        const primaryPriceItems = [
                          {
                            label: t("portal.models.inputColumn"),
                            value: pricing.input,
                          },
                          {
                            label: t("portal.models.outputColumn"),
                            value: pricing.output,
                          },
                        ].filter(
                          (entry) =>
                            entry.value &&
                            entry.value !== t("portal.models.noPrice"),
                        );
                        const secondaryPriceItems = [
                          {
                            label: t("portal.models.requestColumn"),
                            value: pricing.request,
                          },
                          ...pricing.extras.map((entry) => ({
                            label: entry.label,
                            value: entry.value,
                          })),
                        ].filter(
                          (entry) =>
                            entry.value &&
                            entry.value !== t("portal.models.noPrice"),
                        );

                        return (
                          <TabsContent
                            key={`${selectedModel.model}-content-${group.group}`}
                            value={group.group}
                            className="m-0 space-y-2 px-3 py-2"
                          >
                            <div className="rounded-lg bg-background/70 px-2.5 py-2">
                              <div className="mb-2 text-xs leading-4 text-muted-foreground">
                                {group.description?.trim() || group.group}
                              </div>
                              {primaryPriceItems.length > 0 ? (
                                <div className="grid gap-2 md:grid-cols-2">
                                  {primaryPriceItems.map((entry, index) => (
                                    <div
                                      key={`${selectedModel.model}-${group.group}-${entry.label}`}
                                      className={cn(
                                        "space-y-1 text-center",
                                        index > 0 &&
                                          "md:border-l md:border-dashed md:border-border/60",
                                      )}
                                    >
                                      <div className="text-xs text-muted-foreground">
                                        {entry.label}
                                      </div>
                                      <div className="whitespace-nowrap font-mono text-sm font-normal text-foreground tabular-nums">
                                        {entry.value}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center text-sm text-muted-foreground">
                                  {t("portal.models.noPrice")}
                                </div>
                              )}
                            </div>

                            {secondaryPriceItems.length > 0 && (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                {secondaryPriceItems.map((entry) => (
                                  <div
                                    key={`${selectedModel.model}-${group.group}-${entry.label}`}
                                    className="flex items-baseline gap-1 whitespace-nowrap"
                                  >
                                    <span className="text-xs text-muted-foreground">
                                      {entry.label}:
                                    </span>
                                    <span className="font-mono text-xs font-normal text-foreground tabular-nums">
                                      {entry.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </section>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
