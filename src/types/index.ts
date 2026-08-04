export interface SessionUser {
  id: string;
  username: string;
  email: string;
  type: "COMMON" | "COMPANY" | "MODERATOR" | "EDITOR" | "SUPER" | "ROOT";
  status: "INACTIVE" | "ACTIVE" | "BANNED" | "DELETED";
}

export interface CompanyRow {
  id: string;
  inn: string;
  name: string;
  kpp: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  region: string | null;
  classifierIds: string[];
  rating: number | null;
  reviewCount: number;
  metrics: {
    phoneViews: number;
    emailViews: number;
    websiteViews: number;
  } | null;
  ownerNick: string | null;
}

export interface ProductTreeItemRow {
  id: string;
  name: string;
  parentId: string | null;
  inBranchNumber: number;
  fullNumberPath: string;
  description: string | null;
  bannerUrl: string | null;
  children?: ProductTreeItemRow[];
  productCount?: number;
}

export interface ConferenceRow {
  id: string;
  title: string;
  organizerName: string;
  logoUrl: string | null;
  date: Date;
  time: string;
  description: string;
  treeItemPath: string | null;
  coinPrice: number;
  isPublic: boolean;
  connectionLink: string | null;
  status: string;
  views: number;
  participantCount: number;
}

export interface LibraryDocumentRow {
  id: string;
  title: string;
  treeItemPath: string | null;
  coinPrice: number;
  uploaderName: string;
  fileSize: number;
  views: number;
  purchasesCount: number;
  isApproved: boolean;
}

export interface PollRow {
  id: string;
  question: string;
  pollType: "DICHOTOMOUS" | "MULTIPLE";
  coinReward: number;
  isActive: boolean;
  options: { id: string; text: string; voteCount: number }[];
  totalVotes: number;
  treeItemPath: string | null;
}

export interface ProductRow {
  id: string;
  companyName: string;
  companyInn: string;
  name: string;
  classes: string[];
  region: string | null;
  imageUrl: string | null;
  unit: string | null;
  characteristics: unknown;
  price: number | null;
  views: number;
  treeItemPath: string;
  companyRating: number | null;
  companyPhone: string | null;
  companyEmail: string | null;
}

export interface InvoiceRow {
  id: string;
  number: string;
  date: Date;
  dueDate: Date;
  status: string;
  subtotal: number;
  limit: number;
  discount: number;
  total: number;
  userName: string;
}
