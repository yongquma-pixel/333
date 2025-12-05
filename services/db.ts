
import { StreetRecord } from '../types';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
// @ts-ignore
import { pinyin } from 'pinyin-pro';

const DB_NAME = 'courier_assistant_db';
const DB_VERSION = 7; // Cleaned up schema version

// Ebbinghaus Intervals in Days. 0.5 = 12 hours.
const SRS_INTERVALS = [0.5, 1, 3, 7, 15, 30];

interface CourierDB extends DBSchema {
  streets: {
    key: string;
    value: StreetRecord;
  };
}

// Seed data
const SEED_DATA: StreetRecord[] = [
  { id: '1', streetName: '文三路', routeArea: '西湖 1 区', pinyin: 'wensanlu', failureCount: 0, createdAt: Date.now(), reviewStage: 0, nextReviewTime: 0, isInMistakePool: false, mistakeStreak: 0 },
  { id: '2', streetName: '文一西路', routeArea: '余杭 5 区', pinyin: 'wenyixilu', failureCount: 0, createdAt: Date.now(), reviewStage: 0, nextReviewTime: 0, isInMistakePool: false, mistakeStreak: 0 },
  { id: '3', streetName: '博奥路', routeArea: '萧山 2 区', pinyin: 'bo aolu', failureCount: 0, createdAt: Date.now(), reviewStage: 0, nextReviewTime: 0, isInMistakePool: false, mistakeStreak: 0 },
  { id: '4', streetName: '解放东路', routeArea: '江干 3 区', pinyin: 'jiefangdonglu', failureCount: 0, createdAt: Date.now(), reviewStage: 0, nextReviewTime: 0, isInMistakePool: false, mistakeStreak: 0 },
  { id: '5', streetName: '延安路', routeArea: '上城 1 区', pinyin: 'yananlu', failureCount: 0, createdAt: Date.now(), reviewStage: 0, nextReviewTime: 0, isInMistakePool: false, mistakeStreak: 0 },
  { id: '6', streetName: '体育场路', routeArea: '下城 2 区', pinyin: 'tiyuchanglu', failureCount: 0, createdAt: Date.now(), reviewStage: 0, nextReviewTime: 0, isInMistakePool: false, mistakeStreak: 0 },
  { id: '7', streetName: '古墩路', routeArea: '西湖 3 区', pinyin: 'gudunlu', failureCount: 0, createdAt: Date.now(), reviewStage: 0, nextReviewTime: 0, isInMistakePool: false, mistakeStreak: 0 },
  { id: '8', streetName: '江南大道', routeArea: '滨江 1 区', pinyin: 'jiangnandadao', failureCount: 0, createdAt: Date.now(), reviewStage: 0, nextReviewTime: 0, isInMistakePool: false, mistakeStreak: 0 },
];

// Enhanced Homophone Map for Courier Context
const HOMOPHONES: Record<string, string[]> = {
  '路': ['陆', '鹿', '录', '六', '楼'],
  '街': ['杰', '洁', '节', '阶', '界'],
  '道': ['到', '稻', '导'],
  '巷': ['项', '像', '向'],
  '苑': ['院', '园', '元', '源'],
  '桥': ['乔', '俏', '巧'],
  '弄': ['龙', '农'],
  '幢': ['撞', '栋'],
  '室': ['是', '市', '十'],
  '区': ['去', '曲'],
  '一': ['幺', '1', '伊', '衣'],
  '二': ['两', '2', '儿'],
  '三': ['山', '3', '散'],
  '四': ['是', '4', '司', '死'],
  '五': ['舞', '5', '武', '午'],
  '六': ['溜', '6', '陆'],
  '七': ['期', '7', '齐', '气'],
  '八': ['发', '8', '巴', '拔'],
  '九': ['久', '9', '酒'],
  '十': ['石', '10', '实', '时'],
  '零': ['0', '林', '灵'],
};

// Levenshtein Distance
const levenshtein = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

const getRawPinyin = (text: string) => {
  try {
    return pinyin(text, { toneType: 'none', type: 'string' }).replace(/\s/g, '');
  } catch (e) {
    return text;
  }
};

class DBService {
  private db: IDBPDatabase<CourierDB> | null = null;
  // Cache for batch processing optimization
  private cachedStreets: StreetRecord[] | null = null;

