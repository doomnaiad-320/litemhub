import axios, { AxiosError, AxiosResponse } from "axios";
import { ENV } from "@/utils/env";
import { ApiError, type APIResponse } from "./index";
import type { AnnouncementsResponse } from "@/types/announcement";

const PUBLIC_API_BASE_URL = "/public-api";
const PUBLIC_API_TIMEOUT = Number(ENV.API_TIMEOUT || 10000);

const publicApiClient = axios.create({
  baseURL: PUBLIC_API_BASE_URL,
  timeout: PUBLIC_API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

publicApiClient.interceptors.response.use(
  (response) => {
    const data = response.data as APIResponse;
    if (data && data.success === false) {
      throw new ApiError(data.message || "Request failed", response.status);
    }

    return response;
  },
  (error: AxiosError<APIResponse>) => {
    const status = error.response?.status;
    const errorData = error.response?.data;

    if (errorData) {
      throw new ApiError(errorData.message || "Request failed", status || 500);
    }

    throw new ApiError(error.message || "Network request failed", status || 500);
  },
);

const get = async <T>(url: string) => {
  const response: AxiosResponse<APIResponse<T>> = await publicApiClient.get(url);
  return response.data.data as T;
};

export const publicAnnouncementsApi = {
  getAnnouncements: async (page = 1, perPage = 50) =>
    get<AnnouncementsResponse>(`announcements?p=${page}&per_page=${perPage}`),
};
