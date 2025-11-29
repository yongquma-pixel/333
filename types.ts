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