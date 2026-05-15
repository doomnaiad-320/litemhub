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

export function PublicSiteHeader({
  activeItem,
  className,
  variant = "light",
}: PublicSiteHeaderProps) {
  const { t: rawT, i18n } = useTranslation();
  const t = rawT as (key: string, options?: Record<string, unknown>) => string;
  const isAuthenticated = useUserPortalAuthStore((state) => state.isAuthenticated);
  const isChinese = (i18n.resolvedLanguage || i18n.language || "").startsWith("zh");
  const isDark = variant === "dark";
  const primaryTarget = isAuthenticated ? ROUTES.USER_DASHBOARD : ROUTES.USER_LOGIN;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-xl",
        isDark
          ? "border-[#1f2229] bg-[#0b0b0d]/92"
          : "border-[#f2f3f5] bg-white/92 dark:border-white/10 dark:bg-[#111827]/92",
        className,
      )}
    >
      <div className="flex h-[58px] w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border text-[13px] font-semibold",
              isDark
                ? "border-[#2b2e36] bg-[#15171d] text-[#e7e8ee]"
                : "border-transparent bg-[#181e25] text-white shadow-[rgba(44,30,116,0.16)_0px_0px_15px] dark:border-white/10 dark:bg-white dark:text-[#181e25]",
            )}
          >
            LM
          </span>
          <span
            className={cn(
              "text-[14px] font-semibold tracking-[-0.01em]",
              isDark ? "text-[#e4e6ed]" : "text-[#18181b] dark:text-white",
            )}
          >
            LiteMHub
          </span>
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-[5px]">
          <nav className="hidden min-w-0 items-center gap-[5px] overflow-x-auto md:flex">
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
              isDark ? "dark border-[#24262d]" : "border-[#e5e7eb] dark:border-white/10",
            )}
          >
            <LanguageSelector
              className={
                isDark
                  ? "border-[#2b2e36] bg-[#15171d] text-[#e4e6ed] hover:bg-[#1b1e25] dark:border-[#2b2e36] dark:bg-[#15171d] dark:hover:bg-[#1b1e25]"
                  : undefined
              }
              variant="minimal"
            />
          </div>

          <div
            className={cn(
              "flex items-center gap-[5px] border-l pl-[5px]",
              isDark ? "border-[#24262d]" : "border-[#e5e7eb] dark:border-white/10",
            )}
          >
            <Button
              asChild
              className={cn(
                "h-[32px] rounded-[6px] px-3 text-[14px] font-semibold shadow-none",
                isDark
                  ? "bg-[#e7e8ee] text-[#111217] hover:bg-white"
                  : "bg-[#181e25] text-white hover:bg-[#111827] dark:bg-white dark:text-[#181e25] dark:hover:bg-white/90",
              )}
            >
              <Link to={primaryTarget}>
                {isAuthenticated ? t("publicModels.nav.console") : t("publicModels.nav.start")}
                <ArrowRight className="h-[13px] w-[13px]" strokeWidth={2} />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
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
    "whitespace-nowrap rounded-[6px] px-3 py-[7px] text-[14px] font-semibold leading-none transition",
    isDark
      ? "text-[#818793] hover:bg-[#15171d] hover:text-[#e4e6ed]"
      : "text-[#45515e] hover:bg-black/[0.05] hover:text-[#18181b] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
    active &&
      (isDark
        ? "bg-[#15171d] text-[#e4e6ed]"
        : "bg-black/[0.05] text-[#18181b] dark:bg-white/10 dark:text-white"),
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
