import {
  ChevronDown,
  Folder,
  Layers3,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ModelCatalogCard } from "@/feature/model-catalog/components/ModelCatalogCard";
import { usePublicModels } from "@/feature/public-models/hooks";
import { useUserPortalGroups } from "@/feature/user-portal/hooks";
import type { ModelPrice } from "@/types/model";
import type { PublicModel } from "@/types/public-model";
import type { UserPortalGroupModelOption } from "@/types/user-portal";
import { cn } from "@/lib/utils";
import {
  buildImagePriceEntries,
  formatPriceNumber,
  formatPriceValue,
  formatTokenPriceValue,
  hasPriceData,
  inferCapabilities,
  sortCapabilities,
} from "@/lib/model-catalog";

const ALL_VALUE = "__all__";
const EMPTY_CATEGORY_VALUE = "__empty__";

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
  category?: string;
  contextLength?: number;
  description?: string;
  healthScore?: number;
  model: string;
  publicModel?: PublicModel;
}

const formatRequestPriceValue = (
  price: number | undefined,
  unitLabel: string,
) => {
  if (price == null || price === 0) {
    return null;
  }

  return `${formatPriceNumber(price)}/${unitLabel}`;
};

const getPriceMultiplierClassName = (multiplier: number) => {
  if (multiplier <= 1) {
    return "text-emerald-600 dark:text-emerald-400";
  }

  if (multiplier <= 1.5) {
    return "text-[#1456f0] dark:text-[#93c5fd]";
  }

  if (multiplier <= 2) {
    return "text-amber-600 dark:text-amber-300";
  }

  return "text-rose-600 dark:text-rose-400";
};

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

