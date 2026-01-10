
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, RefreshCw, Trophy, Settings2, Target, Edit3, ArrowRight, BrainCircuit, CalendarClock, Flame, Building2 } from 'lucide-react';
import { db } from '../services/db';
import { QuizQuestion, StreetRecord } from '../types';

// Sound effect helper using Web Audio API
const playSound = (type: 'correct' | 'wrong') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const QuizPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode'); 
  const isReviewMode = mode === 'review';
  const isMistakeMode = mode === 'mistake';
  
  const [gameState, setGameState] = useState<'start'|'playing'|'result'>('start');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState<StreetRecord[]>([]);
  const [questionCount, setQuestionCount] = useState(50);
  const [isCustomInput, setIsCustomInput] = useState(false);
  
  const [dueCount, setDueCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      await db.init();
      const all = await db.getAll();
      setTotalQuestions(all.length);
      const due = await db.getDueStreets();
      setDueCount(due.length);
      const mistakes = await db.getMistakePool();
      setMistakeCount(mistakes.length);
    };
    fetchStats();
  }, []);

  const startQuiz = async () => {
    await db.init();
    const all = await db.getAll();
    let quizData: QuizQuestion[] = [];
    
    if (isReviewMode) {
      const dueItems = await db.getDueStreets();
      if (dueItems.length === 0) { alert("暂无需要复习的题目！"); return navigate('/'); }
      quizData = generateQuizFromItems(dueItems, all);
    } else if (isMistakeMode) {
      const mistakes = await db.getMistakePool();
      if (mistakes.length === 0) { alert("太棒了！错题本是空的！"); return navigate('/'); }
      quizData = generateQuizFromItems(mistakes, all);
    } else {
      if (all.length < 4) { alert("题目不足4条，请先录入"); return navigate('/manage'); }
      const actualCount = Math.min(questionCount, all.length);
      quizData = await db.generateQuiz(actualCount);
    }

    setQuestions(quizData);
    setCurrentIndex(0);
    setScore(0);
    setWrongAnswers([]);
    setGameState('playing');
    setIsAnswered(false);
    setSelectedOption(null);
  };

  const generateQuizFromItems = (items: StreetRecord[], allStreets: StreetRecord[]): QuizQuestion[] => {
    const allAreas = Array.from(new Set(allStreets.map(s => s.routeArea)));
    return items.map(q => {
      const wrong = allAreas.filter(a => a !== q.routeArea);
      const distractors = wrong.sort(() => 0.5 - Math.random()).slice(0, 3);
      while (distractors.length < 3) distractors.push("未知");
      return { question: q, options: [...distractors, q.routeArea].sort(() => 0.5 - Math.random()) };
    });
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(p => p + 1);
      setIsAnswered(false);
      setSelectedOption(null);
    } else {
      setGameState('result');
    }
  };

  const handleAnswer = async (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);
    const currentQ = questions[currentIndex];
    const isCorrect = option === currentQ.question.routeArea;
    
    playSound(isCorrect ? 'correct' : 'wrong');
    await db.processQuizResult(currentQ.question.id, isCorrect);
    
    if (isCorrect) {
      setScore(s => s + 1);
      setTimeout(nextQuestion, 600);
    } else {
      setWrongAnswers(p => [...p, currentQ.question]);
    }
  };

  if (gameState === 'start') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8 animate-fade-in-up">
        <div className={`p-6 rounded-full mb-2 ring-4 ${isMistakeMode ? 'bg-red-50 ring-red-100' : isReviewMode ? 'bg-amber-50 ring-amber-100' : 'bg-brand-50 ring-brand-100'}`}>
            {isMistakeMode ? <XCircle className="w-16 h-16 text-red-600" /> : isReviewMode ? <CalendarClock className="w-16 h-16 text-amber-600" /> : <Trophy className="w-16 h-16 text-brand-600" />}
        </div>
        
        <div>
            <h2 className="text-2xl font-bold mb-2">
                {isMistakeMode ? '强化错题本' : isReviewMode ? '智能复习' : '随机练习'}
            </h2>
            <p className="text-gray-500 text-sm px-4">
                {isMistakeMode 
                  ? "死磕模式：错题需连续答对 5 次才能移出题库" 
                  : isReviewMode 
                    ? "基于艾宾浩斯遗忘曲线，按时复习" 
                    : `全题库随机抽取，共 ${totalQuestions} 题`}
            </p>
            
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {isReviewMode && (
                  <div className="px-4 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                      {dueCount} 个待复习
                  </div>
              )}
              {isMistakeMode && (
                  <div className="px-4 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                      {mistakeCount} 个重点攻克
                  </div>
              )}
            </div>
        </div>

        {!isReviewMode && !isMistakeMode && (
             <div className="w-full max-w-xs bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center space-x-2 text-gray-800 font-bold mb-4 text-sm"><Settings2 className="w-4 h-4 text-brand-500" /><span>设置数量</span></div>
                <div className="grid grid-cols-3 gap-3 mb-4">{[50, 100, 150].map(num => (<button key={num} onClick={() => { setQuestionCount(num); setIsCustomInput(false); }} className={`py-2 rounded-lg text-sm font-bold ${questionCount === num && !isCustomInput ? 'bg-brand-600 text-white' : 'bg-gray-50'}`}>{num}</button>))}</div>
                <div className="flex items-center border rounded-xl px-3 py-2"><Edit3 className="w-4 h-4 text-gray-400 mr-2" /><input type="number" min="1" value={questionCount} onClick={() => setIsCustomInput(true)} onChange={e => { setIsCustomInput(true); setQuestionCount(parseInt(e.target.value)||0); }} className="w-full outline-none font-bold" /></div>
            </div>
        )}

        <button 
            onClick={startQuiz} 
            disabled={(!isReviewMode && !isMistakeMode && (totalQuestions === 0 || questionCount <= 0)) || (isReviewMode && dueCount === 0) || (isMistakeMode && mistakeCount === 0)}
            className={`w-full max-w-xs text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 transition-all active:scale-95 ${isMistakeMode ? 'bg-red-600' : isReviewMode ? 'bg-amber-600' : 'bg-brand-600'}`}
        >
            <span>开始练习</span>
            <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  if (gameState === 'result') {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="p-6 h-full overflow-y-auto pb-20 animate-fade-in-up">
        <div className="bg-white rounded-3xl shadow-sm border p-8 text-center mb-6">
          <div className="text-6xl font-black mb-2 text-brand-600">{percentage}%</div>
          <p className="text-gray-500 font-medium">答对 {score} / {questions.length}</p>
        </div>
        {wrongAnswers.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-black text-gray-800 flex items-center px-1">
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
              需要消化的路名
            </h3>
            {wrongAnswers.map((w, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border-2 border-red-50 flex justify-between items-center shadow-sm">
                <div>
                  <div className="font-black text-gray-800">{w.streetName}</div>
                  {w.companyName && <div className="text-[10px] text-gray-400">{w.companyName}</div>}
                </div>
                <span className="font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg">{w.routeArea}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-8 space-y-3">
          <button onClick={startQuiz} className="w-full bg-brand-600 text-white py-4 rounded-2xl font-black flex justify-center items-center space-x-2 shadow-lg active:scale-95 transition-all">
            <RefreshCw className="w-5 h-5" />
            <span>再练一次</span>
          </button>
          <button onClick={() => navigate('/')} className="w-full text-gray-400 font-bold py-2">返回首页</button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="h-full flex flex-col p-6 animate-fade-in">
      <div className="flex justify-between text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
        <span>PROGRESS</span>
        <span>{currentIndex + 1} / {questions.length}</span>
      </div>
      <div className="w-full bg-gray-100 h-3 rounded-full mb-8 overflow-hidden">
        <div className="bg-brand-500 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-2 flex items-center space-x-2">
            {isMistakeMode && (
                <div className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center">
                    <Flame className="w-3 h-3 mr-1" />
                    死磕进度: {currentQ.question.mistakeStreak || 0} / 5
                </div>
            )}
            {isReviewMode && <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">复习模式</span>}
        </div>

        <div className="mb-8">
          <div className="text-3xl font-black text-gray-900 leading-tight">
             <span className="inline-block relative">
               {currentQ.question.streetName}
               <div className="absolute -bottom-1 left-0 w-full h-2 bg-brand-100 -z-10"></div>
             </span>
             <div className="text-xl text-gray-400 mt-2">属于哪个路区？</div>
          </div>
          {currentQ.question.companyName && (
            <div className="mt-4 flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-xl w-fit font-bold border border-green-100 text-sm">
              <Building2 className="w-4 h-4 mr-2" />
              {currentQ.question.companyName}
            </div>
          )}
        </div>
        
        <div className="space-y-3">
          {currentQ.options.map((opt, idx) => {
            let stateClass = "bg-white border-gray-100 hover:border-brand-200";
            if (isAnswered) {
              if (opt === currentQ.question.routeArea) stateClass = "bg-green-50 border-green-500 text-green-700 ring-4 ring-green-100";
              else if (opt === selectedOption) stateClass = "bg-red-50 border-red-500 text-red-700 ring-4 ring-red-100";
              else stateClass = "opacity-40 grayscale";
            }
            return (
              <button 
                key={idx} 
                disabled={isAnswered} 
                onClick={() => handleAnswer(opt)} 
                className={`w-full p-5 rounded-2xl border-2 text-left font-black text-xl flex justify-between items-center transition-all active:scale-95 ${stateClass}`}
              >
                <span>{opt}</span>
                {isAnswered && opt === currentQ.question.routeArea && <CheckCircle className="w-6 h-6" />}
              </button>
            );
          })}
        </div>
          
        {isAnswered && selectedOption !== currentQ.question.routeArea && (
            <button onClick={nextQuestion} className="mt-8 w-full bg-brand-600 text-white py-4 rounded-2xl font-black flex justify-center items-center shadow-xl animate-fade-in-up">
              下一题 <ArrowRight className="w-5 h-5 ml-2" />
            </button>
        )}
      </div>
    </div>
  );
};
