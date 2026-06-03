import { Copy } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ModelCatalogCardData {
  capabilities: string[];
  category?: string;
  contextLength?: number;
  description?: string;
  healthScore?: number;
  inputPrice?: string | null;
  model: string;
  outputPrice?: string | null;
}

interface ModelCatalogCardProps {
  ariaLabel: string;
  capabilityLabel: (capability: string) => string;
  className?: string;
  copyAriaLabel: string;
  defaultDescription: string;
  freePriceLabel: string;
  healthLabel: string;
  inputLabel: string;
  model: ModelCatalogCardData;
  onCopy: (model: string) => void;
  onOpen: () => void;
  outputLabel: string;
  unmonitoredLabel: string;
  contextLabel: string;
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

const getHealthToneClass = (score?: number) => {
  if (score == null) {
    return "border-[#d8dce3] bg-[#f8fafc] text-[#6b7280] dark:border-border dark:bg-muted dark:text-muted-foreground";
  }

  if (score >= 95) {
    return "border-[#24c37a]/25 bg-[#24c37a]/10 text-[#0f8f5f] dark:border-[#24c37a]/30 dark:bg-[#24c37a]/15 dark:text-[#6ee7ad]";
  }

  if (score >= 90) {
    return "border-[#d8951b]/30 bg-[#d8951b]/10 text-[#9a6400] dark:border-[#d8951b]/35 dark:bg-[#d8951b]/15 dark:text-[#f0c36a]";
  }

  return "border-[#dc2626]/25 bg-[#dc2626]/10 text-[#b91c1c] dark:border-[#ef4444]/35 dark:bg-[#ef4444]/15 dark:text-[#fca5a5]";
};

export function ModelCatalogCard({
  ariaLabel,
  capabilityLabel,
  className,
  contextLabel,
  copyAriaLabel,
  defaultDescription,
  freePriceLabel,
  healthLabel,
  inputLabel,
  model,
  onCopy,
  onOpen,
  outputLabel,
  unmonitoredLabel,
}: ModelCatalogCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.currentTarget !== event.target) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={cn(
        "group flex cursor-pointer flex-col rounded-[16px] bg-white p-3 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] transition duration-200 hover:-translate-y-0.5 hover:shadow-[rgba(44,30,116,0.16)_0px_0px_15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1456f0]/35 dark:bg-card dark:ring-border sm:rounded-[20px] sm:p-[10px]",
        className,
      )}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <button
          type="button"
          className="min-w-0 flex-1 break-words text-left font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[16px] font-normal leading-[1.25] text-[#18181b] transition hover:text-[#1456f0] dark:text-foreground dark:hover:text-primary sm:text-[18px]"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {model.model}
        </button>
        <button
          type="button"
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#8e8e93] transition hover:bg-[#f0f0f0] hover:text-[#18181b] active:scale-[0.96] dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
          aria-label={copyAriaLabel}
          onClick={(event) => {
            event.stopPropagation();
            onCopy(model.model);
          }}
        >
          <Copy className="h-3 w-3" strokeWidth={1.9} />
        </button>
      </div>

      <div className="mt-[13px] flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-[#45515e] dark:text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="text-[#8e8e93]">{inputLabel}</span>
          <span className="truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold text-[#18181b] dark:text-foreground">
            {model.inputPrice || freePriceLabel}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="text-[#8e8e93]">{outputLabel}</span>
          <span className="truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold text-[#18181b] dark:text-foreground">
            {model.outputPrice || "-"}
          </span>
        </span>
      </div>

      <p className="mt-[13px] line-clamp-2 text-sm leading-[1.6] text-[#45515e] dark:text-muted-foreground sm:mt-[17px] sm:leading-[1.7]">
        {model.description || defaultDescription}
      </p>

      <div className="mt-[17px] flex flex-wrap gap-1.5 text-[10px] sm:mt-[25px]">
        {model.category && (
          <Badge className="max-w-full rounded-full border-[#dbe4ff] bg-[#eef4ff] px-2.5 py-1 text-[10px] font-medium text-[#1456f0] shadow-none hover:bg-[#eef4ff] dark:border-[#60a5fa]/20 dark:bg-[#60a5fa]/10 dark:text-[#93c5fd]">
            <span className="max-w-[160px] truncate">{model.category}</span>
          </Badge>
        )}
        <Badge className="rounded-full border-[#e5e7eb] bg-white px-2.5 py-1 text-[10px] font-normal text-[#45515e] shadow-none hover:bg-white dark:border-border dark:bg-muted dark:text-muted-foreground">
          {contextLabel} {formatContextLength(model.contextLength)}
        </Badge>
        {(model.capabilities || []).slice(0, 5).map((capability) => (
          <Badge
            key={capability}
            variant="outline"
            className="rounded-full border-[#e5e7eb] bg-white px-2.5 py-1 text-[10px] font-normal text-[#45515e] dark:border-border dark:bg-muted dark:text-muted-foreground"
          >
            {capabilityLabel(capability)}
          </Badge>
        ))}
        <span
          className={cn(
            "ml-auto inline-flex h-6 items-center rounded-full border px-2.5 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-[10px] font-semibold tabular-nums",
            getHealthToneClass(model.healthScore),
          )}
        >
          {healthLabel}{" "}
          {model.healthScore == null ? unmonitoredLabel : `${model.healthScore}%`}
        </span>
      </div>
    </article>
  );
}
