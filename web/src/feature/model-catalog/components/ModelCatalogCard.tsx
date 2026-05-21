import { Copy } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ModelCatalogCardData {
  capabilities: string[];
  contextLength?: number;
  description?: string;
  healthScore?: number;
  inputPrice?: string | null;
  model: string;
  outputPrice?: string | null;
  provider: string;
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
  modelTitle?: ReactNode;
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
    return "border-[#d8dce3] bg-[#f8fafc] text-[#6b7280] dark:border-white/10 dark:bg-white/5 dark:text-white/60";
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
  modelTitle,
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
        "group flex cursor-pointer flex-col rounded-[16px] bg-white p-3 shadow-[rgba(0,0,0,0.08)_0px_4px_6px] ring-1 ring-[#f2f3f5] transition duration-200 hover:-translate-y-0.5 hover:shadow-[rgba(44,30,116,0.16)_0px_0px_15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1456f0]/35 dark:bg-white/5 dark:ring-white/10 sm:rounded-[20px] sm:p-[10px]",
        className,
      )}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
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
          aria-label={copyAriaLabel}
          onClick={(event) => {
            event.stopPropagation();
            onCopy(model.model);
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      {modelTitle || (
        <button
          type="button"
          className="break-words text-left font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[16px] font-normal leading-[1.25] text-[#18181b] transition hover:text-[#1456f0] dark:text-white sm:text-[18px]"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {model.model}
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-[#45515e] dark:text-white/70">
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full border px-2.5 font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] text-xs font-semibold tabular-nums",
            getHealthToneClass(model.healthScore),
          )}
        >
          {healthLabel}{" "}
          {model.healthScore == null ? unmonitoredLabel : `${model.healthScore}%`}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="text-[#8e8e93]">{inputLabel}</span>
          <span className="truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold text-[#18181b] dark:text-white">
            {model.inputPrice || freePriceLabel}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="text-[#8e8e93]">{outputLabel}</span>
          <span className="truncate font-['Roboto',_'Helvetica_Neue',_Arial,_sans-serif] font-semibold text-[#18181b] dark:text-white">
            {model.outputPrice || "-"}
          </span>
        </span>
      </div>

      <p className="mt-2 line-clamp-1 text-sm leading-[1.6] text-[#45515e] dark:text-white/70 sm:mt-3 sm:line-clamp-2 sm:leading-[1.7]">
        {model.description || defaultDescription}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-5">
        <Badge className="rounded-full border-[#1456f0]/20 bg-[#1456f0] px-2.5 py-1 text-xs font-semibold text-white shadow-[rgba(20,86,240,0.18)_0px_4px_10px] hover:bg-[#1456f0] dark:border-[#60a5fa]/30 dark:bg-[#2563eb] dark:text-white">
          {contextLabel} {formatContextLength(model.contextLength)}
        </Badge>
        {(model.capabilities || []).slice(0, 5).map((capability) => (
          <Badge
            key={capability}
            variant="outline"
            className="rounded-full border-[#e5e7eb] bg-white px-2.5 py-1 text-xs font-normal text-[#45515e] dark:border-white/10 dark:bg-white/5 dark:text-white/70"
          >
            {capabilityLabel(capability)}
          </Badge>
        ))}
      </div>
    </article>
  );
}
