export type CategoryKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type UrlCheckResult = {
  url: string;
  isValidUrl: boolean;
  risk: "low" | "medium" | "high";
  score: number; // 0..1
  reasons: string[];
};

export type MetricsJson = {
  generatedAt?: string;
  project?: {
    counts?: Record<string, number>;
  };
  gnn?: {
    eval?: Record<string, number>;
    eval_noleak?: Record<string, number>;
    [k: string]: unknown;
  };
  transformer?: {
    eval?: Record<string, number>;
    [k: string]: unknown;
  };
  autoencoder?: {
    eval?: Record<string, number>;
    [k: string]: unknown;
  };
  eh_categories?: {
    totals?: Record<string, number>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertSource = "gnn" | "transformer" | "autoencoder";

export type NetworkAnalyzeResult = {
  input: Record<string, string | number>;
  gnn_score: number;
  transformer_score: number;
  fusion_score: number;
  risk: "low" | "medium" | "high" | "critical";
  categories: string[];
  subcategories: string[];
  features_used: string[];
};

export type TextAnalyzeResult = {
  text: string;
  is_spam: boolean;
  is_phishing: boolean;
  is_scam: boolean;
  category: "A" | "safe";
  risk: "low" | "medium" | "high" | "critical";
  score: number;
  reasons: string[];
  features: Record<string, number | boolean | string>;
};

export type AnomalyResult = {
  recon_mse: number;
  threshold: number;
  is_anomaly: boolean;
  anomaly_score: number;
  risk: "low" | "medium" | "high" | "critical";
  top_anomalous_features: Array<{ feature: string; contribution: number }>;
  possible_categories: string[];
};
