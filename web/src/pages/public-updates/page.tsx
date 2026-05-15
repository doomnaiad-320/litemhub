import { useEffect, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";
import { PublicSiteHeader } from "@/components/common/PublicSiteHeader";
import {
  usePublicAnnouncementCategories,
  usePublicAnnouncements,
} from "@/feature/public-announcements/hooks";
import { ROUTES } from "@/routes/constants";
import { cn } from "@/lib/utils";
import { normalizeMarkdownContent } from "@/lib/markdown";
import type { Announcement } from "@/types/announcement";

const formatMonthDay = (timestamp?: number) => {
  if (!timestamp) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
};

const formatYear = (timestamp?: number) => {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
  }).format(new Date(timestamp));
};

const updateMetaTag = (selector: string, attribute: "content" | "href", value: string) => {
  const element = document.head.querySelector(selector);
  if (element) {
    element.setAttribute(attribute, value);
  }
};

const categoryPillClassNames: Record<string, string> = {
  "API 更新": "border-[#bfdbfe] bg-[#eff6ff] text-[#1456f0] dark:border-[#1d4ed8]/40 dark:bg-[#1d4ed8]/15 dark:text-[#93c5fd]",
  "AI 更新": "border-[#c7d2fe] bg-[#eef2ff] text-[#4f46e5] dark:border-[#6366f1]/40 dark:bg-[#6366f1]/15 dark:text-[#c4b5fd]",
  "系统公告": "border-[#d4d4d8] bg-[#f4f4f5] text-[#3f3f46] dark:border-white/15 dark:bg-white/10 dark:text-white/75",
  "计费与价格": "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] dark:border-[#22c55e]/40 dark:bg-[#22c55e]/15 dark:text-[#86efac]",
  "维护通知": "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c] dark:border-[#f97316]/40 dark:bg-[#f97316]/15 dark:text-[#fdba74]",
};

const markdownComponents: Components = {
  h1: (props) => (
    <h3
      className="mb-4 mt-8 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[24px] font-semibold leading-tight text-[#18181b] first:mt-0 dark:text-white"
      {...props}
    />
  ),
  h2: (props) => (
    <h4
      className="mb-3 mt-8 font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-[20px] font-semibold leading-tight text-[#18181b] dark:text-white"
      {...props}
    />
  ),
  h3: (props) => (
    <h5
      className="mb-3 mt-6 text-[17px] font-semibold leading-tight text-[#18181b] dark:text-white"
      {...props}
    />
  ),
  p: (props) => (
    <p className="my-4 text-[15px] leading-7 text-[#45515e] dark:text-white/70" {...props} />
  ),
  ul: (props) => (
    <ul className="my-5 list-disc space-y-2 pl-5 text-[15px] leading-7 text-[#45515e] dark:text-white/70" {...props} />
  ),
  ol: (props) => (
    <ol className="my-5 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-[#45515e] dark:text-white/70" {...props} />
  ),
  li: (props) => (
    <li className="pl-1 marker:text-[#18181b] dark:marker:text-white" {...props} />
  ),
  strong: (props) => (
    <strong className="font-semibold text-[#18181b] dark:text-white" {...props} />
  ),
  a: (props) => (
    <a
      className="break-words font-medium text-[#1456f0] underline underline-offset-2 hover:text-[#17437d] dark:text-[#60a5fa]"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="break-words rounded-[4px] bg-[#f5f5f5] px-1 py-0.5 font-mono text-[0.92em] text-[#18181b] dark:bg-white/10 dark:text-white"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="my-5 max-w-full overflow-x-auto rounded-[6px] bg-[#f5f5f5] p-4 text-[13px] leading-6 text-[#18181b] dark:bg-white/10 dark:text-white"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-5 max-w-full overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-[14px]" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border-b border-[#e5e7eb] px-3 py-2 font-semibold text-[#18181b] dark:border-white/10 dark:text-white" {...props} />
  ),
  td: (props) => (
    <td className="border-b border-[#e5e7eb] px-3 py-2 text-[#45515e] dark:border-white/10 dark:text-white/70" {...props} />
  ),
};

