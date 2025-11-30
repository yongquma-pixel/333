
import { StreetRecord, TodoItem, HPA1Item, RelocationRecord } from '../types';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
// @ts-ignore
import { pinyin } from 'pinyin-pro';

const DB_NAME = 'courier_assistant_db';
const DB_VERSION = 4; 

interface CourierDB extends DBSchema {
  streets: {
    key: string;
    value: StreetRecord;
  };
  todos: {
    key: string;
    value: TodoItem;
  };
  hpa1_items: {
    key: string;
    value: HPA1Item;
  };
  relocations: {
    key: string;
    value: RelocationRecord;
  };
}

// Seed data
const SEED_DATA: StreetRecord[] = [
  { id: '1', streetName: '文三路', routeArea: '西湖 1 区', pinyin: 'wensanlu', failureCount: 0, createdAt: Date.now() },
  { id: '2', streetName: '文一西路', routeArea: '余杭 5 区', pinyin: 'wenyixilu', failureCount: 0, createdAt: Date.now() },
  { id: '3', streetName: '博奥路', routeArea: '萧山 2 区', pinyin: 'bo aolu', failureCount: 0, createdAt: Date.now() },
  { id: '4', streetName: '解放东路', routeArea: '江干 3 区', pinyin: 'jiefangdonglu', failureCount: 0, createdAt: Date.now() },
  { id: '5', streetName: '延安路', routeArea: '上城 1 区', pinyin: 'yananlu', failureCount: 0, createdAt: Date.now() },
  { id: '6', streetName: '体育场路', routeArea: '下城 2 区', pinyin: 'tiyuchanglu', failureCount: 0, createdAt: Date.now() },
  { id: '7', streetName: '古墩路', routeArea: '西湖 3 区', pinyin: 'gudunlu', failureCount: 0, createdAt: Date.now() },
  { id: '8', streetName: '江南大道', routeArea: '滨江 1 区', pinyin: 'jiangnandadao', failureCount: 0, createdAt: Date.now() },
];

// --- HOMOPHONE & FUZZY LOGIC ---
const HOMOPHONES: Record<string, string> = {
  '幺': '一', '壹': '一', '妖': '一',
  '两': '二', '贰': '二',
  '叁': '三', '山': '三', '散': '三',
  '肆': '四', '司': '四', '死': '四',
  '伍': '五', '舞': '五',
  '陆': '路', '溜': '六',
  '柒': '七', '妻': '七', '戚': '七',
  '捌': '八', '发': '八', '爸': '八',
  '玖': '九', '酒': '九', '久': '九',
  '拾': '十', '石': '十', '实': '十', '时': '十',
  '路': '路', '鹭': '路', '露': '路', '录': '路', '鲁': '路', '鹿': '路',
  '街': '街', '阶': '街', '接': '街', '杰': '街', '洁': '街', '结': '街',
  '巷': '巷', '向': '巷', '象': '巷', '项': '巷',
  '道': '道', '到': '道', '导': '道', '岛': '道',
  '园': '苑', '院': '苑', '圆': '苑',
  '区': '区', '曲': '区',
  '号': '号', '豪': '号',
  '幢': '幢', '栋': '幢',
  '室': '室', '市': '室',
};

// Levenshtein distance for fuzzy matching
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

const getRawPinyin = (text: string) => {
  try {
    return pinyin(text, { toneType: 'none', type: 'string' }).replace(/\s/g, '');
  } catch (e) {
    return text;
  }
};

class DatabaseService {
  private db: IDBPDatabase<CourierDB> | null = null;

