
import { StreetRecord, TodoItem, HPA1Item, RelocationRecord } from '../types';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
// @ts-ignore
import { pinyin } from 'pinyin-pro';

const DB_NAME = 'courier_assistant_db';
const DB_VERSION = 5;

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

const HOMOPHONES: Record<string, string[]> = {
  '路': ['陆', '鹿', '录', '六'],
  '街': ['杰', '洁', '节', '阶'],
  '道': ['到', '稻'],
  '巷': ['项', '像'],
  '苑': ['院', '园', '元'],
  '桥': ['乔', '俏'],
  '一': ['幺', '1'],
  '二': ['两', '2'],
  '三': ['山', '3'],
  '四': ['是', '4'],
  '五': ['舞', '5'],
  '六': ['溜', '6'],
  '七': ['期', '7'],
  '八': ['发', '8'],
  '九': ['久', '9'],
  '十': ['石', '10'],
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

  async init() {
    if (this.db) return;
    this.db = await openDB<CourierDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('streets')) {
          db.createObjectStore('streets', { keyPath: 'id' });
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

  async add(record: Omit<StreetRecord, 'id' | 'failureCount' | 'createdAt'>) {
    if (!this.db) await this.init();
    const newRecord: StreetRecord = {
      ...record,
      id: Math.random().toString(36).substr(2, 9),
      failureCount: 0,
      createdAt: Date.now(),
    };
    await this.db!.add('streets', newRecord);
  }

  async addMany(records: Omit<StreetRecord, 'id' | 'failureCount' | 'createdAt'>[]): Promise<number> {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('streets', 'readwrite');
    const store = tx.objectStore('streets');
    for (const r of records) {
      await store.add({
        ...r,
        id: Math.random().toString(36).substr(2, 9),
        failureCount: 0,
        createdAt: Date.now()
      });
    }
    await tx.done;
    return records.length;
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
          createdAt: Date.now()
        });
        added++;
      }
    }
    await tx.done;
    return { added, updated };
  }

  async delete(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('streets', id);
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

  async generateQuiz(count: number): Promise<{question: StreetRecord, options: string[]}[]> {
    const all = await this.getAll();
    const uniqueAreas = Array.from(new Set(all.map(s => s.routeArea)));
    const shuffled = all.sort(() => 0.5 - Math.random()).slice(0, count);

    return shuffled.map(q => {
      const wrongAreas = uniqueAreas.filter(a => a !== q.routeArea);
      const options = [q.routeArea];
      
      // Add up to 3 wrong options
      const dist = wrongAreas.sort(() => 0.5 - Math.random()).slice(0, 3);
      options.push(...dist);
      
      // Pad if not enough unique areas
      while(options.length < 4) {
        options.push(`未知区域 ${options.length}`);
      }
      
      return {
        question: q,
        options: options.sort(() => 0.5 - Math.random())
      };
    });
  }

  // Enhanced Search with Homophone + Fuzzy + Sliding Window
  async search(query: string): Promise<StreetRecord[]> {
    if (!this.db) await this.init();
    const all = await this.getAll();
    const target = query.trim();
    if (!target) return [];

    const targetPinyin = getRawPinyin(target);

    // Scoring
    const scored = all.map(s => {
      let score = 0;
      
      // 1. Exact Match
      if (s.streetName === target) score = 100;
      else if (s.streetName.includes(target)) score = 80;
      
      // 2. Homophone Correction (Manual check)
      let correctedTarget = target;
      for (const [key, variants] of Object.entries(HOMOPHONES)) {
         variants.forEach(v => {
           correctedTarget = correctedTarget.replace(new RegExp(v, 'g'), key);
         });
      }
      if (s.streetName === correctedTarget) score = Math.max(score, 95);

      // 3. Pinyin Levenshtein
      const sPinyin = s.pinyin || getRawPinyin(s.streetName);
      const dist = levenshtein(sPinyin, targetPinyin);
      const maxLen = Math.max(sPinyin.length, targetPinyin.length);
      const similarity = 1 - (dist / maxLen);
      
      if (similarity > 0.8) score = Math.max(score, 70 + (similarity * 20));

      return { ...s, score };
    });

    return scored.filter(s => s.score > 60).sort((a,b) => b.score - a.score).slice(0, 5);
  }

  // Batch Recognition with Sliding Window
  async batchRecognize(text: string): Promise<{original: string, match: StreetRecord | null}[]> {
    if (!this.db) await this.init();
    const all = await this.getAll();
    const results: {original: string, match: StreetRecord | null}[] = [];
    
    // Normalize text: replace common homophones first for better segmentation chance
    let processedText = text;
    for (const [key, variants] of Object.entries(HOMOPHONES)) {
       variants.forEach(v => {
         processedText = processedText.replace(new RegExp(v, 'g'), key);
       });
    }

    // Sliding window strategy
    let i = 0;
    while(i < processedText.length) {
       let bestMatch: StreetRecord | null = null;
       let bestLen = 0;

       // Try windows of length 6 down to 2
       for (let len = 6; len >= 2; len--) {
         if (i + len > processedText.length) continue;
         const chunk = processedText.substr(i, len);
         
         // Direct check
         const match = all.find(s => s.streetName === chunk);
         if (match) {
           bestMatch = match;
           bestLen = len;
           break;
         }

         // Fuzzy check
         const chunkPinyin = getRawPinyin(chunk);
         const fuzzyMatch = all.find(s => {
             const sPinyin = s.pinyin || getRawPinyin(s.streetName);
             if (Math.abs(sPinyin.length - chunkPinyin.length) > 2) return false;
             const dist = levenshtein(sPinyin, chunkPinyin);
             return dist <= 1; // Very tolerant for short chunks
         });
         
         if (fuzzyMatch) {
            bestMatch = fuzzyMatch;
            bestLen = len;
            break;
         }
       }

       if (bestMatch) {
         results.push({ original: processedText.substr(i, bestLen), match: bestMatch });
         i += bestLen;
       } else {
         // Skip one char if no match
         i++;
       }
    }

    return results;
  }

  // --- Todos ---
  async getAllTodos(): Promise<TodoItem[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('todos');
  }

  async addTodo(content: string, imageUrl?: string) {
    if (!this.db) await this.init();
    const todo: TodoItem = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      isDone: false,
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
      imageUrl
    };
    await this.db!.add('todos', todo);
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
    const all = await this.getAllTodos();
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    
    const tx = this.db!.transaction('todos', 'readwrite');
    const store = tx.objectStore('todos');
    
    for (const todo of all) {
      if (todo.isDone && (now - todo.createdAt > SEVEN_DAYS)) {
        await store.delete(todo.id);
      }
    }
    await tx.done;
  }

  // --- HPA1 (Independent Store) ---
  
  async getAllHPA1(): Promise<HPA1Item[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('hpa1_items');
  }

  async addHPA1(trackingNumber: string, arrivalDate: string) {
    if (!this.db) await this.init();
    const item: HPA1Item = {
      id: Math.random().toString(36).substr(2, 9),
      trackingNumber,
      arrivalDate,
      status: 'pending',
      createdAt: Date.now()
    };
    await this.db!.add('hpa1_items', item);
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

  async mergeHPA1(items: Omit<HPA1Item, 'id' | 'createdAt' | 'status'>[]): Promise<{added: number, updated: number}> {
      if (!this.db) await this.init();
      const all = await this.getAllHPA1();
      const tx = this.db!.transaction('hpa1_items', 'readwrite');
      const store = tx.objectStore('hpa1_items');
      
      let added = 0;
      let updated = 0;
  
      for (const item of items) {
        const existing = all.find(r => r.trackingNumber === item.trackingNumber);
        if (existing) {
          await store.put({ ...existing, arrivalDate: item.arrivalDate });
          updated++;
        } else {
          await store.add({
            ...item,
            id: Math.random().toString(36).substr(2, 9),
            status: 'pending',
            createdAt: Date.now()
          });
          added++;
        }
      }
      await tx.done;
      return { added, updated };
  }

  // --- Relocations ---

  async getAllRelocations(): Promise<RelocationRecord[]> {
    if (!this.db) await this.init();
    return this.db!.getAll('relocations');
  }

  async addRelocation(record: Omit<RelocationRecord, 'id' | 'createdAt' | 'errorCount'>) {
    if (!this.db) await this.init();
    const item: RelocationRecord = {
      id: Math.random().toString(36).substr(2, 9),
      ...record,
      errorCount: 0,
      createdAt: Date.now()
    };
    await this.db!.add('relocations', item);
  }

  async addManyRelocations(records: Omit<RelocationRecord, 'id' | 'createdAt' | 'errorCount'>[]) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction('relocations', 'readwrite');
    const store = tx.objectStore('relocations');
    for (const r of records) {
        await store.add({
            ...r,
            id: Math.random().toString(36).substr(2, 9),
            errorCount: 0,
            createdAt: Date.now()
        });
    }
    await tx.done;
  }

  async mergeRelocations(records: Omit<RelocationRecord, 'id' | 'createdAt' | 'errorCount'>[]): Promise<{added: number, updated: number}> {
      if (!this.db) await this.init();
      const all = await this.getAllRelocations();
      const tx = this.db!.transaction('relocations', 'readwrite');
      const store = tx.objectStore('relocations');
      
      let added = 0;
      let updated = 0;

      for (const r of records) {
          // Merge strategy: Check phone number first (precise), then address
          let existing = all.find(ex => ex.phoneNumber && ex.phoneNumber === r.phoneNumber);
          if (!existing) {
              existing = all.find(ex => ex.oldAddress === r.oldAddress);
          }

          if (existing) {
              await store.put({ 
                  ...existing, 
                  newAddress: r.newAddress,
                  phoneNumber: r.phoneNumber || existing.phoneNumber 
              });
              updated++;
          } else {
              await store.add({
                  ...r,
                  id: Math.random().toString(36).substr(2, 9),
                  errorCount: 0,
                  createdAt: Date.now()
              });
              added++;
          }
      }
      await tx.done;
      return { added, updated };
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

  async searchRelocation(text: string): Promise<RelocationRecord[]> {
    if (!this.db) await this.init();
    const all = await this.getAllRelocations();
    const query = text.trim();
    if (!query) return [];

    // Check if query looks like a phone number (digits)
    const isPhoneQuery = /^\d+$/.test(query);

    return all.filter(r => {
        if (isPhoneQuery) {
            // Precise or partial match on phone
            return r.phoneNumber.includes(query);
        } else {
            // Fuzzy match on address
            const oldPinyin = getRawPinyin(r.oldAddress);
            const queryPinyin = getRawPinyin(query);
            
            // Direct containment
            if (r.oldAddress.includes(query)) return true;

            // Pinyin check (allow 1-2 char errors)
            const dist = levenshtein(oldPinyin, queryPinyin);
            // Allow fuzzy match based on length
            return dist <= 2;
        }
    });
  }
}

export const db = new DBService();
