import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/common/LanguageSelector";
import { useUserPortalAuthStore } from "@/store/user-portal-auth";
import { ROUTES } from "@/routes/constants";
import { cn } from "@/lib/utils";

type PublicSiteHeaderVariant = "light" | "dark";
type PublicSiteHeaderItem = "home" | "models" | "updates";

interface PublicSiteHeaderProps {
  activeItem?: PublicSiteHeaderItem;
  className?: string;
  variant?: PublicSiteHeaderVariant;
}

interface PublicSiteMenuProps {
  activeItem?: PublicSiteHeaderItem;
  className?: string;
  showPrimaryAction?: boolean;
  variant?: PublicSiteHeaderVariant;
}

export function PublicSiteHeader({
  activeItem,
  className,
  variant = "light",
}: PublicSiteHeaderProps) {
  const isDark = variant === "dark";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-xl",
        isDark
          ? "border-border bg-background/92"
          : "border-[#f2f3f5] bg-white/92 dark:border-border dark:bg-background/92",
        className,
      )}
    >
      <div className="flex h-[58px] w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border text-[13px] font-semibold",
              isDark
                ? "border-border bg-primary text-primary-foreground"
                : "border-transparent bg-[#181e25] text-white shadow-[rgba(44,30,116,0.16)_0px_0px_15px] dark:border-border dark:bg-primary dark:text-primary-foreground",
            )}
          >
            LM
          </span>
          <span
            className={cn(
              "text-[14px] font-semibold tracking-[-0.01em]",
              isDark ? "text-foreground" : "text-[#18181b] dark:text-foreground",
            )}
          >
            LiteMHub
          </span>
        </Link>

        <PublicSiteMenu activeItem={activeItem} variant={variant} />
      </div>
    </header>
  );
}

export function PublicSiteMenu({
  activeItem,
  className,
  showPrimaryAction = true,
  variant = "light",
}: PublicSiteMenuProps) {
  const { t: rawT, i18n } = useTranslation();
  const t = rawT as (key: string, options?: Record<string, unknown>) => string;
  const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated);
  const isChinese = (i18n.resolvedLanguage || i18n.language || "").startsWith("zh");
  const isDark = variant === "dark";
  const primaryTarget = isAuthenticated ? ROUTES.USER_DASHBOARD : ROUTES.USER_LOGIN;

  return (
    <div className={cn("ml-auto flex min-w-0 items-center gap-[5px]", className)}>
      <nav className="flex min-w-0 items-center gap-[3px] overflow-x-auto [scrollbar-width:none] md:gap-[5px] [&::-webkit-scrollbar]:hidden">
        <PublicHeaderLink active={activeItem === "home"} isDark={isDark} to="/">
          {isChinese ? "首页" : "Home"}
        </PublicHeaderLink>
        <PublicHeaderLink
          active={activeItem === "models"}
          isDark={isDark}
          to={ROUTES.PUBLIC_MODELS}
        >
          {t("publicModels.nav.models")}
        </PublicHeaderLink>
        <PublicHeaderLink isDark={isDark} to={ROUTES.PUBLIC_API_DOCS}>
          {t("publicModels.nav.apiDocs")}
        </PublicHeaderLink>
        <PublicHeaderLink
          active={activeItem === "updates"}
          isDark={isDark}
          to={ROUTES.PUBLIC_API_UPDATES}
        >
          {t("publicModels.nav.apiUpdates")}
        </PublicHeaderLink>
        <PublicHeaderLink isDark={isDark} to={ROUTES.PUBLIC_BLOG}>
          {t("publicModels.nav.blog")}
        </PublicHeaderLink>
        <PublicHeaderLink isDark={isDark} to={ROUTES.PUBLIC_GITHUB}>
          {t("publicModels.nav.github")}
        </PublicHeaderLink>
      </nav>

      <div
        className={cn(
          "hidden items-center gap-[5px] border-l pl-[5px] sm:flex",
          isDark ? "dark border-border" : "border-[#e5e7eb] dark:border-border",
        )}
      >
        <LanguageSelector
          className={
            isDark
              ? "border-border bg-card text-foreground hover:bg-muted dark:border-border dark:bg-card dark:hover:bg-muted"
              : undefined
          }
          variant="minimal"
        />
      </div>

      {showPrimaryAction && (
        <div
          className={cn(
            "flex items-center gap-[5px] border-l pl-[5px]",
            isDark ? "border-border" : "border-[#e5e7eb] dark:border-border",
          )}
        >
          <Button
            asChild
            className={cn(
              "h-[32px] rounded-[6px] px-3 text-[14px] font-semibold shadow-none",
              isDark
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-[#181e25] text-white hover:bg-[#111827] dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90",
            )}
          >
            <Link to={primaryTarget}>
              {isAuthenticated ? t("publicModels.nav.console") : t("publicModels.nav.start")}
              <ArrowRight className="h-[13px] w-[13px]" strokeWidth={2} />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function PublicHeaderLink({
  active,
  children,
  isDark,
  to,
}: {
  active?: boolean;
  children: ReactNode;
  isDark: boolean;
  to: string;
}) {
  const isExternal = /^https?:\/\//.test(to);
  const isDocumentRoute = to.startsWith("/swagger");
  const className = cn(
    "whitespace-nowrap rounded-[6px] px-2 py-[7px] text-[13px] font-semibold leading-none transition sm:px-3 sm:text-[14px]",
    isDark
      ? "text-muted-foreground hover:bg-muted hover:text-foreground"
      : "text-[#45515e] hover:bg-black/[0.05] hover:text-[#18181b] dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground",
    active &&
      (isDark
        ? "bg-muted text-foreground"
        : "bg-black/[0.05] text-[#18181b] dark:bg-muted dark:text-foreground"),
  );

  if (isExternal || isDocumentRoute) {
    return (
      <a
        href={to}
        className={className}
        rel={isExternal ? "noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      to={to}
      className={className}
    >
      {children}
    </Link>
  );
}
