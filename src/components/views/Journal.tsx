import React, { useEffect, useState } from 'react';
import { useLogbookStore, getTargetCalories, getTargetMacros } from '../../store/useLogbookStore';
import { ProgressBar } from '../ui/ProgressBar';
import { calculateDayTotals, calculateRecipeMacrosPer100g } from '../../utils/metabolism';
import { 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Scale, 
  Utensils, 
  Sparkles,
  AlertCircle,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink
} from 'lucide-react';
import { db, type LogbookDay, type LogbookEntry } from '../../db';

// Formatteur de date premium en français
const formatJournalDate = (dateStr: string) => {
  const today = new Date();
  const date = new Date(dateStr + 'T12:00:00'); // Évite les décalages horaires
  
  const formatDateString = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = formatDateString(today);
  
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatDateString(yesterday);

  if (dateStr === todayStr) {
    return "Aujourd'hui";
  } else if (dateStr === yesterdayStr) {
    return 'Hier';
  } else {
    const formatted = date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
};

export const Journal: React.FC = () => {
  const {
    selectedDate,
    currentDay,
    settings,
    customFoods,
    recipes,
    setSelectedDate,
    updateDailyWeight,
    removeEntry,
    updateEntryWeight,
    runWeeklyCheckin,
    updateSettings,
    updateMealCalorieTarget,
    isLoading
  } = useLogbookStore();

  const [weightInput, setWeightInput] = useState<string>('');
  const [checkinResult, setCheckinResult] = useState<{ success: boolean; message: string } | null>(null);

  // États du calendrier mensuel
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [monthLogDays, setMonthLogDays] = useState<LogbookDay[]>([]);

  // État de la modale de détails d'une entrée
  const [viewingEntry, setViewingEntry] = useState<LogbookEntry | null>(null);
  const [editWeight, setEditWeight] = useState<string>('');

  // Cibles de repas et édition rapide (modale)
  const [selectedMealForLimit, setSelectedMealForLimit] = useState<string | null>(null);
  const [mealLimitValue, setMealLimitValue] = useState<string>('');
  const [addingCustomMeal, setAddingCustomMeal] = useState<boolean>(false);
  const [newMealName, setNewMealName] = useState<string>('');

  // Édition TDEE en direct
  const [isEditingTDEE, setIsEditingTDEE] = useState<boolean>(false);
  const [tdeeInput, setTdeeInput] = useState<string>('');

  // Calculateur de TDEE manuel
  const [isTDEECalculatorOpen, setIsTDEECalculatorOpen] = useState<boolean>(false);
  const [tdeeCalcMethod, setTdeeCalcMethod] = useState<'tracking' | 'formula'>('tracking');

  // Valeurs pour méthode "Suivi"
  const [calcAvgCalories, setCalcAvgCalories] = useState<string>('');
  const [calcStartWeight, setCalcStartWeight] = useState<string>('');
  const [calcEndWeight, setCalcEndWeight] = useState<string>('');
  const [calcDuration, setCalcDuration] = useState<string>('14');

  // Valeurs pour méthode "Formule"
  const [calcGender, setCalcGender] = useState<'male' | 'female'>('male');
  const [calcWeight, setCalcWeight] = useState<string>('');
  const [calcHeight, setCalcHeight] = useState<string>('');
  const [calcAge, setCalcAge] = useState<string>('');
  const [calcActivity, setCalcActivity] = useState<string>('1.375');

  // Charger les cibles de poids de l'input local
  useEffect(() => {
    if (currentDay && currentDay.dailyWeight !== null) {
      setWeightInput(currentDay.dailyWeight.toString());
    } else {
      setWeightInput('');
    }
    setCheckinResult(null);
  }, [currentDay, selectedDate]);

  // Récupérer les données du mois pour le calendrier
  useEffect(() => {
    const fetchMonthData = async () => {
      const yearStr = calendarYear.toString();
      const monthStr = String(calendarMonth + 1).padStart(2, '0');
      const start = `${yearStr}-${monthStr}-01`;
      const end = `${yearStr}-${monthStr}-32`; // Couvre jusqu'au 31

      try {
        const days = await db.logbook
          .where('date')
          .between(start, end, true, true)
          .toArray();
        setMonthLogDays(days);
      } catch (err) {
        console.error("Erreur lors de la récupération des données du calendrier :", err);
      }
    };
    fetchMonthData();
  }, [calendarYear, calendarMonth, currentDay, selectedDate]);

  // Ajuster le jour
  const adjustDate = (days: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + days);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Naviguer dans les mois du calendrier
  const adjustCalendarMonth = (months: number) => {
    let newMonth = calendarMonth + months;
    let newYear = calendarYear;

    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }

    setCalendarMonth(newMonth);
    setCalendarYear(newYear);
  };

  // Mettre à jour le poids quotidien
  const handleWeightChange = (val: string) => {
    setWeightInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      updateDailyWeight(selectedDate, parsed);
    } else if (val === '') {
      updateDailyWeight(selectedDate, null);
    }
  };

  // Soumettre l'édition de portion
  const handleEditPortionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingEntry) return;

    const parsedWeight = parseFloat(editWeight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) return;

    await updateEntryWeight(selectedDate, viewingEntry.id, parsedWeight);
    setViewingEntry(null);
    setEditWeight('');
  };

  // Déclencher le check-in
  const handleCheckin = async () => {
    const res = await runWeeklyCheckin();
    setCheckinResult({ success: res.success, message: res.message });
  };

  // Calculer et appliquer le TDEE saisi manuellement
  const handleCalculateTDEE = async () => {
    let computedTDEE = 0;
    
    if (tdeeCalcMethod === 'tracking') {
      const avgCals = parseFloat(calcAvgCalories);
      const startW = parseFloat(calcStartWeight);
      const endW = parseFloat(calcEndWeight);
      const days = parseInt(calcDuration);
      
      if (!isNaN(avgCals) && !isNaN(startW) && !isNaN(endW) && !isNaN(days) && days > 0) {
        const weightChange = endW - startW;
        computedTDEE = avgCals - (weightChange * 7700) / days;
      }
    } else {
      const w = parseFloat(calcWeight);
      const h = parseFloat(calcHeight);
      const age = parseFloat(calcAge);
      const mult = parseFloat(calcActivity);
      
      if (!isNaN(w) && !isNaN(h) && !isNaN(age) && !isNaN(mult)) {
        let bmr = 10 * w + 6.25 * h - 5 * age;
        if (calcGender === 'male') {
          bmr += 5;
        } else {
          bmr -= 161;
        }
        computedTDEE = bmr * mult;
      }
    }
    
    if (computedTDEE > 0) {
      const rounded = Math.round(computedTDEE);
      await updateSettings({ defaultTDEE: rounded });
      setIsTDEECalculatorOpen(false);
      // Reset inputs
      setCalcAvgCalories('');
      setCalcStartWeight('');
      setCalcEndWeight('');
      setCalcWeight('');
      setCalcHeight('');
      setCalcAge('');
    }
  };

  // Totaux nutritionnels quotidiens
  const totals = currentDay 
    ? calculateDayTotals(currentDay, customFoods, recipes)
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  // Cibles quotidiennes
  const targetCals = getTargetCalories(settings);
  const targetMacros = getTargetMacros(settings);

  // Obtenir les détails pour l'affichage de l'historique
  const getEntryDetails = (entry: LogbookEntry) => {
    if (entry.type === 'food') {
      const food = customFoods.find(f => f.id === entry.foodId);
      if (!food) return null;
      const factor = entry.weight / 100;
      return {
        name: food.name,
        calories: food.calories * factor,
        protein: food.protein * factor,
        carbs: food.carbs * factor,
        fat: food.fat * factor,
        link: food.link,
      };
    } else if (entry.type === 'recipe') {
      const recipe = recipes.find(r => r.id === entry.recipeId);
      if (!recipe) return null;
      const recipeMacros = calculateRecipeMacrosPer100g(recipe, customFoods);
      const factor = entry.weight / 100;
      return {
        name: recipe.name,
        calories: recipeMacros.calories * factor,
        protein: recipeMacros.protein * factor,
        carbs: recipeMacros.carbs * factor,
        fat: recipeMacros.fat * factor,
        link: undefined,
      };
    } else if (entry.type === 'quick-add' && entry.quickAdd) {
      return {
        name: "Ajout rapide",
        calories: entry.quickAdd.calories,
        protein: entry.quickAdd.protein,
        carbs: entry.quickAdd.carbs,
        fat: entry.quickAdd.fat,
        link: undefined,
      };
    }
    return null;
  };

  // Calcul du calendrier
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7; // Lun-Dim -> 0-6

  // Générer le tableau des jours du mois
  const calendarCells = [];
  // Remplir les jours vides du début du mois
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  // Remplir les jours réels
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  // Calculer la couleur de conformité d'une date pour le calendrier
  const getDateComplianceClass = (dayNum: number): string => {
    const formattedDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayData = monthLogDays.find(day => day.date === formattedDate);
    
    if (!dayData || dayData.entries.length === 0) {
      return 'bg-zinc-900/40 text-slate-600 border border-transparent';
    }

    const dayTotals = calculateDayTotals(dayData, customFoods, recipes);
    const diff = Math.abs(dayTotals.calories - targetCals);

    if (diff <= 100) {
      return 'bg-emerald-500 text-black font-extrabold border-emerald-400';
    } else if (diff <= 250) {
      return 'bg-amber-500 text-black font-extrabold border-amber-400';
    } else {
      return 'bg-rose-500 text-white font-extrabold border-rose-400';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-ios-bg overflow-hidden">
      
      {/* Date Selector Header */}
      <div className="flex justify-between items-center pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 px-4 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 shrink-0">
        <button 
          onClick={() => adjustDate(-1)}
          className="p-2 text-slate-400 hover:text-slate-100 bg-zinc-900 active:bg-zinc-800 rounded-xl transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <button 
          onClick={() => setCalendarOpen(!calendarOpen)}
          className="flex items-center space-x-1.5 px-3 py-1 hover:bg-zinc-900 rounded-xl transition"
        >
          <h2 className="text-base font-display font-bold text-slate-100 select-none">
            {formatJournalDate(selectedDate)}
          </h2>
          {calendarOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        
        <button 
          onClick={() => adjustDate(1)}
          className="p-2 text-slate-400 hover:text-slate-100 bg-zinc-900 active:bg-zinc-800 rounded-xl transition"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 ios-scroll pb-8 no-scrollbar">

      {/* Collapsible Compliance Calendar Section */}
      {calendarOpen && (
        <div className="bg-zinc-950 border-b border-zinc-900 p-4 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex justify-between items-center px-1">
            <button 
              onClick={() => adjustCalendarMonth(-1)}
              className="p-1 bg-zinc-900 text-slate-400 hover:text-slate-200 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-display font-bold text-slate-200">
              {monthNames[calendarMonth]} {calendarYear}
            </span>
            <button 
              onClick={() => adjustCalendarMonth(1)}
              className="p-1 bg-zinc-900 text-slate-400 hover:text-slate-200 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Grid de Calendrier */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {/* Jours de la semaine */}
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((dayName) => (
              <span key={dayName} className="text-[10px] font-bold text-slate-500 uppercase">{dayName}</span>
            ))}

            {/* Cellules de jours */}
            {calendarCells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }

              const formattedDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = formattedDate === selectedDate;

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDate(formattedDate)}
                  className={`aspect-square w-full rounded-lg flex items-center justify-center text-xs font-semibold transition active:scale-90 ${getDateComplianceClass(day)} ${
                    isSelected ? 'ring-2 ring-white scale-110 z-10' : ''
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Légende */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 px-1 border-t border-zinc-900">
            <span className="flex items-center space-x-1">
              <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full inline-block" />
              <span>Atteint (±100 kcal)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="h-2.5 w-2.5 bg-amber-500 rounded-full inline-block" />
              <span>Proche (±250 kcal)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="h-2.5 w-2.5 bg-rose-500 rounded-full inline-block" />
              <span>Écart ({'>'}250 kcal)</span>
            </span>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-6 max-w-md mx-auto w-full">

        {/* Résumé de la Journée - Cercle de Progression */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-6 shadow-lg backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="flex items-center justify-between w-full max-w-sm">
            {/* Consommées */}
            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Consommées</span>
              <span className="text-xl font-display font-extrabold text-slate-100 tabular-nums">
                {Math.round(totals.calories)} <span className="text-xs font-normal text-slate-500">kcal</span>
              </span>
            </div>

            {/* Circular Indicator */}
            <div className="relative flex items-center justify-center mx-4 shrink-0">
              <svg className="w-28 h-28 transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="44"
                  className="stroke-zinc-850"
                  strokeWidth="7"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="44"
                  className="stroke-accent-teal"
                  strokeWidth="7"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={2 * Math.PI * 44 - (Math.min(totals.calories, targetCals) / (targetCals || 1)) * (2 * Math.PI * 44)}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Objectif</span>
                <span className="text-base font-display font-extrabold text-slate-100 tabular-nums">
                  {targetCals}
                </span>
                <span className="text-[9px] text-slate-400 font-semibold">kcal</span>
              </div>
            </div>

            {/* Restantes */}
            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Restantes</span>
              <span className={`text-xl font-display font-extrabold tabular-nums ${
                targetCals - totals.calories >= 0 ? 'text-accent-teal' : 'text-rose-500'
              }`}>
                {Math.round(Math.abs(targetCals - totals.calories))} <span className="text-xs font-normal text-slate-500">kcal</span>
                {targetCals - totals.calories < 0 && <span className="block text-[8px] font-bold uppercase text-rose-500">de trop</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Macros Card */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 space-y-4 shadow-lg backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase">Tableau des Macros</h3>
            {settings?.calorieGoalMode === 'manual' && (
              <span className="text-[9px] bg-accent-violet/15 text-accent-violet px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">
                Cible Manuelle
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <ProgressBar 
              label="Protéines" 
              current={totals.protein} 
              target={targetMacros.protein} 
              colorClass="bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.3)]" 
              unit="g" 
            />
            <ProgressBar 
              label="Glucides" 
              current={totals.carbs} 
              target={targetMacros.carbs} 
              colorClass="bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]" 
              unit="g" 
            />
            <ProgressBar 
              label="Lipides" 
              current={totals.fat} 
              target={targetMacros.fat} 
              colorClass="bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" 
              unit="g" 
            />
          </div>
        </div>

        {/* Detail macros par repas */}
        {(() => {
          const predefinedMeals = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'En-cas'];
          const customMealsFromSettings = Object.keys(settings?.mealTargets || {});
          const customMealsFromEntries = currentDay 
            ? Array.from(new Set(currentDay.entries.map(e => e.meal).filter((m): m is string => !!m)))
            : [];
          
          const allActiveMeals = Array.from(new Set([
            ...predefinedMeals,
            ...customMealsFromSettings,
            ...customMealsFromEntries
          ]));

          const getMealTotals = (mealName: string) => {
            let calories = 0;
            let protein = 0;
            let carbs = 0;
            let fat = 0;
            
            if (currentDay) {
              currentDay.entries.forEach(entry => {
                if (entry.meal === mealName) {
                  const details = getEntryDetails(entry);
                  if (details) {
                    calories += details.calories;
                    protein += details.protein;
                    carbs += details.carbs;
                    fat += details.fat;
                  }
                }
              });
            }
            
            return { calories, protein, carbs, fat };
          };

          return (
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 space-y-4 shadow-lg backdrop-blur-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase">Détail par Repas</h3>
                <button
                  onClick={() => setAddingCustomMeal(true)}
                  className="text-xs font-bold text-accent-teal hover:underline flex items-center space-x-1"
                >
                  <span>+ Ajouter repas</span>
                </button>
              </div>

              {addingCustomMeal && (
                <div className="flex items-center space-x-2 bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800">
                  <input
                    type="text"
                    placeholder="Nom du repas (ex: Repas 5)"
                    value={newMealName}
                    onChange={(e) => setNewMealName(e.target.value)}
                    className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={async () => {
                      if (newMealName.trim()) {
                        await updateMealCalorieTarget(newMealName.trim(), -1);
                        setNewMealName('');
                        setAddingCustomMeal(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-accent-teal text-black rounded-xl text-xs font-bold"
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={() => {
                      setNewMealName('');
                      setAddingCustomMeal(false);
                    }}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-2 pr-2">Repas</th>
                      <th className="py-2 text-right">Kcal / Cible</th>
                      <th className="py-2 text-right">P</th>
                      <th className="py-2 text-right">G</th>
                      <th className="py-2 text-right">L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/50">
                    {allActiveMeals.map((mealName) => {
                      const mealTotals = getMealTotals(mealName);
                      const target = settings?.mealTargets?.[mealName];
                      const hasTarget = target !== undefined && target > 0;

                      return (
                        <tr key={mealName} className="text-xs text-slate-300 group hover:bg-zinc-900/10">
                          <td className="py-2.5 pr-2 font-medium">
                            <div className="flex flex-col">
                              <span>{mealName}</span>
                              {hasTarget && (
                                <div className="w-16 h-1 bg-zinc-850 rounded-full overflow-hidden mt-1">
                                  <div 
                                    className="h-full bg-accent-teal" 
                                    style={{ width: `${Math.min(100, (mealTotals.calories / target) * 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-1 text-right tabular-nums">
                            <div className="flex flex-col items-end justify-center">
                              <div 
                                onClick={() => {
                                  setMealLimitValue(hasTarget ? target.toString() : '');
                                  setSelectedMealForLimit(mealName);
                                }}
                                className="cursor-pointer hover:bg-zinc-800/40 px-2 py-1.5 rounded-xl transition text-slate-200 flex items-center space-x-1.5 justify-end font-semibold group select-none"
                              >
                                <span>{Math.round(mealTotals.calories)}</span>
                                <span className="text-[10px] text-slate-500 font-normal">
                                  / {hasTarget ? `${target}` : '—'}
                                </span>
                                <span className="text-[9px] text-accent-teal opacity-0 group-hover:opacity-100 transition pl-0.5">✎</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-violet-400 font-medium">{Math.round(mealTotals.protein)}g</td>
                          <td className="py-2.5 text-right tabular-nums text-cyan-400 font-medium">{Math.round(mealTotals.carbs)}g</td>
                          <td className="py-2.5 text-right tabular-nums text-amber-500 font-medium">{Math.round(mealTotals.fat)}g</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Weight Tracker Card + Goal progress */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 shadow-lg flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-accent-violet/10 rounded-xl text-accent-violet">
                <Scale className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-display font-semibold text-slate-200">Suivi du Poids</h4>
                <p className="text-[10px] text-slate-500 font-medium">Lissage métabolique (EMA)</p>
              </div>
            </div>

            {currentDay?.smoothedWeight && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-accent-violet uppercase tracking-wide">Poids Lissé</span>
                <p className="text-sm font-display font-extrabold text-slate-200 tabular-nums">
                  {currentDay.smoothedWeight.toFixed(2)} <span className="text-xs text-slate-500 font-normal">kg</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="number"
              step="0.01"
              placeholder="Ex: 78.5"
              value={weightInput}
              onChange={(e) => handleWeightChange(e.target.value)}
              className="flex-1 bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-base text-slate-200 focus:outline-none focus:border-accent-violet transition font-semibold tabular-nums text-center"
            />
            <span className="text-sm font-bold text-slate-500 pr-2">kg</span>
          </div>

          {/* Target Weight Progress (Dynamic) */}
          {settings?.targetWeight && (
            <div className="border-t border-zinc-800/80 pt-3.5 mt-1 space-y-2">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-slate-400 font-semibold flex items-center space-x-1.5">
                  <TrendingDown className="h-3.5 w-3.5 text-accent-violet" />
                  <span>Objectif de Poids</span>
                </span>
                <span className="font-bold text-slate-300">
                  {settings.targetWeight} kg {settings.targetWeightDate && `d'ici le ${new Date(settings.targetWeightDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                </span>
              </div>
              
              {currentDay?.smoothedWeight && (
                <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                  <span>Écart actuel :</span>
                  <span className="text-slate-300 tabular-nums">
                    {Math.abs(currentDay.smoothedWeight - settings.targetWeight).toFixed(2)} kg
                    {currentDay.smoothedWeight > settings.targetWeight ? ' à perdre' : ' à prendre'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metabolic Checkin Notice */}
        {settings && (
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Sparkles className="h-20 w-20 text-accent-teal" />
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-accent-teal/10 rounded-2xl text-accent-teal mt-0.5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-display font-semibold text-slate-200">Métabolisme & TDEE</h3>
                {isEditingTDEE ? (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const parsed = parseInt(tdeeInput);
                      if (!isNaN(parsed) && parsed > 0) {
                        await updateSettings({ defaultTDEE: parsed });
                      }
                      setIsEditingTDEE(false);
                    }}
                    className="flex items-center space-x-2 mt-1.5"
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      value={tdeeInput}
                      onChange={(e) => setTdeeInput(e.target.value)}
                      className="w-24 bg-black border border-zinc-800 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-accent-teal"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 bg-accent-teal text-black rounded-lg text-[10px] font-bold active:scale-95 transition"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingTDEE(false)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <p 
                    className="text-xs text-slate-400 leading-relaxed cursor-pointer hover:text-slate-200 group"
                    onClick={() => {
                      setTdeeInput(settings.defaultTDEE.toString());
                      setIsEditingTDEE(true);
                    }}
                    title="Cliquez pour modifier le TDEE directement"
                  >
                    TDEE actuel : <span className="font-semibold text-slate-200 border-b border-dashed border-slate-500/50 hover:border-slate-200">{settings.defaultTDEE} kcal ✎</span>.
                    Déficit cible : <span className="font-semibold text-slate-200">-{settings.targetDeficit} kcal</span>.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <button
                    onClick={handleCheckin}
                    disabled={isLoading}
                    className="text-xs font-semibold text-accent-teal bg-accent-teal/10 hover:bg-accent-teal/20 px-3 py-1.5 rounded-xl transition inline-flex items-center active:scale-95"
                  >
                    Calculer le TDEE réel (Check-in)
                  </button>
                  <button
                    onClick={() => {
                      setCalcWeight(currentDay?.dailyWeight ? currentDay.dailyWeight.toString() : '');
                      setIsTDEECalculatorOpen(true);
                    }}
                    className="text-xs font-semibold text-slate-400 bg-zinc-900 hover:bg-zinc-850 px-3 py-1.5 rounded-xl transition inline-flex items-center active:scale-95"
                  >
                    Calculateur Manuel
                  </button>
                </div>
              </div>
            </div>

            {checkinResult && (
              <div className={`mt-3 p-3 rounded-2xl text-xs flex items-start space-x-2 ${
                checkinResult.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
              }`}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{checkinResult.message}</p>
              </div>
            )}
          </div>
        )}

        {/* Food Log Entries Card */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase">Aliments Consommés</h4>
            <span className="text-xs font-semibold text-slate-500">
              {currentDay?.entries.length || 0} aliment(s)
            </span>
          </div>

          {!currentDay || currentDay.entries.length === 0 ? (
            <div className="bg-zinc-900/30 border border-dashed border-zinc-800/80 rounded-3xl p-8 text-center space-y-2.5">
              <div className="inline-flex p-3 bg-zinc-950 rounded-2xl text-slate-600">
                <Utensils className="h-6 w-6" />
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[240px] mx-auto">
                Aucun aliment consommé aujourd'hui. Cliquez sur l'onglet <strong className="text-slate-400 font-semibold">Ajouter</strong> pour compléter votre journal.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                // Group entries by meal
                const groupedEntries: Record<string, LogbookEntry[]> = {};
                currentDay.entries.forEach(entry => {
                  const mealName = entry.meal || 'Autre';
                  if (!groupedEntries[mealName]) {
                    groupedEntries[mealName] = [];
                  }
                  groupedEntries[mealName].push(entry);
                });

                const mealOrder = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'En-cas'];
                const sortedMealGroups = Object.keys(groupedEntries).sort((a, b) => {
                  const indexA = mealOrder.indexOf(a);
                  const indexB = mealOrder.indexOf(b);
                  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                  if (indexA !== -1) return -1;
                  if (indexB !== -1) return 1;
                  return a.localeCompare(b);
                });

                return sortedMealGroups.map(mealName => {
                  const entries = groupedEntries[mealName];
                  const mealCalories = entries.reduce((sum, entry) => {
                    const details = getEntryDetails(entry);
                    return sum + (details?.calories || 0);
                  }, 0);

                  return (
                    <div key={mealName} className="space-y-2">
                      {/* Meal Sub-header */}
                      <div className="flex justify-between items-center px-1 pt-1">
                        <span className="text-[11px] font-display font-extrabold text-slate-400 uppercase tracking-wider">
                          {mealName}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                          {Math.round(mealCalories)} kcal
                        </span>
                      </div>

                      {/* Entries under this meal */}
                      <div className="space-y-2">
                        {entries.map((entry) => {
                          const details = getEntryDetails(entry);
                          if (!details) return null;

                          return (
                            <div 
                              key={entry.id}
                              onClick={() => {
                                setViewingEntry(entry);
                                setEditWeight(entry.weight.toString());
                              }}
                              className="bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/60 rounded-2xl p-4 flex justify-between items-center shadow-sm relative group active:bg-zinc-900 transition duration-150 cursor-pointer"
                            >
                              <div className="space-y-1 flex-1 pr-4 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-semibold text-slate-200 truncate">{details.name}</p>
                                  {details.link && (
                                    <a
                                      href={details.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()} // Évite d'ouvrir la modale de détails
                                      className="p-1 text-accent-teal hover:text-accent-teal/80 bg-zinc-950 hover:bg-zinc-900 rounded-lg transition"
                                      title="Ouvrir le lien source"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                                <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium">
                                  {entry.type !== 'quick-add' && (
                                    <span className="bg-zinc-950 px-2 py-0.5 rounded-md text-[10px] text-slate-400 tabular-nums">
                                      {entry.weight}g
                                    </span>
                                  )}
                                  <span className="tabular-nums font-semibold text-slate-400">
                                    {Math.round(details.calories)} kcal
                                  </span>
                                  <span className="hidden sm:inline tabular-nums">
                                    P: {Math.round(details.protein)}g • G: {Math.round(details.carbs)}g • L: {Math.round(details.fat)}g
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Évite d'ouvrir la modale de détails
                                  removeEntry(selectedDate, entry.id);
                                }}
                                className="p-2.5 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition active:scale-90"
                                aria-label="Supprimer"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

      </div>

      </div>

      {/* ==========================================
          MODALE DETAILED DRAWER (SWIPE UP LOOK)
         ========================================== */}
      {viewingEntry && (() => {
        const details = getEntryDetails(viewingEntry);
        if (!details) return null;

        // Trouver la recette ou l'aliment correspondant si besoin d'infos supplémentaires
        let recipeNotes = '';
        let recipeIngredientsList: Array<{ name: string; weight: number }> = [];

        if (viewingEntry.type === 'recipe') {
          const recipe = recipes.find(r => r.id === viewingEntry.recipeId);
          if (recipe) {
            recipeNotes = recipe.notes || '';
            recipeIngredientsList = recipe.ingredients.map(ing => {
              const food = customFoods.find(f => f.id === ing.foodId);
              return {
                name: food ? food.name : 'Aliment inconnu',
                weight: ing.rawWeight
              };
            });
          }
        }

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
            <div className="bg-zinc-950 border-t border-zinc-800 w-full max-w-md rounded-t-3xl p-6 space-y-6 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200">
              
              {/* Header de la modale */}
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {viewingEntry.type === 'food' ? 'Aliment Consommé' : viewingEntry.type === 'recipe' ? 'Recette Consommée' : 'Ajout Direct'}
                  </span>
                  <h4 className="text-lg font-display font-extrabold text-slate-100">{details.name}</h4>
                </div>
                <button 
                  onClick={() => { setViewingEntry(null); setEditWeight(''); }}
                  className="p-1.5 bg-zinc-900 text-slate-400 hover:text-slate-200 rounded-full"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Contenu de la fiche */}
              <div className="space-y-4">
                
                {/* Résumé Macros Portion */}
                <div className="bg-zinc-900 p-4 border border-zinc-800 rounded-2xl grid grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Calories</span>
                    <span className="text-sm font-display font-extrabold text-slate-100 tabular-nums">{Math.round(details.calories)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Prot</span>
                    <span className="text-sm font-display font-extrabold text-slate-100 tabular-nums">{Math.round(details.protein)}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Gluc</span>
                    <span className="text-sm font-display font-extrabold text-slate-100 tabular-nums">{Math.round(details.carbs)}g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Lip</span>
                    <span className="text-sm font-display font-extrabold text-slate-100 tabular-nums">{Math.round(details.fat)}g</span>
                  </div>
                </div>

                {details.link && (
                  <a
                    href={details.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 bg-accent-teal/10 hover:bg-accent-teal/20 border border-accent-teal/20 text-accent-teal font-semibold rounded-2xl transition flex items-center justify-center space-x-2 active:scale-95 text-xs"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Ouvrir le lien source</span>
                  </a>
                )}

                {/* Si c'est une Recette : Afficher les notes & ingrédients */}
                {viewingEntry.type === 'recipe' && (
                  <div className="space-y-3">
                    
                    {/* Notes de préparation */}
                    {recipeNotes && (
                      <div className="bg-zinc-900/60 p-4 border border-zinc-800 rounded-2xl space-y-1">
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Instructions de préparation</h5>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{recipeNotes}</p>
                      </div>
                    )}

                    {/* Liste Ingrédients Crus */}
                    {recipeIngredientsList.length > 0 && (
                      <div className="space-y-1.5">
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide px-1">Composition (Poids Crus)</h5>
                        <div className="bg-zinc-900/40 rounded-2xl p-3.5 border border-zinc-800/80 space-y-2 max-h-36 overflow-y-auto">
                          {recipeIngredientsList.map((ing, i) => (
                            <div key={i} className="flex justify-between items-center text-xs text-slate-400">
                              <span className="truncate pr-2 font-medium">• {ing.name}</span>
                              <span className="font-semibold tabular-nums shrink-0">{ing.weight}g</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Saisie de Modification de la portion */}
                {viewingEntry.type !== 'quick-add' && (
                  <form onSubmit={handleEditPortionSubmit} className="border-t border-zinc-900 pt-4 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Modifier la portion consommée (g)</label>
                      <div className="relative">
                        <input
                          type="number"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          required
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-center text-xl font-display font-extrabold text-slate-200 focus:outline-none focus:border-accent-teal transition"
                        />
                        <span className="absolute right-4 top-3 text-xs font-bold text-slate-500">g</span>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      {/* Supprimer de l'historique */}
                      <button
                        type="button"
                        onClick={() => {
                          removeEntry(selectedDate, viewingEntry.id);
                          setViewingEntry(null);
                        }}
                        className="flex-1 h-12 bg-rose-950/35 border border-rose-900/50 hover:bg-rose-900/20 text-rose-400 font-semibold rounded-2xl active:scale-95 transition flex items-center justify-center space-x-2"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                        <span>Supprimer</span>
                      </button>

                      {/* Mettre à jour */}
                      <button
                        type="submit"
                        className="flex-1 h-12 bg-accent-teal text-white font-display font-bold rounded-2xl shadow-lg active:scale-98 transition duration-150"
                      >
                        Mettre à jour
                      </button>
                    </div>
                  </form>
                )}

                {/* Si Quick Add, pas de portion modifiable, juste suppression */}
                {viewingEntry.type === 'quick-add' && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        removeEntry(selectedDate, viewingEntry.id);
                        setViewingEntry(null);
                      }}
                      className="w-full h-12 bg-rose-950/35 border border-rose-900/50 hover:bg-rose-900/20 text-rose-400 font-semibold rounded-2xl active:scale-95 transition flex items-center justify-center space-x-2"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                      <span>Supprimer du Journal</span>
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}

      {selectedMealForLimit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-zinc-950 border-t border-zinc-800 w-full max-w-md rounded-t-3xl p-6 space-y-6 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Objectif Calorique
                </span>
                <h4 className="text-lg font-display font-extrabold text-slate-100">{selectedMealForLimit}</h4>
              </div>
              <button 
                onClick={() => setSelectedMealForLimit(null)}
                className="p-1.5 bg-zinc-900 text-slate-400 hover:text-slate-200 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Objectif (kcal)</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Ex: 500"
                    value={mealLimitValue}
                    onChange={(e) => setMealLimitValue(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-center text-xl font-display font-extrabold text-slate-200 focus:outline-none focus:border-accent-teal transition"
                    autoFocus
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-slate-500">kcal</span>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                {/* Clear / Supprimer la cible */}
                <button
                  type="button"
                  onClick={async () => {
                    await updateMealCalorieTarget(selectedMealForLimit, null);
                    setSelectedMealForLimit(null);
                  }}
                  className="flex-1 h-12 bg-rose-950/20 border border-rose-900/50 hover:bg-rose-900/30 text-rose-400 font-semibold rounded-2xl active:scale-95 transition flex items-center justify-center space-x-2 text-sm"
                >
                  <span>Sans limite</span>
                </button>

                {/* Save / Enregistrer */}
                <button
                  type="button"
                  onClick={async () => {
                    const parsed = parseFloat(mealLimitValue);
                    if (!isNaN(parsed) && parsed > 0) {
                      await updateMealCalorieTarget(selectedMealForLimit, parsed);
                    } else {
                      await updateMealCalorieTarget(selectedMealForLimit, null);
                    }
                    setSelectedMealForLimit(null);
                  }}
                  className="flex-1 h-12 bg-accent-teal text-black font-display font-bold rounded-2xl shadow-lg active:scale-98 transition duration-150 text-sm"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTDEECalculatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-zinc-950 border-t border-zinc-800 w-full max-w-md rounded-t-3xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Calculateur Manuel
                </span>
                <h4 className="text-lg font-display font-extrabold text-slate-100">Calculer le TDEE</h4>
              </div>
              <button 
                onClick={() => setIsTDEECalculatorOpen(false)}
                className="p-1.5 bg-zinc-900 text-slate-400 hover:text-slate-200 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Segmented Controls */}
            <div className="bg-zinc-900 p-1 rounded-2xl flex justify-between items-center text-xs font-semibold">
              <button
                onClick={() => setTdeeCalcMethod('tracking')}
                className={`flex-1 py-2 text-center rounded-xl transition duration-200 ${
                  tdeeCalcMethod === 'tracking' 
                    ? 'bg-zinc-950 text-slate-100 shadow-md font-bold' 
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                Suivi (Calories/Poids)
              </button>
              <button
                onClick={() => setTdeeCalcMethod('formula')}
                className={`flex-1 py-2 text-center rounded-xl transition duration-200 ${
                  tdeeCalcMethod === 'formula' 
                    ? 'bg-zinc-950 text-slate-100 shadow-md font-bold' 
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                Formule (Taille/Âge)
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {tdeeCalcMethod === 'tracking' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Calories moyennes ingérées / jour</label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="Ex: 2200"
                        value={calcAvgCalories}
                        onChange={(e) => setCalcAvgCalories(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-200 focus:outline-none focus:border-accent-teal transition"
                      />
                      <span className="absolute right-4 top-2.5 text-xs font-semibold text-slate-500">kcal/jour</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Poids de départ (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        placeholder="Ex: 80.0"
                        value={calcStartWeight}
                        onChange={(e) => setCalcStartWeight(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-200 focus:outline-none focus:border-accent-teal transition"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Poids d'arrivée (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        placeholder="Ex: 79.5"
                        value={calcEndWeight}
                        onChange={(e) => setCalcEndWeight(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-200 focus:outline-none focus:border-accent-teal transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Durée de la période (jours)</label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex: 14"
                        value={calcDuration}
                        onChange={(e) => setCalcDuration(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-200 focus:outline-none focus:border-accent-teal transition"
                      />
                      <span className="absolute right-4 top-2.5 text-xs font-semibold text-slate-500">jours</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Genre</label>
                    <div className="bg-zinc-900 p-1 rounded-2xl flex justify-between items-center text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setCalcGender('male')}
                        className={`flex-1 py-2 text-center rounded-xl transition duration-200 ${
                          calcGender === 'male' 
                            ? 'bg-zinc-950 text-slate-100 shadow-md' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Homme
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalcGender('female')}
                        className={`flex-1 py-2 text-center rounded-xl transition duration-200 ${
                          calcGender === 'female' 
                            ? 'bg-zinc-950 text-slate-100 shadow-md' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Femme
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Poids (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        placeholder="Ex: 75"
                        value={calcWeight}
                        onChange={(e) => setCalcWeight(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-accent-teal transition font-semibold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Taille (cm)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex: 178"
                        value={calcHeight}
                        onChange={(e) => setCalcHeight(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-accent-teal transition font-semibold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Âge (ans)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="Ex: 30"
                        value={calcAge}
                        onChange={(e) => setCalcAge(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-accent-teal transition font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">Niveau d'activité</label>
                    <select
                      value={calcActivity}
                      onChange={(e) => setCalcActivity(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-250 focus:outline-none focus:border-accent-teal transition"
                    >
                      <option value="1.2">Sédentaire (Peu ou pas d'exercice)</option>
                      <option value="1.375">Légèrement actif (Exercice léger 1-3 fois/semaine)</option>
                      <option value="1.55">Modérément actif (Exercice modéré 3-5 fois/semaine)</option>
                      <option value="1.725">Très actif (Exercice intense 6-7 fois/semaine)</option>
                      <option value="1.9">Extrêmement actif (Entraînement double ou travail physique)</option>
                    </select>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={handleCalculateTDEE}
                className="w-full h-12 mt-4 bg-accent-teal text-black font-display font-extrabold rounded-2xl shadow-lg active:scale-95 transition flex items-center justify-center space-x-2 text-sm"
              >
                <span>Calculer & Appliquer comme TDEE</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
