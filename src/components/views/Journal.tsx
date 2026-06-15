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
  AlertCircle
} from 'lucide-react';
import { type LogbookEntry } from '../../db';

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
    // Capitaliser la première lettre du jour (ex: Mardi 14 juin)
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
    runWeeklyCheckin,
    isLoading
  } = useLogbookStore();

  const [weightInput, setWeightInput] = useState<string>('');
  const [checkinResult, setCheckinResult] = useState<{ success: boolean; message: string } | null>(null);

  // Mettre à jour l'input de poids lorsque le jour sélectionné ou son poids change
  useEffect(() => {
    if (currentDay && currentDay.dailyWeight !== null) {
      setWeightInput(currentDay.dailyWeight.toString());
    } else {
      setWeightInput('');
    }
    setCheckinResult(null);
  }, [currentDay, selectedDate]);

  // Navigation des jours
  const adjustDate = (days: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + days);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Gestion de la saisie du poids
  const handleWeightChange = (val: string) => {
    setWeightInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      updateDailyWeight(selectedDate, parsed);
    } else if (val === '') {
      updateDailyWeight(selectedDate, null);
    }
  };

  // Déclencher le check-in métabolique
  const handleCheckin = async () => {
    const res = await runWeeklyCheckin();
    setCheckinResult({ success: res.success, message: res.message });
  };

  // Calculer les totaux de la journée active
  const totals = currentDay 
    ? calculateDayTotals(currentDay, customFoods, recipes)
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  // Cibles quotidiennes calculées
  const targetCals = getTargetCalories(settings);
  const targetMacros = getTargetMacros(settings);

  // Détails enrichis pour chaque aliment consommé
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black overflow-y-auto pb-8 no-scrollbar">
      
      {/* Date Selector Header - Fixed look but scrolls with page */}
      <div className="flex justify-between items-center py-4 px-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 border-b border-zinc-900">
        <button 
          onClick={() => adjustDate(-1)}
          className="p-2 text-slate-400 hover:text-slate-100 bg-zinc-900 active:bg-zinc-800 rounded-xl transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <h2 className="text-lg font-display font-bold text-slate-100 select-none">
          {formatJournalDate(selectedDate)}
        </h2>
        
        <button 
          onClick={() => adjustDate(1)}
          className="p-2 text-slate-400 hover:text-slate-100 bg-zinc-900 active:bg-zinc-800 rounded-xl transition"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

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
          <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase">Tableau des Macros</h3>
          
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

        {/* Weight Tracker Card */}
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
                    className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4 flex justify-between items-center shadow-sm relative group active:bg-zinc-900 transition duration-150"
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
                      onClick={() => removeEntry(selectedDate, entry.id)}
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
  );
};
