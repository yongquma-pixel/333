import { StreetRecord } from '../types';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
// @ts-ignore
import { pinyin } from 'pinyin-pro';

const DB_NAME = 'courier_assistant_db';
const DB_VERSION = 10;

const SRS_INTERVALS = [0.5, 1, 3, 7, 15, 30];

interface CourierDB extends DBSchema {
  streets: {
    key: string;
    value: StreetRecord;
  };
}

const getRawPinyin = (text: string) => {
  try {
    return pinyin(text, { toneType: 'none', type: 'string' }).replace(/\s/g, '');
  } catch (e) {
    return text;
  }
};

const levenshtein = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
};

class DBService {
  private db: IDBPDatabase<CourierDB> | null = null;
  private cachedStreets: StreetRecord[] | null = null;

  async init() {
    if (this.db) return;
    this.db = await openDB<CourierDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('streets')) {
          db.createObjectStore('streets', { keyPath: 'id' });
        }
      },
    });
  }

  async getAll(): Promise<StreetRecord[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('streets');
  }

  async getDueStreets(): Promise<StreetRecord[]> {
    const all = await this.getAll();
    const now = Date.now();
    return all.filter(s => (s.nextReviewTime && s.nextReviewTime <= now) || (s.failureCount > 0 && !s.nextReviewTime));
  }

  async getMistakePool(): Promise<StreetRecord[]> {
    const all = await this.getAll();
    return all.filter(s => s.isInMistakePool === true);
  }

  async getStorageStats() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return { 
        usedMB: ((estimate.usage || 0) / 1024 / 1024).toFixed(1), 
        remainingGB: ((estimate.quota || 0) / 1024 / 1024 / 1024).toFixed(1), 
        percentUsed: Math.round(((estimate.usage || 0) / (estimate.quota || 1)) * 100) 
      };
    }
    return { usedMB: "0", remainingGB: "0", percentUsed: 0 };
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
    this.cachedStreets = null;
  }

  async delete(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('streets', id);
    this.cachedStreets = null;
  }

  async mergeStreets(records: any[]): Promise<{added: number, updated: number}> {
    if (!this.db) await this.init();
    const all = await this.getAll();
    let added = 0;
    let updated = 0;
    for (const r of records) {
      const existing = all.find(s => s.streetName === r.streetName);
      if (existing) {
        await this.db!.put('streets', { ...existing, ...r });
        updated++;
      } else {
        await this.add(r);
        added++;
      }
    }
    this.cachedStreets = null;
    return { added, updated };
  }

  async processQuizResult(id: string, isCorrect: boolean) {
    if (!this.db) await this.init();
    const item = await this.db!.get('streets', id);
    if (!item) return;
    const now = Date.now();
    let updates: Partial<StreetRecord> = { lastReviewTime: now };
    if (isCorrect) {
      const currentStage = item.reviewStage || 0;
      const nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length);
      const daysToAdd = SRS_INTERVALS[currentStage] || 1;
      updates.reviewStage = nextStage;
      updates.nextReviewTime = now + (daysToAdd * 24 * 60 * 60 * 1000);
      if (item.isInMistakePool) {
        updates.mistakeStreak = (item.mistakeStreak || 0) + 1;
        if (updates.mistakeStreak >= 5) { updates.isInMistakePool = false; updates.mistakeStreak = 0; }
      }
    } else {
      updates.failureCount = (item.failureCount || 0) + 1;
      updates.reviewStage = 0;
      updates.nextReviewTime = now;
      updates.isInMistakePool = true;
      updates.mistakeStreak = 0;
    }
    await this.db!.put('streets', { ...item, ...updates });
  }

  async generateQuiz(count: number): Promise<{question: StreetRecord, options: string[]}[]> {
    const all = await this.getAll();
    const uniqueAreas = Array.from(new Set(all.map(s => s.routeArea)));
    const shuffled = all.sort(() => 0.5 - Math.random()).slice(0, count);
    return shuffled.map(q => {
      const wrong = uniqueAreas.filter(a => a !== q.routeArea).sort(() => 0.5 - Math.random()).slice(0, 3);
      const options = [q.routeArea, ...wrong];
      while (options.length < 4) options.push(`区域 ${options.length}`);
      return { question: q, options: options.sort(() => 0.5 - Math.random()) };
    });
  }

  async search(query: string): Promise<StreetRecord[]> {
    const all = await this.getAll();
    const target = query.trim();
    if (!target) return [];
    const targetPinyin = getRawPinyin(target);
    return all.map(s => {
      let score = 0;
      if (s.streetName === target) score = 100;
      else if (s.streetName.includes(target)) score = 80;
      else if (s.companyName && s.companyName.includes(target)) score = 50;
      const sPinyin = s.pinyin || getRawPinyin(s.streetName);
      const similarity = 1 - (levenshtein(sPinyin, targetPinyin) / Math.max(sPinyin.length, targetPinyin.length));
      if (similarity > 0.8) score = Math.max(score, 70 + (similarity * 20));
      return { ...s, score };
    }).filter(s => s.score > 40).sort((a,b) => b.score - a.score).slice(0, 5);
  }

  async batchRecognize(text: string): Promise<{original: string, match: StreetRecord | null}[]> {
    if (!this.cachedStreets) this.cachedStreets = await this.getAll();
    const all = this.cachedStreets!;
    const results = [];
    let i = 0;
    while(i < text.length) {
      let bestMatch: StreetRecord | null = null;
      let bestLen = 0;
      for (let len = 10; len >= 2; len--) {
        if (i + len > text.length) continue;
        const chunk = text.substr(i, len);
        const match = all.find(s => s.streetName === chunk);
        if (match) { bestMatch = match; bestLen = len; break; }
      }
      if (bestMatch) { results.push({ original: text.substr(i, bestLen), match: bestMatch }); i += bestLen; }
      else i++;
    }
    return results;
  }
}

export const db = new DBService();