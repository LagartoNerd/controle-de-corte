export type GradeType = 'standard_high' | 'standard_low' | 'custom';
export type UserRole = 'admin' | 'user';
export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'pro';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ModelDetails: {modelId: string};
  DailySheetForm: {sheetId?: string};
  FortnightDetails: {fortnightId: string};
  Checkout: {planId: SubscriptionPlan};
};

export type DrawerParamList = {
  Dashboard: undefined;
  Clients: undefined;
  ClientFinance: undefined;
  Models: undefined;
  DailySheets: undefined;
  Reports: undefined;
  Pricing: undefined;
  AdminUsers: undefined;
  AdminConfig: undefined;
};

export interface Client {
  id: string;
  userId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  document?: string;
  status?: 'active' | 'inactive';
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  plan: SubscriptionPlan;
  isBlocked: boolean;
  createdAt: string;
  trialStartDate?: string | null;
  trialPlan?: SubscriptionPlan | null;
  hasUsedTrial?: boolean;
  subscriptionId?: string;
}

export interface GlobalConfig {
  id: string;
  admobEnabled: boolean;
  admobBannerId: string;
  admobInterstitialId: string;
  freeModelLimit: number;
  freeClientLimit: number;
  maintenanceMode: boolean;
  basicPrice: number;
  premiumPrice: number;
  proPrice: number;
  trialDays: number;
  mercadopagoPublicKey: string;
  mercadopagoAccessToken: string;
  mercadopagoEnabled: boolean;
  pagseguroToken?: string;
  pagseguroEmail?: string;
  pagseguroEnabled: boolean;
  pixKey?: string;
  pixName?: string;
  pixCity?: string;
  pixEnabled: boolean;
  appIcon?: string;
  features: {
    basic: {ads: boolean; pdfExport: boolean; excelExport: boolean; maxModels: number; maxClients: number};
    premium: {ads: boolean; pdfExport: boolean; excelExport: boolean; maxModels: number; maxClients: number};
    pro: {ads: boolean; pdfExport: boolean; excelExport: boolean; maxModels: number; maxClients: number};
  };
}

export interface GradeQuantities {[key: string]: number}

export interface Model {
  id: string;
  userId: string;
  clientId: string;
  name: string;
  code: string;
  photoUrl?: string;
  unitValue: number;
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
}

export interface ModelColor {
  id: string;
  modelId: string;
  userId: string;
  name: string;
  photoUrl?: string;
  observation?: string;
  status: 'active' | 'inactive';
  materialIds: string[];
}

export interface ModelMaterial {
  id: string;
  userId: string;
  modelId: string;
  name: string;
  cutType: 'conjugado' | 'individual';
  status: 'active' | 'inactive';
  observation?: string;
}

export interface ModelMold {
  id: string;
  userId: string;
  modelId: string;
  name: string;
  materialId: string;
  cutType: 'conjugado' | 'individual';
}

export interface DailySheet {
  id: string;
  userId: string;
  clientId: string;
  clientName?: string;
  date: string;
  fortnightId: string;
  totalPairs: number;
  totalValue: number;
  createdAt: string;
}

export interface DailySheetItem {
  id: string;
  sheetId: string;
  userId: string;
  modelId: string;
  colorId: string;
  gradeType: GradeType;
  customGrade?: GradeQuantities;
  quantity: number;
  totalPairs: number;
  unitValue: number;
  totalValue: number;
}

export interface Fortnight {
  id: string;
  userId: string;
  clientId: string;
  clientName?: string;
  year: number;
  month: number;
  period: 1 | 2;
  totalPairs: number;
  totalValue: number;
  paidValue: number;
  status: 'not_paid' | 'partially_paid' | 'paid';
}

export interface Payment {
  id: string;
  fortnightId: string;
  userId: string;
  amount: number;
  date: string;
  observation?: string;
}

export const STANDARD_GRADES = {
  high: {'43': 1, '42': 2, '41': 3, '40': 3, '39': 2, '38': 1},
  low: {'39': 1, '38': 2, '37': 3, '36': 3, '35': 2, '34': 1},
};

export const ALL_SIZES = ['43', '42', '41', '40', '39', '38', '37', '36', '35', '34'];

export const CONJUGATED_PAIRS = [
  ['43', '42'],
  ['41', '40'],
  ['39', '38'],
  ['37', '36'],
  ['35', '34'],
];

// Navigation prop types for use in screens
export type AppNavigation = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
  replace?: (screen: string, params?: Record<string, unknown>) => void;
};
