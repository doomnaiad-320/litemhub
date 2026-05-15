import { useQuery } from "@tanstack/react-query";
import { publicAnnouncementsApi } from "@/api/public-announcements";

export const usePublicAnnouncements = (page = 1, perPage = 50) => {
  return useQuery({
    queryKey: ["publicAnnouncements", page, perPage],
    queryFn: () => publicAnnouncementsApi.getAnnouncements(page, perPage),
    staleTime: 1000 * 60 * 5,
  });
};
