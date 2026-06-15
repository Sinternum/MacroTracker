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
  X
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
    isLoading
  } = useLogbookStore();

  const [weightInput, setWeightInput] = useState<string>('');
  const [checkinResult, setCheckinResult] = useState<{ success: boolean; message: string } | null>(null);

  // États du calendrier mensuel
  const [calendarOpen, setCalendarOpen] = useState<boolean>(true);
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [monthLogDays, setMonthLogDays] = useState<LogbookDay[]>([]);

  // État de la modale de détails d'une entrée
  const [viewingEntry, setViewingEntry] = useState<LogbookEntry | null>(null);
  const [editWeight, setEditWeight] = useState<string>('');

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
      };
    } else if (entry.type === 'quick-add' && entry.quickAdd) {
      return {
        name: "Ajout rapide",
        calories: entry.quickAdd.calories,
        protein: entry.quickAdd.protein,
        carbs: entry.quickAdd.carbs,
        fat: entry.quickAdd.fat,
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
    <div className="flex-1 flex flex-col min-h-0 bg-black overflow-hidden">
      
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
              <div className="space-y-1">
                <h3 className="text-sm font-display font-semibold text-slate-200">Métabolisme & TDEE</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  TDEE actuel : <span className="font-semibold text-slate-200">{settings.defaultTDEE} kcal</span>.
                  Déficit cible : <span className="font-semibold text-slate-200">-{settings.targetDeficit} kcal</span>.
                </p>
                <button
                  onClick={handleCheckin}
                  disabled={isLoading}
                  className="mt-2 text-xs font-semibold text-accent-teal bg-accent-teal/10 hover:bg-accent-teal/20 px-3 py-1.5 rounded-xl transition inline-flex items-center active:scale-95"
                >
                  Calculer le TDEE réel (Check-in)
                </button>
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

        {/* Dashboard Macros Card */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 space-y-5 shadow-lg backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase">Tableau des Macros</h3>
            {settings?.calorieGoalMode === 'manual' && (
              <span className="text-[9px] bg-accent-violet/15 text-accent-violet px-2 py-0.5 rounded-md font-bold uppercase tracking-wide">
                Cible Manuelle
              </span>
            )}
          </div>
          
          <ProgressBar 
            label="Calories" 
            current={totals.calories} 
            target={targetCals} 
            colorClass="bg-gradient-to-r from-accent-teal to-blue-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]" 
            unit=" kcal" 
          />

          <div className="grid grid-cols-1 gap-4 pt-1">
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

        {/* Food Log Entries Card */}
        <div className="space-y-3">
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
            <div className="space-y-2">
              {currentDay.entries.map((entry) => {
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
                      <p className="text-sm font-semibold text-slate-200 truncate">{details.name}</p>
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

    </div>
  );
};
