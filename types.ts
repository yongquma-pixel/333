
export interface StreetRecord {
  id: string;
  streetName: string;
  routeArea: string;
  pinyin: string;
  failureCount: number; // Total historic failures
  createdAt: number;
  
  // Ebbinghaus Forgetting Curve Fields
  reviewStage?: number; // 0-6. 0 = New/Forgotten, 6 = Mastered
  nextReviewTime?: number; // Timestamp when it should be reviewed next
  lastReviewTime?: number; // Timestamp of last attempt

  // Dedicated Mistake Pool (Hardcore Mode)
  isInMistakePool?: boolean; // Is currently in the "Mistake Book"
  mistakeStreak?: number; // Current consecutive correct answers in mistake mode (Target: 5)
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