  async init() {
    if (this.db) return;
    this.db = await openDB<CourierDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('streets')) {
          db.createObjectStore('streets', { keyPath: 'id' });
        }
        
        // Seed if fresh
        if (oldVersion === 0) {
          const store = transaction.objectStore('streets');
          SEED_DATA.forEach(item => store.put(item));
        }
      },
    });
  }

  async getStorageStats() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedMB = ((estimate.usage || 0) / 1024 / 1024).toFixed(1);
      const quotaGB = ((estimate.quota || 0) / 1024 / 1024 / 1024).toFixed(1);
      const percentUsed = Math.round(((estimate.usage || 0) / (estimate.quota || 1)) * 100);
      return { usedMB, remainingGB: quotaGB, percentUsed };
    }
    return { usedMB: "0", remainingGB: "0", percentUsed: 0 };
  }

  // --- Streets ---

  async getAll(): Promise<StreetRecord[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('streets');
  }

  async getDueStreets(): Promise<StreetRecord[]> {
    const all = await this.getAll();
    const now = Date.now();
    return all.filter(s => {
      // Standard SRS logic
      if (s.nextReviewTime && s.nextReviewTime <= now) return true;
      if (s.failureCount > 0 && !s.nextReviewTime) return true;
      return false;
    });
  }

  async getMistakePool(): Promise<StreetRecord[]> {
    const all = await this.getAll();
    return all.filter(s => s.isInMistakePool === true);
  }

  async add(record: Omit<StreetRecord, 'id' | 'failureCount' | 'createdAt'>) {
    if (!this.db) await this.init();
    const newRecord: StreetRecord = {
      ...record,
      id: Math.random().toString(36).substr(2, 9),
      failureCount: 0,
      createdAt: Date.now(),
      reviewStage: 0,
      nextReviewTime: 0,
      isInMistakePool: false,
      mistakeStreak: 0
    };
    await this.db!.add('streets', newRecord);
    this.cachedStreets = null; // Invalidate cache
  }

  async mergeStreets(records: Omit<StreetRecord, 'id' | 'failureCount' | 'createdAt'>[]): Promise<{added: number, updated: number}> {
    if (!this.db) await this.init();
    const all = await this.getAll();
    const tx = this.db!.transaction('streets', 'readwrite');
    const store = tx.objectStore('streets');
    
    let added = 0;
    let updated = 0;

    for (const r of records) {
      const existing = all.find(s => s.streetName === r.streetName);
      if (existing) {
        await store.put({ ...existing, routeArea: r.routeArea, pinyin: r.pinyin || existing.pinyin });
        updated++;
      } else {
        await store.add({
          ...r,
          id: Math.random().toString(36).substr(2, 9),
          failureCount: 0,
          createdAt: Date.now(),
          reviewStage: 0,
          nextReviewTime: 0,
          isInMistakePool: false,
          mistakeStreak: 0
        });
        added++;
      }
    }
    await tx.done;
    this.cachedStreets = null;
    return { added, updated };
  }

  async delete(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('streets', id);
    this.cachedStreets = null;
  }

  // CORE QUIZ LOGIC (Combined SRS + Mistake Pool)
  async processQuizResult(id: string, isCorrect: boolean) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('streets', 'readwrite');
    const store = tx.objectStore('streets');
    const item = await store.get(id);
    
    if (!item) {
        await tx.done;
        return;
    }

    const now = Date.now();
    let updates: Partial<StreetRecord> = { lastReviewTime: now };

    if (isCorrect) {
        // 1. SRS Logic: Increase stage
        const currentStage = item.reviewStage || 0;
        const nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length);
        const daysToAdd = SRS_INTERVALS[currentStage] || 1;
        updates.reviewStage = nextStage;
        updates.nextReviewTime = now + (daysToAdd * 24 * 60 * 60 * 1000);

        // 2. Mistake Pool Logic: Graduate after 5 correct
        if (item.isInMistakePool) {
            const newStreak = (item.mistakeStreak || 0) + 1;
            updates.mistakeStreak = newStreak;
            if (newStreak >= 5) {
                updates.isInMistakePool = false; // Graduate from mistake pool
                updates.mistakeStreak = 0;
            }
        }
    } else {
        // 1. SRS Logic: Reset to 0
        updates.failureCount = (item.failureCount || 0) + 1;
        updates.reviewStage = 0;
        updates.nextReviewTime = now;

        // 2. Mistake Pool Logic: Enter pool / Reset streak
        updates.isInMistakePool = true;
        updates.mistakeStreak = 0;
    }

    await store.put({ ...item, ...updates });
    await tx.done;
  }

  async generateQuiz(count: number): Promise<{question: StreetRecord, options: string[]}[]> {
    const all = await this.getAll();
    const uniqueAreas = Array.from(new Set(all.map(s => s.routeArea)));
    const shuffled = all.sort(() => 0.5 - Math.random()).slice(0, count);

    return shuffled.map(q => {
      const wrongAreas = uniqueAreas.filter(a => a !== q.routeArea);
      const options = [q.routeArea];
      
      const dist = wrongAreas.sort(() => 0.5 - Math.random()).slice(0, 3);
      options.push(...dist);
      while(options.length < 4) {
        options.push(`未知区域 ${options.length}`);
      }
      return {
        question: q,
        options: options.sort(() => 0.5 - Math.random())
      };
    });
  }

  async search(query: string): Promise<StreetRecord[]> {
    if (!this.db) await this.init();
    const all = await this.getAll();
    const target = query.trim();
    if (!target) return [];

    const targetPinyin = getRawPinyin(target);

    const scored = all.map(s => {
      let score = 0;
      if (s.streetName === target) score = 100;
      else if (s.streetName.includes(target)) score = 80;
      
      let correctedTarget = target;
      for (const [key, variants] of Object.entries(HOMOPHONES)) {
         variants.forEach(v => {
           correctedTarget = correctedTarget.replace(new RegExp(v, 'g'), key);
         });
      }
      if (s.streetName === correctedTarget) score = Math.max(score, 95);

      const sPinyin = s.pinyin || getRawPinyin(s.streetName);
      const dist = levenshtein(sPinyin, targetPinyin);
      const maxLen = Math.max(sPinyin.length, targetPinyin.length);
      const similarity = 1 - (dist / maxLen);
      
      if (similarity > 0.8) score = Math.max(score, 70 + (similarity * 20));

      return { ...s, score };
    });

    return scored.filter(s => s.score > 60).sort((a,b) => b.score - a.score).slice(0, 5);
  }

  async batchRecognize(text: string): Promise<{original: string, match: StreetRecord | null}[]> {
    if (!this.db) await this.init();
    
    if (!this.cachedStreets) {
       this.cachedStreets = await this.getAll();
       this.cachedStreets.forEach(s => {
         if (!s.pinyin) s.pinyin = getRawPinyin(s.streetName);
       });
    }
    const all = this.cachedStreets!;
    const results: {original: string, match: StreetRecord | null}[] = [];
    
    let processedText = text;
    for (const [key, variants] of Object.entries(HOMOPHONES)) {
       variants.forEach(v => {
         processedText = processedText.replace(new RegExp(v, 'g'), key);
       });
    }

    const sortedStreets = [...all].sort((a, b) => b.streetName.length - a.streetName.length);
    let i = 0;
    const MAX_LOOPS = 500; 
    let loopCount = 0;

    while(i < processedText.length && loopCount < MAX_LOOPS) {
       loopCount++;
       let bestMatch: StreetRecord | null = null;
       let bestLen = 0;

       const maxSearchLen = 10;
       for (let len = maxSearchLen; len >= 2; len--) {
         if (i + len > processedText.length) continue;
         const chunk = processedText.substr(i, len);
         
         const exactMatch = sortedStreets.find(s => s.streetName === chunk);
         if (exactMatch) {
           bestMatch = exactMatch;
           bestLen = len;
           break; 
         }

         if (!bestMatch && len >= 3) {
             const chunkPinyin = getRawPinyin(chunk);
             const fuzzyCandidate = sortedStreets.find(s => {
                 if (Math.abs(s.streetName.length - len) > 1) return false;
                 const dist = levenshtein(s.pinyin, chunkPinyin);
                 return dist <= 1; 
             });
             
             if (fuzzyCandidate) {
                 bestMatch = fuzzyCandidate;
                 bestLen = len;
                 break; 
             }
         }
       }

       if (bestMatch) {
         results.push({ 
             original: processedText.substr(i, bestLen), 
             match: bestMatch 
         });
         i += bestLen;
       } else {
         i++;
       }
    }

    return results;
  }
}

export const db = new DBService();