  async init() {
    if (this.db) return;
    this.db = await openDB<CourierDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('streets')) {
          const store = db.createObjectStore('streets', { keyPath: 'id' });
          SEED_DATA.forEach(item => store.add(item));
        }
        if (!db.objectStoreNames.contains('todos')) {
          db.createObjectStore('todos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('hpa1_items')) {
          db.createObjectStore('hpa1_items', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('relocations')) {
          db.createObjectStore('relocations', { keyPath: 'id' });
        }
      },
    });
  }

  // --- STREETS ---
  async getAll(): Promise<StreetRecord[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('streets');
  }

  async add(street: Omit<StreetRecord, 'id' | 'failureCount' | 'createdAt'>) {
    if (!this.db) await this.init();
    const newRecord: StreetRecord = {
      ...street,
      id: Math.random().toString(36).substr(2, 9),
      failureCount: 0,
      createdAt: Date.now(),
    };
    await this.db!.add('streets', newRecord);
  }

  async addMany(streets: Omit<StreetRecord, 'id' | 'failureCount' | 'createdAt'>[]) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('streets', 'readwrite');
    const store = tx.objectStore('streets');
    let count = 0;
    for (const s of streets) {
      await store.add({
        ...s,
        id: Math.random().toString(36).substr(2, 9),
        failureCount: 0,
        createdAt: Date.now(),
      });
      count++;
    }
    await tx.done;
    return count;
  }

  async update(id: string, updates: Partial<StreetRecord>) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('streets', 'readwrite');
    const store = tx.objectStore('streets');
    const item = await store.get(id);
    if (item) {
      await store.put({ ...item, ...updates });
    }
    await tx.done;
  }

  async delete(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('streets', id);
  }

  // --- SEARCH LOGIC ---
  private normalizeText(text: string): string {
    let normalized = text;
    for (const [key, value] of Object.entries(HOMOPHONES)) {
      normalized = normalized.split(key).join(value);
    }
    return normalized;
  }

  async search(query: string): Promise<StreetRecord[]> {
    if (!this.db) await this.init();
    const all = await this.getAll();
    const cleanQuery = this.normalizeText(query);
    const queryPinyin = getRawPinyin(cleanQuery);

    const scored = all.map(record => {
      let score = 0;
      const cleanName = this.normalizeText(record.streetName);
      const namePinyin = getRawPinyin(cleanName);

      // 1. Exact match (High Priority)
      if (cleanName === cleanQuery) score = 100;
      // 2. Contains match
      else if (cleanName.includes(cleanQuery)) score = 90;
      else if (cleanQuery.includes(cleanName)) score = 85;
      // 3. Pinyin Exact
      else if (namePinyin === queryPinyin) score = 80;
      // 4. Fuzzy Match (Levenshtein) - Allow ~1-2 char diff
      else {
        const dist = levenshtein(cleanName, cleanQuery);
        if (dist <= 2) score = 70 - dist * 10;
        
        // Pinyin Fuzzy
        const pinyinDist = levenshtein(namePinyin, queryPinyin);
        if (pinyinDist <= 2 && pinyinDist < dist) score = 75 - pinyinDist * 10;
      }

      return { record, score };
    });

    return scored
      .filter(item => item.score > 60)
      .sort((a, b) => b.score - a.score)
      .map(item => item.record);
  }

  async batchRecognize(transcript: string): Promise<{ original: string; match: StreetRecord | null }[]> {
    if (!this.db) await this.init();
    const allStreets = await this.getAll();
    const cleanTranscript = this.normalizeText(transcript);
    const transcriptPinyin = getRawPinyin(cleanTranscript);

    // Identify all matches using a sliding window
    const matches: { start: number; end: number; record: StreetRecord; score: number }[] = [];

    // Simple brute-force sliding window against all streets
    // In a real app with 10k streets, we'd use a Trie or Aho-Corasick.
    // For local indexedDB with < 500 streets, this is fine.
    
    for (const street of allStreets) {
      const cleanName = this.normalizeText(street.streetName);
      
      // 1. Direct Substring Check
      let idx = cleanTranscript.indexOf(cleanName);
      while (idx !== -1) {
        matches.push({ start: idx, end: idx + cleanName.length, record: street, score: 100 });
        idx = cleanTranscript.indexOf(cleanName, idx + 1);
      }

      // 2. Fuzzy Pinyin Window Check (Simplified)
      const namePinyin = getRawPinyin(cleanName);
      // Heuristic: If we can't find direct match, check if pinyin exists loosely
      // This part is complex to implement perfectly efficiently in client-side JS without pre-indexing pinyin.
      // We will skip heavy fuzzy windowing for "Batch" mode performance, relying on clean transcript.
    }

    // Sort matches by position, then length (greedy)
    matches.sort((a, b) => a.start - b.start || (b.end - a.end) - (b.end - a.end));

    // Resolve overlaps
    const finalSegments: { original: string; match: StreetRecord | null }[] = [];
    let cursorPos = 0;

    // We need to map back to original transcript indices roughly
    // This is hard because normalization changes length.
    // For simplicity, we just output the found streets and the "gaps" as unknown text.
    
    let activeMatches = matches.filter((m, i, arr) => {
        // Filter completely contained matches (e.g. "文三" inside "文三路")
        return !arr.some(other => other !== m && other.start <= m.start && other.end >= m.end && (other.end - other.start > m.end - m.start));
    });

    // Sort again
    activeMatches.sort((a, b) => a.start - b.start);

    for (const match of activeMatches) {
        // Gap before match? (In normalized space)
        // We actually want to show the USER what was recognized.
        // Since we normalized, we lost the original mapping.
        // Fallback: Just return the list of matched streets for the batch list.
        // To make the UI nice, we just return the matched streets.
    }
    
    // Better Batch Strategy for UI:
    // Just return the list of uniquely identified streets in order of appearance
    return activeMatches.map(m => ({
        original: m.record.streetName, // We display the canonical name
        match: m.record
    }));
  }

  // --- TODOS ---
  async getAllTodos(): Promise<TodoItem[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('todos');
  }

  async addTodo(content: string, imageUrl?: string) {
    if (!this.db) await this.init();
    const newTodo: TodoItem = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      isDone: false,
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
      imageUrl
    };
    await this.db!.add('todos', newTodo);
  }

  async toggleTodo(id: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('todos', 'readwrite');
    const store = tx.objectStore('todos');
    const item = await store.get(id);
    if (item) {
      item.isDone = !item.isDone;
      await store.put(item);
    }
    await tx.done;
  }

  async deleteTodo(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('todos', id);
  }

  async cleanupOldTodos() {
    if (!this.db) await this.init();
    const todos = await this.getAllTodos();
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const tx = this.db!.transaction('todos', 'readwrite');
    const store = tx.objectStore('todos');
    for (const t of todos) {
      if (t.isDone && (now - t.createdAt > SEVEN_DAYS)) {
        await store.delete(t.id);
      }
    }
    await tx.done;
  }

  // --- QUIZ GENERATION ---
  async generateQuiz(count: number): Promise<{question: StreetRecord, options: string[]}[]> {
    if (!this.db) await this.init();
    const all = await this.getAll();
    if (all.length < 4) return [];

    const shuffled = all.sort(() => 0.5 - Math.random()).slice(0, count);
    const allAreas = Array.from(new Set(all.map(s => s.routeArea)));

    return shuffled.map(q => {
      const otherAreas = allAreas.filter(a => a !== q.routeArea);
      const distractors = otherAreas.sort(() => 0.5 - Math.random()).slice(0, 3);
      // Fill if not enough areas
      while (distractors.length < 3) {
        distractors.push(`未知路区 ${Math.floor(Math.random()*10)}`);
      }
      const options = [...distractors, q.routeArea].sort(() => 0.5 - Math.random());
      return { question: q, options };
    });
  }

  // --- STORAGE STATS ---
  async getStorageStats() {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      const usedMB = ((usage || 0) / 1024 / 1024).toFixed(2);
      const quotaGB = ((quota || 0) / 1024 / 1024 / 1024).toFixed(1);
      return { usedMB, remainingGB: quotaGB, percentUsed: 0 };
    }
    return { usedMB: "0", remainingGB: "0", percentUsed: 0 };
  }

  // --- HP-A-1 ---
  async getAllHPA1(): Promise<HPA1Item[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('hpa1_items');
  }

  async addHPA1(trackingNumber: string, arrivalDate: string) {
    if (!this.db) await this.init();
    const newItem: HPA1Item = {
      id: Math.random().toString(36).substr(2, 9),
      trackingNumber,
      arrivalDate,
      status: 'pending',
      createdAt: Date.now()
    };
    await this.db!.add('hpa1_items', newItem);
  }

  async updateHPA1(id: string, updates: Partial<HPA1Item>) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('hpa1_items', 'readwrite');
    const store = tx.objectStore('hpa1_items');
    const item = await store.get(id);
    if (item) {
      await store.put({ ...item, ...updates });
    }
    await tx.done;
  }

  async completeHPA1(id: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('hpa1_items', 'readwrite');
    const store = tx.objectStore('hpa1_items');
    const item = await store.get(id);
    if (item) {
      item.status = 'paid';
      await store.put(item);
    }
    await tx.done;
  }

  // --- RELOCATIONS ---
  async getAllRelocations(): Promise<RelocationRecord[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('relocations');
  }

  async addRelocation(data: Omit<RelocationRecord, 'id' | 'createdAt' | 'errorCount'>) {
    if (!this.db) await this.init();
    const newItem: RelocationRecord = {
      id: Math.random().toString(36).substr(2, 9),
      ...data,
      errorCount: 0,
      createdAt: Date.now()
    };
    await this.db!.add('relocations', newItem);
  }

  async addManyRelocations(items: Omit<RelocationRecord, 'id' | 'createdAt' | 'errorCount'>[]) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('relocations', 'readwrite');
    const store = tx.objectStore('relocations');
    for (const item of items) {
       await store.add({
         id: Math.random().toString(36).substr(2, 9),
         ...item,
         errorCount: 0,
         createdAt: Date.now()
       });
    }
    await tx.done;
  }

  async deleteRelocation(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('relocations', id);
  }

  async incrementRelocationError(id: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('relocations', 'readwrite');
    const store = tx.objectStore('relocations');
    const item = await store.get(id);
    if (item) {
        item.errorCount = (item.errorCount || 0) + 1;
        await store.put(item);
    }
    await tx.done;
  }

  async searchRelocation(query: string): Promise<RelocationRecord[]> {
    if (!this.db) await this.init();
    if (!query) return [];
    
    const all = await this.getAllRelocations();
    const cleanQuery = this.normalizeText(query);
    const queryPinyin = getRawPinyin(cleanQuery);

    return all.filter(item => {
        // 1. Phone number match (Partial or Exact)
        if (query.match(/^\d+$/) && item.phoneNumber.includes(query)) return true;

        // 2. Old Address Fuzzy Match
        const cleanOld = this.normalizeText(item.oldAddress);
        if (cleanOld.includes(cleanQuery)) return true;
        
        // Fuzzy
        const dist = levenshtein(cleanOld, cleanQuery);
        if (dist <= 2) return true;

        return false;
    });
  }
}

export const db = new DatabaseService();
