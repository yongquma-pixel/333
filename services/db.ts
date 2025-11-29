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
  
  // Logic for Search
  search: (query: string): StreetRecord[] => {
    if (!query) return [];
    const lowerQ = query.toLowerCase();
    const streets = db.getAll();
    return streets.filter(s => 
      s.streetName.toLowerCase().includes(lowerQ) || 
      (s.pinyin && s.pinyin.toLowerCase().includes(lowerQ))
    );
  }
};
