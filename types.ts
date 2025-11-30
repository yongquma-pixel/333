
export interface StreetRecord {
  id: string;
  streetName: string;
  routeArea: string;
  pinyin: string;
  failureCount: number; // For tracking mistakes
  createdAt: number;
}

export interface QuizQuestion {
  question: StreetRecord;
  options: string[]; // 4 possible route areas
}

export interface QuizResult {
  total: number;
  correct: number;
  wrongStreets: StreetRecord[];
}

export interface HPA1Item {
  id: string;
  trackingNumber: string;
  arrivalDate: string; // YYYY-MM-DD
  status: 'pending' | 'paid';
  createdAt: number;
}

export interface TodoItem {
  id: string;
  content: string;
  isDone: boolean;
  date: string; // YYYY-MM-DD
  createdAt: number;
  imageUrl?: string; // Base64 compressed image
}

export interface RelocationRecord {
  id: string;
  oldAddress: string;
  newAddress: string;
  phoneNumber: string;
  errorCount: number; // Tracking how many times this record was flagged as wrong
  createdAt: number;
}
