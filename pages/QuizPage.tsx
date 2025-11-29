import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, RefreshCw, Trophy, Settings2, Target, Edit3 } from 'lucide-react';
import { db } from '../services/db';
import { QuizQuestion, StreetRecord } from '../types';

export const QuizPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMistakeMode = searchParams.get('mode') === 'mistakes';
  const [gameState, setGameState] = useState<'start'|'playing'|'result'>('start');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState<StreetRecord[]>([]);
  const [questionCount, setQuestionCount] = useState(50);
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [totalAvailable, setTotalAvailable] = useState(0);

  useEffect(() => {
    const fetchTotal = async () => {
      await db.init();
      const all = await db.getAll();
      setTotalAvailable(isMistakeMode ? all.filter(s => s.failureCount > 0).length : all.length);
    };
    fetchTotal();
  }, [isMistakeMode]);

  const startQuiz = async () => {
    if (questionCount <= 0) return alert("请输入有效数量");
    const all = await db.getAll();
    let quizData: QuizQuestion[] = [];
    const actualCount = Math.min(questionCount, totalAvailable);

    if (isMistakeMode) {
      const mistakes = all.filter(s => s.failureCount > 0);
      if (mistakes.length === 0) { alert("暂无错题"); return navigate('/'); }
      const selected = mistakes.sort(() => 0.5 - Math.random()).slice(0, actualCount);
      const allAreas = Array.from(new Set(all.map(s => s.routeArea)));
      quizData = selected.map(q => {
        const wrong = allAreas.filter(a => a !== q.routeArea);
        const distractors = wrong.sort(() => 0.5 - Math.random()).slice(0, 3);
        while (distractors.length < 3) distractors.push("未知");
        return { question: q, options: [...distractors, q.routeArea].sort(() => 0.5 - Math.random()) };
      });
    } else {
      if (totalAvailable < 4) { alert("题目不足4条"); return navigate('/manage'); }
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

  const handleAnswer = async (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);
    const currentQ = questions[currentIndex];
    const isCorrect = option === currentQ.question.routeArea;
    if (isCorrect) setScore(s => s + 1);
    else {
      setWrongAnswers(p => [...p, currentQ.question]);
      await db.update(currentQ.question.id, { failureCount: (currentQ.question.failureCount || 0) + 1 });
    }
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(p => p + 1);
        setIsAnswered(false);
        setSelectedOption(null);
      } else setGameState('result');
    }, 1500);
  };

  if (gameState === 'start') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8 animate-fade-in-up">
        <div className="bg-brand-50 p-6 rounded-full mb-2 ring-4 ring-brand-100"><Trophy className="w-16 h-16 text-brand-600" /></div>
        <div><h2 className="text-2xl font-bold mb-2">{isMistakeMode ? '错题复习' : '路区测试'}</h2><p className="text-gray-500">共 {totalAvailable} 题可用</p></div>
        <div className="w-full max-w-xs bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-800 font-bold mb-4 text-sm"><Settings2 className="w-4 h-4 text-brand-500" /><span>设置数量</span></div>
          <div className="grid grid-cols-3 gap-3 mb-4">{[50, 100, 150].map(num => (<button key={num} onClick={() => { setQuestionCount(num); setIsCustomInput(false); }} className={`py-2 rounded-lg text-sm font-bold ${questionCount === num && !isCustomInput ? 'bg-brand-600 text-white' : 'bg-gray-50'}`}>{num}</button>))}</div>
          <div className="flex items-center border rounded-xl px-3 py-2"><Edit3 className="w-4 h-4 text-gray-400 mr-2" /><input type="number" min="1" value={questionCount} onClick={() => setIsCustomInput(true)} onChange={e => { setIsCustomInput(true); setQuestionCount(parseInt(e.target.value)||0); }} className="w-full outline-none font-bold" /></div>
        </div>
        <button onClick={startQuiz} disabled={totalAvailable === 0 || questionCount <= 0} className="w-full max-w-xs bg-brand-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">开始挑战</button>
      </div>
    );
  }

  if (gameState === 'result') {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="p-6 h-full overflow-y-auto pb-20">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center mb-6"><div className="text-6xl font-black mb-2 text-brand-600">{percentage}%</div><p>答对 {score} / {questions.length}</p></div>
        {wrongAnswers.length > 0 && <div className="space-y-3"><h3 className="font-bold flex items-center"><XCircle className="w-4 h-4 text-red-500 mr-1" />错题回顾</h3>{wrongAnswers.map((w, idx) => (<div key={idx} className="bg-red-50 p-4 rounded-xl flex justify-between items-center"><div>{w.streetName}</div><span className="font-bold text-red-600">{w.routeArea}</span></div>))}</div>}
        <div className="mt-8 space-y-3"><button onClick={startQuiz} className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold flex justify-center items-center space-x-2"><RefreshCw className="w-5 h-5" /><span>再练一次</span></button><button onClick={() => navigate('/')} className="w-full text-gray-400">返回首页</button></div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex justify-between text-xs font-bold text-gray-400 mb-2"><span>进度</span><span>{currentIndex + 1} / {questions.length}</span></div>
      <div className="w-full bg-gray-200 h-3 rounded-full mb-8"><div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-8"><h2 className="text-3xl font-bold leading-tight"><span className="text-brand-600 border-b-4 border-brand-200">{currentQ.question.streetName}</span><br/>属于哪个路区？</h2></div>
        <div className="space-y-3">{currentQ.options.map((opt, idx) => {
            let stateClass = "bg-white border-gray-200";
            if (isAnswered) {
              if (opt === currentQ.question.routeArea) stateClass = "bg-green-50 border-green-500 text-green-700";
              else if (opt === selectedOption) stateClass = "bg-red-50 border-red-500 text-red-700";
              else stateClass = "opacity-50";
            }
            return (<button key={idx} disabled={isAnswered} onClick={() => handleAnswer(opt)} className={`w-full p-4 rounded-xl border-2 text-left font-bold text-lg flex justify-between ${stateClass}`}><span>{opt}</span>{isAnswered && opt === currentQ.question.routeArea && <CheckCircle className="w-5 h-5" />}</button>);
          })}</div>
      </div>
    </div>
  );
};