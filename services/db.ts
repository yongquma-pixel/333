import { StreetRecord } from '../types';

const STORAGE_KEY = 'courier_app_data_v1';

// Seed data to make the app usable immediately
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

// --- 1. Enhanced Homophone Mapping for Address Correction ---
const HOMOPHONES: Record<string, string> = {
  // Numbers
  '幺': '一', '壹': '一', '妖': '一',
  '两': '二', '贰': '二',
  '叁': '三', '山': '三', '散': '三',
  '肆': '四', '司': '四', '死': '四',
  '伍': '五', '舞': '五',
  '陆': '路', '溜': '六', // '陆' usually maps to 'Road' in addresses, but 'Liù' is 6. Context hard, prioritizing Road.
  '柒': '七', '妻': '七', '戚': '七',
  '捌': '八', '发': '八', '爸': '八',
  '玖': '九', '酒': '九', '久': '九',
  '拾': '十', '石': '十', '实': '十', '时': '十',
  
  // Address Suffixes & Common Typos
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
  
  // Directions
  '冬': '东', 
  '难': '南', '男': '南',
  '吸': '西', '希': '西', '息': '西',
  '杯': '北', '背': '北',
};

// --- 2. Levenshtein Distance for Fuzzy Matching ---
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Helper: Normalize text by fixing homophones and removing noise
function normalizeText(text: string): string {
  // Replace standard punctuation with space to serve as natural separator
  let res = text.replace(/[，。、？！\s\n\t]+/g, ' '); 
  
  const chars = res.split('');
  // Map homophones but preserve spaces
  const fixedChars = chars.map(c => HOMOPHONES[c] || c);
  return fixedChars.join('');
}