function useMediaQuery(query: string) {
  const getMatches = () => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

const getItemCategory = (item: ModelCardItem) => item.category?.trim() || "";

export default function UserPortalModelsPage() {
  const { t: rawT } = useTranslation();
  const t = rawT as (key: string, options?: Record<string, unknown>) => string;
  const [keyword, setKeyword] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState(ALL_VALUE);
  const [categoryFilter, setCategoryFilter] = useState(ALL_VALUE);
  const [groupFilter, setGroupFilter] = useState(ALL_VALUE);
  const [selectedModel, setSelectedModel] = useState<ModelCardItem | null>(
    null,
  );
  const [selectedPricingGroup, setSelectedPricingGroup] = useState("");
  const [isModelDescriptionOpen, setIsModelDescriptionOpen] = useState(true);
  const isMobileDetailDialog = useMediaQuery("(max-width: 639px)");
  const { data, isLoading } = useUserPortalGroups(true);
  const { data: publicModelsData } = usePublicModels();
  const groups = data?.groups || [];
  const publicModelMap = useMemo(
    () =>
      new Map(
        (publicModelsData?.models || []).map((model) => [
          model.model.toLowerCase(),
          model,
        ]),
      ),
    [publicModelsData?.models],
  );
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
        const publicModel = publicModelMap.get(model.toLowerCase());
        const modelDetail = modelDetailMap.get(model.toLowerCase());
        const current = groupedModels.get(model) || {
          model,
          capabilities: publicModel?.capabilities?.length
            ? publicModel.capabilities
            : inferCapabilities(model),
          category: publicModel?.category || modelDetail?.category,
          contextLength: publicModel?.context_length,
          description: publicModel?.description,
          healthScore: publicModel?.health?.health_percent,
          publicModel,
          accessGroups: [],
        };

        if (!current.category && modelDetail?.category) {
          current.category = modelDetail.category;
        }

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
  }, [groups, publicModelMap]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(modelCards.map(getItemCategory).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right));
    const hasEmptyCategory = modelCards.some((item) => !getItemCategory(item));

    return hasEmptyCategory ? [...categories, EMPTY_CATEGORY_VALUE] : categories;
  }, [modelCards]);

  const capabilityOptions = useMemo(
    () =>
      sortCapabilities(
        Array.from(new Set(modelCards.flatMap((item) => item.capabilities))),
      ),
    [modelCards],
  );

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
    if (groupFilter === ALL_VALUE) {
      return getBaseAccessGroup(item);
    }

    return (
      item.accessGroups.find((group) => hasPriceData(group)) ||
      item.accessGroups[0]
    );
  };

  const getPreviewInputPrice = (item: ModelCardItem) => {
    const accessGroup = getPreviewAccessGroup(item);
    const price = accessGroup?.price;

    return (
      formatTokenPriceValue(price?.input_price, price?.input_price_unit) ||
      formatTokenPriceValue(
        price?.image_input_price,
        price?.image_input_price_unit,
      ) ||
      formatTokenPriceValue(
        price?.audio_input_price,
        price?.audio_input_price_unit,
      )
    );
  };

  const getPreviewOutputPrice = (item: ModelCardItem) => {
    const accessGroup = getPreviewAccessGroup(item);
    const price = accessGroup?.price;

    return (
      formatTokenPriceValue(price?.output_price, price?.output_price_unit) ||
      formatRequestPriceValue(
        price?.output_request_price,
        t("portal.models.perRequestUnit"),
      ) ||
      formatTokenPriceValue(
        price?.image_output_price,
        price?.image_output_price_unit,
      ) ||
      formatTokenPriceValue(
        price?.thinking_mode_output_price,
        price?.thinking_mode_output_price_unit,
      ) ||
      buildImagePriceEntries(
        accessGroup?.imagePrices,
        accessGroup?.imageQualityPrices,
      )[0]?.value
    );
  };

  const copyModelId = async (model: string) => {
    try {
      await navigator.clipboard.writeText(model);
      toast.success(t("publicModels.copied"));
    } catch {
      toast.error(t("publicModels.copyFailed"));
    }
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
          groupFilter === ALL_VALUE
            ? item.accessGroups
            : item.accessGroups.filter((group) => group.group === groupFilter),
      }))
      .filter((item) => item.accessGroups.length > 0)
      .filter((item) => {
        if (categoryFilter === ALL_VALUE) {
          return true;
        }
        if (categoryFilter === EMPTY_CATEGORY_VALUE) {
          return !getItemCategory(item);
        }
        return getItemCategory(item) === categoryFilter;
      })
      .filter(
        (item) =>
          capabilityFilter === ALL_VALUE ||
          item.capabilities.includes(capabilityFilter),
      )
      .filter((item) => {
        if (!normalizedKeyword) {
          return true;
        }

        return (
          item.model.toLowerCase().includes(normalizedKeyword) ||
          getItemCategory(item).toLowerCase().includes(normalizedKeyword) ||
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
  }, [capabilityFilter, categoryFilter, groupFilter, keyword, modelCards, t]);

  const hasActiveFilters =
    keyword.trim().length > 0 ||
    capabilityFilter !== ALL_VALUE ||
    categoryFilter !== ALL_VALUE ||
    groupFilter !== ALL_VALUE;
  const resetFilters = () => {
    setKeyword("");
    setCapabilityFilter(ALL_VALUE);
    setCategoryFilter(ALL_VALUE);
    setGroupFilter(ALL_VALUE);
  };

  const openModelDetails = (item: ModelCardItem) => {
    setSelectedModel(item);
    setSelectedPricingGroup(item.accessGroups[0]?.group || "");
    setIsModelDescriptionOpen(true);
  };

  const closeModelDetails = () => {
    setSelectedModel(null);
    setSelectedPricingGroup("");
    setIsModelDescriptionOpen(true);
  };

  const renderModelDetails = (model: ModelCardItem) => (
    <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
      <section>
        <div className="divide-y divide-border/50 overflow-hidden rounded-md bg-muted/20 dark:bg-white/[0.02]">
          <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 px-3.5 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:px-4">
            <div className="text-sm text-muted-foreground">
              {t("portal.models.categoryFilter")}
            </div>
            <div className="min-w-0 text-right text-sm font-medium text-foreground sm:text-left">
              {getItemCategory(model) || t("portal.models.uncategorized")}
            </div>
          </div>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 px-3.5 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:px-4">
            <div className="text-sm text-muted-foreground">
              {t("portal.models.billingType")}
            </div>
            <div className="flex min-w-0 justify-end sm:justify-start">
              <Badge className="rounded-md px-2.5 py-1">
                {t("portal.models.usageBilling")}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3 px-3.5 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:px-4">
            <div className="pt-0.5 text-sm text-muted-foreground">
              {t("portal.models.capabilities")}
            </div>
            <div className="flex min-w-0 flex-wrap justify-end gap-1.5 sm:justify-start">
              {model.capabilities.map((capability) => (
                <Badge
                  key={`${model.model}-sheet-${capability}`}
                  variant="outline"
                  className="rounded-md bg-background px-2 py-0.5"
                >
                  {t(`portal.models.capability.${capability}`)}
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 px-3.5 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:px-4">
            <div className="text-sm text-muted-foreground">
              {t("publicModels.table.context")}
            </div>
            <div className="min-w-0 text-right font-mono text-sm font-medium text-foreground tabular-nums sm:text-left">
              {formatContextLength(model.contextLength)}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-base font-semibold">
          {t("portal.models.groupPricing")}
        </div>
        <Tabs
          value={selectedPricingGroup || model.accessGroups[0]?.group}
          onValueChange={setSelectedPricingGroup}
          className="space-y-2"
        >
          <TabsList className="h-10 w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border/70 bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {model.accessGroups.map((group) => (
              <TabsTrigger
                key={`${model.model}-tab-${group.group}`}
                value={group.group}
                className="relative h-10 shrink-0 rounded-none bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-transparent after:content-[''] data-[state=active]:bg-transparent data-[state=active]:text-[#1456f0] data-[state=active]:shadow-none data-[state=active]:after:bg-[#1456f0] dark:data-[state=active]:text-[#93c5fd] dark:data-[state=active]:after:bg-[#60a5fa]"
              >
                <span className="max-w-[148px] truncate">
                  {group.group}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {model.accessGroups.map((group) => {
            const pricing = getGroupPricingTableData(group);
            const primaryPriceItems = [
              {
                label: t("portal.models.priceMultiplier"),
                value: `x ${group.priceMultiplier.toFixed(2)}`,
                valueClassName: getPriceMultiplierClassName(
                  group.priceMultiplier,
                ),
              },
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
                entry.value && entry.value !== t("portal.models.noPrice"),
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
                entry.value && entry.value !== t("portal.models.noPrice"),
            );

            return (
              <TabsContent
                key={`${model.model}-content-${group.group}`}
                value={group.group}
                className="m-0 space-y-2"
              >
                <div className="space-y-1 overflow-hidden rounded-lg bg-background/70 px-3 py-2">
                  <div className="pb-1 text-xs leading-4 text-muted-foreground">
                    {group.description?.trim() || group.group}
                  </div>
                  {primaryPriceItems.length > 0 ? (
                    primaryPriceItems.map((entry) => (
                      <div
                        key={`${model.model}-${group.group}-${entry.label}`}
                        className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-1.5 sm:grid-cols-[120px_minmax(0,1fr)]"
                      >
                        <div className="text-xs text-muted-foreground">
                          {entry.label}
                        </div>
                        <div
                          className={cn(
                            "min-w-0 text-right font-mono text-sm font-normal text-foreground tabular-nums",
                            entry.valueClassName,
                          )}
                        >
                          {entry.value}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2.5 text-center text-sm text-muted-foreground">
                      {t("portal.models.noPrice")}
                    </div>
                  )}
                </div>

                {secondaryPriceItems.length > 0 && (
                  <div className="space-y-1 rounded-lg bg-background/70 px-3 py-2">
                    {secondaryPriceItems.map((entry) => (
                      <div
                        key={`${model.model}-${group.group}-${entry.label}`}
                        className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-1.5 sm:grid-cols-[120px_minmax(0,1fr)]"
                      >
                        <span className="text-xs text-muted-foreground">
                          {entry.label}
                        </span>
                        <span className="min-w-0 text-right font-mono text-sm font-normal text-foreground tabular-nums">
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
  );

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <Card className="gap-0 overflow-hidden border-0 bg-muted/25 shadow-none dark:bg-white/[0.03]">
        <CardContent className="space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
          <div className="flex w-full flex-wrap items-center gap-2">
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

          <div className="relative w-full sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t("portal.models.searchPlaceholder")}
              className="h-11 rounded-md border-border bg-background pl-10 shadow-none"
            />
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <div className="min-w-0 flex-1">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 rounded-md border-border bg-background text-sm shadow-none">
                  <SelectValue placeholder={t("portal.models.categoryFilter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("common.all")}</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === EMPTY_CATEGORY_VALUE
                        ? t("portal.models.uncategorized")
                        : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="h-10 rounded-md border-border bg-background text-sm shadow-none">
                  <SelectValue
                    placeholder={t("portal.models.groupFilterLabel")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("common.all")}</SelectItem>
                  {groupItems.map((group) => (
                    <SelectItem key={group.group} value={group.group}>
                      {group.group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="hidden space-y-5 sm:block">
            <FilterSection
              icon={Folder}
              label={t("portal.models.categoryFilter")}
            >
              <FilterChip
                active={categoryFilter === ALL_VALUE}
                onClick={() => setCategoryFilter(ALL_VALUE)}
              >
                {t("common.all")}
              </FilterChip>
              {categoryOptions.map((category) => (
                <FilterChip
                  key={category}
                  active={categoryFilter === category}
                  onClick={() => setCategoryFilter(category)}
                >
                  {category === EMPTY_CATEGORY_VALUE
                    ? t("portal.models.uncategorized")
                    : category}
                </FilterChip>
              ))}
            </FilterSection>

            <FilterSection
              icon={Sparkles}
              label={t("portal.models.capabilities")}
            >
              <FilterChip
                active={capabilityFilter === ALL_VALUE}
                onClick={() => setCapabilityFilter(ALL_VALUE)}
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
                active={groupFilter === ALL_VALUE}
                onClick={() => setGroupFilter(ALL_VALUE)}
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
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {isLoading ? (
          <>
            <Skeleton className="h-[190px] rounded-[16px] sm:h-[286px] sm:rounded-[20px]" />
            <Skeleton className="h-[190px] rounded-[16px] sm:h-[286px] sm:rounded-[20px]" />
            <Skeleton className="h-[190px] rounded-[16px] sm:h-[286px] sm:rounded-[20px]" />
            <Skeleton className="h-[190px] rounded-[16px] sm:h-[286px] sm:rounded-[20px]" />
            <Skeleton className="h-[190px] rounded-[16px] sm:h-[286px] sm:rounded-[20px]" />
          </>
        ) : filteredModels.length > 0 ? (
          filteredModels.map((item) => (
            <ModelCatalogCard
              key={item.model}
              ariaLabel={`${t("portal.models.openDetails")}: ${item.model}`}
              capabilityLabel={(capability) =>
                t(`portal.models.capability.${capability}`)
              }
              contextLabel={t("publicModels.table.context")}
              copyAriaLabel={`${t("publicModels.copyModelId")}: ${item.model}`}
              defaultDescription={t("publicModels.defaultDescription")}
              freePriceLabel={t("publicModels.freePrice")}
              healthLabel={t("publicModels.health")}
              inputLabel={t("publicModels.table.input")}
              model={{
                capabilities: item.capabilities || [],
                contextLength: item.contextLength,
                description: item.description,
                healthScore: item.healthScore,
                inputPrice: getPreviewInputPrice(item),
                model: item.model,
                outputPrice: getPreviewOutputPrice(item),
                category:
                  getItemCategory(item) || t("portal.models.uncategorized"),
              }}
              onCopy={copyModelId}
              onOpen={() => openModelDetails(item)}
              outputLabel={t("publicModels.table.output")}
              unmonitoredLabel={t("publicModels.unmonitored")}
            />
          ))
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

      {isMobileDetailDialog ? (
        <Dialog
          open={!!selectedModel}
          onOpenChange={(open) => !open && closeModelDetails()}
        >
          <DialogContent className="flex max-h-[86vh] w-[calc(100%-2rem)] max-w-[420px] grid-rows-none flex-col gap-0 overflow-hidden rounded-[18px] border border-border/80 p-0 shadow-[0_18px_60px_rgba(15,23,42,0.24)] ring-1 ring-black/5 dark:border-white/15 dark:shadow-[0_24px_80px_rgba(0,0,0,0.72)] dark:ring-white/10">
            {selectedModel && (
              <>
                <DialogHeader className="relative gap-1 border-b border-border/60 px-4 py-4 pr-12 text-left">
                  <DialogTitle className="break-all text-lg tracking-tight">
                    {selectedModel.model}
                  </DialogTitle>
                  <DialogDescription
                    className={cn(
                      "leading-5",
                      !isModelDescriptionOpen && "line-clamp-2",
                    )}
                  >
                    {selectedModel.description ||
                      t("publicModels.defaultDescription")}
                  </DialogDescription>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-12 h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setIsModelDescriptionOpen((current) => !current)
                    }
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isModelDescriptionOpen && "rotate-180",
                      )}
                    />
                    <span className="sr-only">
                      {isModelDescriptionOpen ? "隐藏模型介绍" : "展开模型介绍"}
                    </span>
                  </Button>
                </DialogHeader>
                {renderModelDetails(selectedModel)}
              </>
            )}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet
          open={!!selectedModel}
          onOpenChange={(open) => !open && closeModelDetails()}
        >
          <SheetContent
            side="right"
            className="w-full max-w-none gap-0 p-0 sm:max-w-3xl"
          >
            {selectedModel && (
              <>
                <SheetHeader className="relative gap-1 border-b border-border/60 px-4 py-4 pr-12 sm:px-6 sm:py-5 sm:pr-14">
                  <SheetTitle className="break-all text-xl tracking-tight sm:text-2xl">
                    {selectedModel.model}
                  </SheetTitle>
                  <SheetDescription
                    className={cn(
                      "leading-5",
                      !isModelDescriptionOpen && "line-clamp-2",
                    )}
                  >
                    {selectedModel.description ||
                      t("publicModels.defaultDescription")}
                  </SheetDescription>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-12 h-6 w-6 rounded-full text-muted-foreground hover:text-foreground sm:top-14"
                    onClick={() =>
                      setIsModelDescriptionOpen((current) => !current)
                    }
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isModelDescriptionOpen && "rotate-180",
                      )}
                    />
                    <span className="sr-only">
                      {isModelDescriptionOpen ? "隐藏模型介绍" : "展开模型介绍"}
                    </span>
                  </Button>
                </SheetHeader>
                {renderModelDetails(selectedModel)}
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
