import { useQuery } from "@tanstack/react-query";
import { publicModelsApi } from "@/api/public-models";

export const usePublicModels = () => {
  return useQuery({
    queryKey: ["publicModels"],
    queryFn: () => publicModelsApi.getModels(),
    staleTime: 1000 * 60 * 10,
  });
};

export const usePublicModel = (model: string) => {
  return useQuery({
    queryKey: ["publicModel", model],
    queryFn: () => publicModelsApi.getModel(model),
    enabled: !!model,
    staleTime: 1000 * 60 * 10,
  });
};