export const db = {
  getAll: (): StreetRecord[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
      return SEED_DATA;
    }
    return JSON.parse(data);
  },

  saveAll: (data: StreetRecord[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  add: (street: Omit<StreetRecord, 'id' | 'createdAt' | 'failureCount'>) => {
    const streets = db.getAll();
    const newStreet: StreetRecord = {
      ...street,
      id: Date.now().toString(),
      failureCount: 0,
      createdAt: Date.now(),
    };
    streets.unshift(newStreet);
    db.saveAll(streets);
  },

  addMany: (items: Omit<StreetRecord, 'id' | 'createdAt' | 'failureCount'>[]) => {
    const streets = db.getAll();
    const existingNames = new Set(streets.map(s => s.streetName));
    
    let addedCount = 0;
    const timestamp = Date.now();
    
    const newRecords = items
      .filter(item => item.streetName && item.routeArea && !existingNames.has(item.streetName))
      .map((item, index) => ({
        ...item,
        id: `${timestamp}-${index}`, // Unique ID
        failureCount: 0,
        createdAt: timestamp
      }));
      
    if (newRecords.length > 0) {
      const updated = [...newRecords, ...streets];
      db.saveAll(updated);
      addedCount = newRecords.length;
    }
    return addedCount;
  },

  update: (id: string, updates: Partial<StreetRecord>) => {
    const streets = db.getAll();
    const index = streets.findIndex(s => s.id === id);
    if (index !== -1) {
      streets[index] = { ...streets[index], ...updates };
      db.saveAll(streets);
    }
  },

  delete: (id: string) => {
    const streets = db.getAll();
    const filtered = streets.filter(s => s.id !== id);
    db.saveAll(filtered);
  },

  // Logic for Quiz Generation
  generateQuiz: (count: number = 5): { question: StreetRecord, options: string[] }[] => {
    const streets = db.getAll();
    if (streets.length < 4) return []; // Not enough data

    // Shuffle and pick N
    const shuffled = [...streets].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    // Get all unique areas for options
    const allAreas = Array.from(new Set(streets.map(s => s.routeArea)));

    return selected.map(q => {
      // Correct answer
      const correct = q.routeArea;
      // Filter out correct answer from pool
      const wrongPool = allAreas.filter(a => a !== correct);
      
      // Pick 3 wrong answers. If not enough unique areas, duplicate/pad (edge case handling)
      let distractors: string[] = [];
      if (wrongPool.length >= 3) {
         distractors = wrongPool.sort(() => 0.5 - Math.random()).slice(0, 3);
      } else {
         // Fallback if user hasn't entered enough unique areas yet
         distractors = [...wrongPool, "未知区域A", "未知区域B"].slice(0, 3);
      }

      const options = [...distractors, correct].sort(() => 0.5 - Math.random());
      
      return {
        question: q,
        options
      };
    });
  },
  
  // Enhanced Search (Single Mode) with Weighted Scoring
  search: (query: string): StreetRecord[] => {
    if (!query) return [];
    const rawQ = query.toLowerCase().trim();
    const normalizedQ = normalizeText(rawQ).replace(/\s/g, ''); // Remove spaces for single search matching
    
    const streets = db.getAll();
    
    // Scoring System
    // Exact Match: 100
    // Pinyin Match: 90
    // Normalized Contain: 80
    // Fuzzy Match: 70 - (Distance * 10)
    
    const scored = streets.map(s => {
      let score = 0;
      const sName = s.streetName;
      const sPinyin = s.pinyin?.toLowerCase() || '';

      if (sName === rawQ) score = 100;
      else if (sPinyin === rawQ) score = 95;
      else if (sName.includes(rawQ)) score = 90;
      else if (sPinyin.includes(rawQ)) score = 85;
      else {
        // Normalized check
        const normName = normalizeText(sName).replace(/\s/g, '');
        if (normName.includes(normalizedQ)) score = 80;
        else {
          // Fuzzy check
          const dist = levenshtein(normalizedQ, normName);
          const allowedErrors = sName.length > 3 ? 2 : 1;
          if (dist <= allowedErrors) {
            score = 70 - (dist * 10);
          }
        }
      }
      return { street: s, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.street);
  },

  // Advanced Batch Recognition with Sliding Window Fuzzy Matching
  batchRecognize: (text: string): { original: string, match: StreetRecord | null }[] => {
    const streets = db.getAll();
    if (streets.length === 0) return [{ original: text, match: null }];

    const normalizedText = normalizeText(text); // e.g. "文三陆 文一西路"
    const results: { original: string, match: StreetRecord | null }[] = [];
    
    // Calculate window range based on DB data
    const lens = streets.map(s => s.streetName.length);
    const minLen = Math.max(2, Math.min(...lens)); // Minimal reasonable length for a street name
    const maxLen = Math.max(...lens);

    let cursor = 0;
    while (cursor < normalizedText.length) {
      // 1. Skip separators (like spaces introduced by normalization)
      // We treat them as non-matches or merge them into previous unknown text
      if (/\s/.test(normalizedText[cursor])) {
        const char = normalizedText[cursor];
        const last = results[results.length - 1];
        if (last && !last.match) {
           last.original += char;
        } else {
           // Only add if it's not just a space at start
           if (results.length > 0 || char.trim() !== '') {
             results.push({ original: char, match: null });
           }
        }
        cursor++;
        continue;
      }

      let bestMatch: StreetRecord | null = null;
      let bestDist = 100; // Arbitrary high distance
      let bestLen = 0;

      // 2. Sliding Window: Try lengths from Max down to Min
      // We scan allowed window sizes to find the "Best" match starting at current cursor
      const maxWindow = Math.min(maxLen + 1, normalizedText.length - cursor);
      
      for (let w = maxWindow; w >= minLen; w--) {
        const chunk = normalizedText.substr(cursor, w);
        
        for (const street of streets) {
          // Optimization: Skip if length difference is too big to be a match
          if (Math.abs(street.streetName.length - w) > 2) continue;

          const dist = levenshtein(chunk, street.streetName);
          
          // Strictness thresholds based on street length
          let threshold = 0;
          if (street.streetName.length >= 5) threshold = 2; // Long names tolerate 2 errors
          else if (street.streetName.length >= 3) threshold = 1; // Med names tolerate 1 error
          else threshold = 0; // Short names (2 chars) must match exactly (after normalization)

          if (dist <= threshold) {
             // We found a valid candidate. Is it better than the current best?
             // Priority 1: Lower Distance (Closer match)
             // Priority 2: Longer Length (More specific match)
             
             if (dist < bestDist) {
               bestMatch = street;
               bestDist = dist;
               bestLen = w;
             } else if (dist === bestDist) {
               // Tie-breaker: Prefer the match that corresponds to a longer street name
               // e.g. "文一西" matches "文一西路" (dist 1) vs "文一" (dist 1). Prefer "文一西路".
               if (street.streetName.length > (bestMatch?.streetName.length || 0)) {
                 bestMatch = street;
                 bestLen = w;
               }
             }
          }
        }
        
        // Optimization: If we found a perfect, long match, stop looking at smaller windows?
        // Actually, greedy match from Max to Min is usually safer for compound words.
        // But here we iterate Max to Min. If we find a dist=0 match at length W, 
        // a shorter length W-1 can't be "better" unless we prefer short words. 
        // We usually prefer long words (Maximal Munch).
        // However, "文一西路" vs "文一路". If input is "文一西路", w=4 matches exact.
        // If we break early, we keep that. Correct.
        if (bestDist === 0 && bestMatch && bestLen === w && w === streetLength(bestMatch)) {
           // We found an exact match of the full street name. Secure it.
           break; 
        }
      }
      
      function streetLength(s: StreetRecord) { return s.streetName.length; }

      if (bestMatch) {
        // Found a match!
        results.push({ original: normalizedText.substr(cursor, bestLen), match: bestMatch });
        cursor += bestLen;
      } else {
        // No match found at this cursor.
        // Treat current char as unknown.
        const char = normalizedText[cursor];
        const last = results[results.length - 1];
        if (last && !last.match) {
           last.original += char;
        } else {
           results.push({ original: char, match: null });
        }
        cursor++;
      }
    }

    return results;
  }
};