export default function PublicUpdatesPage() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const selectedCategory = categoryFilter === "all" ? undefined : categoryFilter;
  const { data, isLoading, isError } = usePublicAnnouncements(1, 50, selectedCategory);
  const { data: categoriesData } = usePublicAnnouncementCategories();
  const announcements = data?.announcements || [];
  const categories = categoriesData?.categories || [];
  const categoryItems = ["all", ...categories];

  useEffect(() => {
    const title = "API 更新 | LiteMHub";
    const description = "查看 LiteMHub API、模型、平台能力和服务策略的最新公告。";
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
    canonical.setAttribute("href", `${window.location.origin}${ROUTES.PUBLIC_API_UPDATES}`);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-['DM_Sans',_'Helvetica_Neue',_Arial,_sans-serif] text-[#222222] transition-colors duration-200 dark:bg-[#080b12] dark:text-white">
      <PublicSiteHeader activeItem="updates" />

      <main className="relative border-b border-[#f2f3f5] bg-white dark:border-white/10 dark:bg-[#080b12]">
        <div className="pointer-events-none absolute right-[-10rem] top-[-16rem] h-[34rem] w-[34rem] rounded-full bg-[#1456f0]/10 blur-3xl dark:bg-[#3b82f6]/[0.08]" />
        <div className="pointer-events-none absolute bottom-[-14rem] left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[#ea5ec1]/10 blur-3xl dark:bg-[#ea5ec1]/[0.06]" />

        <section className="relative mx-auto max-w-5xl px-4 pb-20 pt-14 sm:px-6 lg:pb-24 lg:pt-18">
          <div className="max-w-3xl border-b border-[#e5e7eb] pb-10 dark:border-white/10">
            <div className="mb-4 text-sm font-semibold text-[#1456f0]">API Updates</div>
            <h1 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-4xl font-medium leading-tight text-[#18181b] dark:text-white sm:text-5xl">
              API 更新公告
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#45515e] dark:text-white/70">
              按时间线记录模型接入、接口调整、计费策略和平台能力变化。
            </p>
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-14">
            {categories.length > 0 && (
              <aside className="lg:sticky lg:top-[82px] lg:self-start">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8e8e93] dark:text-white/35">
                  Categories
                </div>
                <nav className="flex gap-2 overflow-x-auto border-b border-[#e5e7eb] pb-4 dark:border-white/10 lg:block lg:space-y-1 lg:overflow-visible lg:border-b-0 lg:pb-0">
                  {categoryItems.map((category) => {
                    const isAll = category === "all";
                    const active = categoryFilter === category;
                    return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={cn(
                      "flex h-9 shrink-0 items-center rounded-[6px] px-3 text-sm font-medium transition lg:w-full",
                      active
                        ? "bg-[#18181b] text-white dark:bg-white dark:text-[#18181b]"
                        : "text-[#45515e] hover:bg-black/[0.04] hover:text-[#18181b] dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white",
                    )}
                  >
                    {isAll ? "全部" : category}
                  </button>
                    );
                  })}
                </nav>
              </aside>
            )}

            <div className="min-w-0">
              {isLoading && (
                <div className="flex items-center gap-2 py-12 text-sm text-[#8e8e93]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载更新...
                </div>
              )}

              {isError && (
                <div className="border-l border-[#e5e7eb] py-8 pl-6 text-sm text-[#45515e] dark:border-white/10 dark:text-white/70">
                  公告加载失败，请稍后重试。
                </div>
              )}

              {!isLoading && !isError && announcements.length === 0 && (
                <div className="border-l border-[#e5e7eb] py-8 pl-6 text-sm text-[#45515e] dark:border-white/10 dark:text-white/70">
                  暂无公告。
                </div>
              )}

              {!isLoading && !isError && announcements.length > 0 && (
                <div className="relative">
                  <div className="absolute bottom-0 left-[1rem] top-0 hidden w-px bg-[#e5e7eb] dark:bg-white/10 md:block" />
                  <div className="space-y-14">
                    {announcements.map((announcement, index) => (
                      <TimelineItem
                        key={announcement.id}
                        announcement={announcement}
                        isFirst={index === 0}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function TimelineItem({
  announcement,
  isFirst,
}: {
  announcement: Announcement;
  isFirst: boolean;
}) {
  const timestamp = announcement.published_at || announcement.updated_at;
  const markdown = normalizeMarkdownContent(announcement.content);
  const categoryClassName = announcement.category
    ? categoryPillClassNames[announcement.category] || categoryPillClassNames["系统公告"]
    : "";

  return (
    <article className="grid min-w-0 gap-5 md:grid-cols-[2rem_5.5rem_minmax(0,1fr)] md:gap-8">
      <div className="relative hidden md:block">
        <div
          className={cn(
            "absolute left-[0.75rem] top-2 h-[9px] w-[9px] rounded-full border border-[#18181b] bg-white dark:border-white dark:bg-[#080b12]",
            isFirst && "bg-[#18181b] dark:bg-white",
          )}
        />
      </div>

      <div className="md:text-right">
        <div className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-2xl font-semibold leading-none text-[#18181b] dark:text-white">
          {formatMonthDay(timestamp)}
        </div>
        <div className="mt-2 text-xs font-medium text-[#8e8e93] dark:text-white/45">
          {formatYear(timestamp)}
        </div>
      </div>

      <div className="relative min-w-0 border-l border-[#e5e7eb] pl-6 dark:border-white/10 md:border-l-0 md:pl-0">
        <div
          className={cn(
            "absolute left-[-5px] top-2 h-[9px] w-[9px] rounded-full border border-[#18181b] bg-white dark:border-white dark:bg-[#080b12] md:hidden",
            isFirst && "bg-[#18181b] dark:bg-white",
          )}
        />

        <div className="min-w-0 overflow-hidden border-b border-[#e5e7eb] pb-12 dark:border-white/10">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[#8e8e93] dark:text-white/45">
            {announcement.category && (
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold leading-none",
                  categoryClassName,
                )}
              >
                {announcement.category}
              </span>
            )}
            {announcement.version && (
              <span className="font-mono text-[#45515e] dark:text-white/65">
                {announcement.version}
              </span>
            )}
          </div>

          <h2 className="font-['Outfit',_'Helvetica_Neue',_Arial,_sans-serif] text-2xl font-semibold leading-tight text-[#18181b] dark:text-white sm:text-[30px]">
            {announcement.title}
          </h2>

          {announcement.summary && (
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#45515e] dark:text-white/70">
              {announcement.summary}
            </p>
          )}

          <div className="mt-6 max-w-none overflow-hidden break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </article>
  );
}
