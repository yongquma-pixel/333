import { StreetRecord, TodoItem } from '../types';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
// @ts-ignore
import { pinyin } from 'pinyin-pro';

const DB_NAME = 'courier_assistant_db';
const DB_VERSION = 1;
const OLD_STORAGE_KEY = 'courier_app_data_v1';
const OLD_TODO_KEY = 'courier_app_todos_v1';

interface CourierDB extends DBSchema {
  streets: {
    key: string;
    value: StreetRecord;
  };
  todos: {
    key: string;
    value: TodoItem;
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

// --- HOMOPHONE & FUZZY LOGIC (Kept same) ---
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
  '街': '街', '阶': '街', '接': '街', '杰': '街', '洁': '街', '结': '街', '节': '街',
  '巷': '巷', '向': '巷', '像': '巷', '项': '巷', '相': '巷', '象': '巷',
  '道': '道', '到': '道', '岛': '道', '导': '道', '刀': '道',
  '区': '区', '曲': '区', '去': '区', '驱': '区', '屈': '区',
  '苑': '苑', '院': '苑', '园': '苑', '源': '苑', '圆': '苑',
  '弄': '弄', '龙': '弄', '隆': '弄', '笼': '弄',
  '号': '号', '耗': '号', '豪': '号',
  '栋': '栋', '动': '栋', '洞': '栋',
  '幢': '幢', '撞': '幢', '壮': '幢', '装': '幢',
  '室': '室', '是': '室', '士': '室', '市': '室',
  '冬': '东', 
  '难': '南', '男': '南',
  '吸': '西', '希': '西', '息': '西',
  '杯': '北', '背': '北',
};

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

function normalizeText(text: string): string {
  let res = text.replace(/[，。、？！\s\n\t]+/g, ' '); 
  const chars = res.split('');
  const fixedChars = chars.map(c => HOMOPHONES[c] || c);
  return fixedChars.join('');
}

function getRawPinyin(text: string): string {
  try {
    return pinyin(text, { toneType: 'none', type: 'string' }).replace(/\s/g, '');
  } catch (e) {
    return '';
  }
}

// --- DB INSTANCE ---
let dbPromise: Promise<IDBPDatabase<CourierDB>>;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CourierDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('streets')) {
          db.createObjectStore('streets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('todos')) {
          db.createObjectStore('todos', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// --- API ---
export const db = {
  // Initialization & Migration
  init: async () => {
    const database = await getDB();
    
    // Check if we need to seed or migrate
    const count = await database.count('streets');
    
    // 1. Migrate from LocalStorage if exists and DB is empty
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldData && count === 0) {
      console.log("Migrating Streets from LocalStorage to IndexedDB...");
      const parsed = JSON.parse(oldData) as StreetRecord[];
      const tx = database.transaction('streets', 'readwrite');
      for (const item of parsed) {
        await tx.store.put(item);
      }
      await tx.done;
      localStorage.removeItem(OLD_STORAGE_KEY); // Cleanup
    } else if (count === 0) {
      // 2. Seed if empty and no old data
      const tx = database.transaction('streets', 'readwrite');
      for (const item of SEED_DATA) {
        await tx.store.put(item);
      }
      await tx.done;
    }

    // Migrate Todos
    const oldTodos = localStorage.getItem(OLD_TODO_KEY);
    const todoCount = await database.count('todos');
    if (oldTodos && todoCount === 0) {
      console.log("Migrating Todos...");
      const parsed = JSON.parse(oldTodos) as TodoItem[];
      const tx = database.transaction('todos', 'readwrite');
      for (const item of parsed) {
        await tx.store.put(item);
      }
      await tx.done;
      localStorage.removeItem(OLD_TODO_KEY);
    }
  },

  // --- STREETS CRUD ---
  getAll: async (): Promise<StreetRecord[]> => {
    const database = await getDB();
    return database.getAll('streets');
  },

  add: async (street: Omit<StreetRecord, 'id' | 'createdAt' | 'failureCount'>) => {
    const database = await getDB();
    const newStreet: StreetRecord = {
      ...street,
      id: Date.now().toString(),
      failureCount: 0,
      createdAt: Date.now(),
    };
    await database.put('streets', newStreet);
  },

  addMany: async (items: Omit<StreetRecord, 'id' | 'createdAt' | 'failureCount'>[]) => {
    const database = await getDB();
    const all = await database.getAll('streets');
    const existingNames = new Set(all.map(s => s.streetName));
    
    const timestamp = Date.now();
    const tx = database.transaction('streets', 'readwrite');
    let count = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.streetName && item.routeArea && !existingNames.has(item.streetName)) {
        await tx.store.put({
          ...item,
          id: `${timestamp}-${i}`,
          failureCount: 0,
          createdAt: timestamp
        });
        count++;
      }
    }
    await tx.done;
    return count;
  },

  update: async (id: string, updates: Partial<StreetRecord>) => {
    const database = await getDB();
    const item = await database.get('streets', id);
    if (item) {
      await database.put('streets', { ...item, ...updates });
    }
  },

  delete: async (id: string) => {
    const database = await getDB();
    await database.delete('streets', id);
  },

  // --- SEARCH & QUIZ ---
  generateQuiz: async (count: number = 5): Promise<{ question: StreetRecord, options: string[] }[]> => {
    const streets = await db.getAll();
    if (streets.length < 4) return [];

    const shuffled = [...streets].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    const allAreas = Array.from(new Set(streets.map(s => s.routeArea)));

    return selected.map(q => {
      const correct = q.routeArea;
      const wrongPool = allAreas.filter(a => a !== correct);
      let distractors: string[] = [];
      if (wrongPool.length >= 3) {
         distractors = wrongPool.sort(() => 0.5 - Math.random()).slice(0, 3);
      } else {
         distractors = [...wrongPool, "未知区域A", "未知区域B"].slice(0, 3);
      }
      return {
        question: q,
        options: [...distractors, correct].sort(() => 0.5 - Math.random())
      };
    });
  },

  search: async (query: string): Promise<StreetRecord[]> => {
    if (!query) return [];
    const streets = await db.getAll();
    const rawQ = query.toLowerCase().trim();
    const normalizedQ = normalizeText(rawQ).replace(/\s/g, '');
    const pinyinQ = getRawPinyin(rawQ);

    const scored = streets.map(s => {
      let score = 0;
      const sName = s.streetName;
      const sPinyin = s.pinyin?.toLowerCase() || getRawPinyin(sName);

      if (sName === rawQ) score = 100;
      else if (sPinyin === pinyinQ && pinyinQ.length > 2) score = 95; // Pinyin exact match
      else if (sName.includes(rawQ)) score = 90;
      else if (sPinyin.includes(pinyinQ) && pinyinQ.length > 2) score = 85;
      else {
        const normName = normalizeText(sName).replace(/\s/g, '');
        if (normName.includes(normalizedQ)) score = 80;
        else {
          const charDist = levenshtein(normalizedQ, normName);
          const pinyinDist = levenshtein(pinyinQ, sPinyin);
          
          // Mixed distance score
          if (charDist <= 1) score = 75;
          else if (pinyinDist <= 1 && pinyinQ.length > 3) score = 72; // Close pinyin
          else if (charDist <= 2) score = 60;
        }
      }
      return { street: s, score };
    });

    return scored
      .filter(item => item.score > 60)
      .sort((a, b) => b.score - a.score)
      .map(item => item.street);
  },

  // Optimized for async: Fetch once, then process
  batchRecognize: async (text: string): Promise<{ original: string, match: StreetRecord | null }[]> => {
    const streets = await db.getAll();
    if (streets.length === 0) return [{ original: text, match: null }];

    const normalizedText = normalizeText(text);
    const textPinyin = getRawPinyin(normalizedText);
    const results: { original: string, match: StreetRecord | null }[] = [];
    
    const lens = streets.map(s => s.streetName.length);
    const minLen = Math.max(2, Math.min(...lens));
    const maxLen = Math.max(...lens);

    let cursor = 0;
    // Map of street pinyins for fast lookup could be optimized here, but array iteration is fine for <5000
    
    while (cursor < normalizedText.length) {
      if (/\s/.test(normalizedText[cursor])) {
        // Handle spaces
        const last = results[results.length - 1];
        if (last && !last.match) last.original += normalizedText[cursor];
        else results.push({ original: normalizedText[cursor], match: null });
        cursor++;
        continue;
      }

      let bestMatch: StreetRecord | null = null;
      let bestScore = 0;
      let bestLen = 0;

      const maxWindow = Math.min(maxLen + 1, normalizedText.length - cursor);
      
      for (let w = maxWindow; w >= minLen; w--) {
        const chunk = normalizedText.substr(cursor, w);
        const chunkPinyin = getRawPinyin(chunk);
        
        for (const street of streets) {
           if (Math.abs(street.streetName.length - w) > 2) continue;

           const sName = street.streetName;
           const sPinyin = street.pinyin || getRawPinyin(sName);

           const charDist = levenshtein(chunk, sName);
           const pinyinDist = levenshtein(chunkPinyin, sPinyin);

           let score = 0;
           // Strict scoring for batch
           if (charDist === 0) score = 100;
           else if (pinyinDist === 0) score = 95;
           else if (charDist === 1 && sName.length >= 3) score = 80;
           else if (pinyinDist === 1 && sName.length >= 3) score = 75;

           if (score > bestScore) {
             bestMatch = street;
             bestScore = score;
             bestLen = w;
           }
        }
        if (bestScore >= 95) break; // Optimization: Stop if exact match found
      }

      if (bestMatch && bestScore >= 75) {
        results.push({ original: normalizedText.substr(cursor, bestLen), match: bestMatch });
        cursor += bestLen;
      } else {
        const char = normalizedText[cursor];
        const last = results[results.length - 1];
        if (last && !last.match) last.original += char;
        else results.push({ original: char, match: null });
        cursor++;
      }
    }
    return results;
  },

  // --- TODOS CRUD ---
  getAllTodos: async (): Promise<TodoItem[]> => {
    const database = await getDB();
    return database.getAll('todos');
  },

  addTodo: async (content: string, imageUrl?: string) => {
    const database = await getDB();
    const newTodo: TodoItem = {
      id: Date.now().toString(),
      content,
      isDone: false,
      date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      createdAt: Date.now(),
      imageUrl
    };
    await database.put('todos', newTodo);
  },

  toggleTodo: async (id: string) => {
    const database = await getDB();
    const item = await database.get('todos', id);
    if (item) {
      await database.put('todos', { ...item, isDone: !item.isDone });
    }
  },

  deleteTodo: async (id: string) => {
    const database = await getDB();
    await database.delete('todos', id);
  },

  cleanupOldTodos: async () => {
    const database = await getDB();
    const all = await database.getAll('todos');
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const tx = database.transaction('todos', 'readwrite');
    
    for (const t of all) {
      if (t.isDone && (now - t.createdAt) > SEVEN_DAYS) {
        await tx.store.delete(t.id);
      }
    }
    await tx.done;
  },

  // --- STORAGE STATS (New API) ---
  getStorageStats: async () => {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const remaining = quota - used;
      
      return {
        usedMB: (used / 1024 / 1024).toFixed(2),
        remainingGB: (remaining / 1024 / 1024 / 1024).toFixed(2),
        percentUsed: Math.round((used / quota) * 100) || 0
      };
    } else {
      // Fallback
      return { usedMB: "0", remainingGB: "Unknown", percentUsed: 0 };
    }
  }
};