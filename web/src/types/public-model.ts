import type { ModelPrice } from "@/types/model";

export interface PublicModel {
  model: string;
  provider: string;
  capabilities: string[];
  available_groups: string[];
  available_group_multipliers?: Record<string, number>;
  available_sets: string[];
  context_length?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  created_at?: number;
  updated_at?: number;
  price?: ModelPrice;
  image_prices?: Record<string, number>;
  image_quality_prices?: Record<string, Record<string, number>>;
  description?: string;
}

export interface PublicModelsResponse {
  models: PublicModel[];
  total: number;
}
