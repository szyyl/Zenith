export interface ProductData {
  id: string;
  name: string;
  coreValue: string;
  usp?: string;
  productComposition?: string;
  userStories?: string[];
  directCompetitors?: string;
  potentialThreats?: string;
  userPersona: string;
  gtmModel?: 'PLG';
  pricingModel?: 'Freemium' | 'FreeTrial' | 'Tiered' | 'PayAsYouGo';
  targetMarket: {
    country: string;
    age: string;
    occupation: string;
    income: string;
  };
  salesCycle?: 'Short' | 'Medium' | 'Long' | 'ExtraLong';
  gtmStrategy: {
    contentMarketing: { volume: number; unitCost: number; cvr: number };
    paidAds: { volume: number; unitCost: number; cvr: number };
    referral: { volume: number; unitCost: number; cvr: number };
    viral: { volume: number; kFactor: number; cvr: number }; // Replaced outboundSales -> viral
    seoAso: { volume: number; unitCost: number };
    retentionRate: number;
  };
  costStructure?: {
    dailyFreeUses: number;
    costPerCall: number;
    targetMau: number;
    paidConversionRate: number;
    monthlySubscription: number;
  };
  scores?: {
    feasibility: number;
    marketPotential: number;
    riskResilience: number;
  };
}

export interface SimulationResult {
  id: string;
  timestamp: number;
  scenario: string;
  outcome: string;
  risks: string[];
  impact: string;
  recommendations: string[];
  inferenceCost?: number;
}

export interface AppState {
  projects: ProductData[];
  currentProjectId: string;
  simulations: SimulationResult[];
  activeModule: 'input' | 'gtm' | 'advisor' | 'sandbox' | 'monitoring' | 'diagnostics' | 'generator';
  activeSubModule?: string;
  isSimulating: boolean;
}
