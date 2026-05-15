import { useQuery } from "@tanstack/react-query";
import { publicAnnouncementsApi } from "@/api/public-announcements";

export const usePublicAnnouncements = (page = 1, perPage = 50, category?: string) => {
  return useQuery({
    queryKey: ["publicAnnouncements", page, perPage, category],
    queryFn: () => publicAnnouncementsApi.getAnnouncements(page, perPage, category),
    staleTime: 1000 * 60 * 5,
  });
};

export const usePublicAnnouncementCategories = () => {
  return useQuery({
    queryKey: ["publicAnnouncementCategories"],
    queryFn: () => publicAnnouncementsApi.getCategories(),
    staleTime: 1000 * 60 * 5,
  });
};
