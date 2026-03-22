export interface ProductData {
  name: string;
  coreValue: string;
  usp?: string;
  productComposition?: string;
  userStories?: string[];
  directCompetitors?: string;
  potentialThreats?: string;
  userPersona: string;
  gtmModel?: 'PLG' | 'SLG' | 'Content';
  gtmStrategy: {
    contentMarketing: number;
    paidAds: number;
    referral: number;
    kFactor?: number;
    ltvCac?: number;
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
  currentProject: ProductData | null;
  simulations: SimulationResult[];
  activeModule: 'input' | 'gtm' | 'advisor' | 'sandbox' | 'monitoring' | 'diagnostics' | 'generator';
  activeSubModule?: string;
  isSimulating: boolean;
}
