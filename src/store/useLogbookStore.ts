import { create } from 'zustand';
import { 
  db, 
  type LogbookDay, 
  type LogbookEntry, 
  type UserSettings, 
  type CustomFood, 
  type Recipe 
} from '../db';
import { 
  calculateEMA, 
  calculateDynamicTDEE, 
  calculateDayTotals,
  calculateTargetMacros
} from '../utils/metabolism';

// Helper pour obtenir la date locale au format YYYY-MM-DD
const getLocalDateString = (dateInput = new Date()) => {
  const year = dateInput.getFullYear();
  const month = String(dateInput.getMonth() + 1).padStart(2, '0');
  const day = String(dateInput.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface LogbookState {
  selectedDate: string;
  currentDay: LogbookDay | null;
  settings: UserSettings | null;
  customFoods: CustomFood[];
  recipes: Recipe[];
  isLoading: boolean;
  error: string | null;

  // Actions d'initialisation et navigation date
  init: () => Promise<void>;
  setSelectedDate: (date: string) => Promise<void>;
  fetchDay: (date: string) => Promise<LogbookDay>;

  // Actions du journal (entrées et poids)
  addEntry: (date: string, entry: Omit<LogbookEntry, 'id'>) => Promise<void>;
  removeEntry: (date: string, entryId: string) => Promise<void>;
  updateDailyWeight: (date: string, weight: number | null) => Promise<void>;

  // Actions de gestion des aliments personnalisés
  addCustomFood: (food: Omit<CustomFood, 'id'>) => Promise<void>;
  deleteCustomFood: (id: number) => Promise<void>;

  // Actions de gestion des recettes
  addRecipe: (recipe: Omit<Recipe, 'id'>) => Promise<void>;
  deleteRecipe: (id: number) => Promise<void>;

  // Actions des paramètres
  updateSettings: (newSettings: Partial<Omit<UserSettings, 'id'>>) => Promise<void>;

  // Algorithmes métaboliques
  recalculateAllEMA: () => Promise<void>;
  runWeeklyCheckin: () => Promise<{ 
    success: boolean; 
    message: string; 
    previousTDEE?: number; 
    newTDEE?: number; 
  }>;
}

export const useLogbookStore = create<LogbookState>((set, get) => ({
  selectedDate: getLocalDateString(),
  currentDay: null,
  settings: null,
  customFoods: [],
  recipes: [],
  isLoading: false,
  error: null,

  init: async () => {
    set({ isLoading: true, error: null });
    try {
      // 1. Charger ou initialiser les paramètres utilisateur
      let settings = await db.settings.get(1);
      if (!settings) {
        settings = {
          id: 1,
          targetDeficit: 500,
          macroSplit: { protein: 30, carbs: 40, fat: 30 },
          macroSplitType: 'percentage',
          defaultTDEE: 2200,
          smoothedWeight: null
        };
        await db.settings.add(settings);
      }

      // 2. Charger les aliments et recettes
      const customFoods = await db.customFoods.toArray();
      const recipes = await db.recipes.toArray();

      // 3. Charger le journal du jour courant
      const todayStr = getLocalDateString();
      let day = await db.logbook.get(todayStr);
      if (!day) {
        day = { date: todayStr, entries: [], dailyWeight: null };
      }

      set({
        settings,
        customFoods,
        recipes,
        selectedDate: todayStr,
        currentDay: day,
      });

      // Recalculer l'EMA globale pour s'assurer de la cohérence des calculs
      await get().recalculateAllEMA();
    } catch (err: any) {
      set({ error: err.message || "Erreur lors de l'initialisation du store." });
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedDate: async (date: string) => {
    set({ isLoading: true, error: null });
    try {
      const day = await get().fetchDay(date);
      set({ selectedDate: date, currentDay: day });
    } catch (err: any) {
      set({ error: err.message || 'Erreur lors du changement de date.' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDay: async (date: string) => {
    let day = await db.logbook.get(date);
    if (!day) {
      day = { date, entries: [], dailyWeight: null };
    }
    return day;
  },

  addEntry: async (date: string, entry: Omit<LogbookEntry, 'id'>) => {
    set({ isLoading: true, error: null });
    try {
      let day = await db.logbook.get(date);
      if (!day) {
        day = { date, entries: [], dailyWeight: null };
      }

      const newEntry: LogbookEntry = {
        ...entry,
        id: crypto.randomUUID(),
      };

      day.entries.push(newEntry);
      await db.logbook.put(day);

      // Si c'est la date active, mettre à jour le state
      if (date === get().selectedDate) {
        set({ currentDay: day });
      }
    } catch (err: any) {
      set({ error: err.message || "Erreur lors de l'ajout de l'aliment consommé." });
    } finally {
      set({ isLoading: false });
    }
  },

  removeEntry: async (date: string, entryId: string) => {
    set({ isLoading: true, error: null });
    try {
      const day = await db.logbook.get(date);
      if (day) {
        day.entries = day.entries.filter(e => e.id !== entryId);
        await db.logbook.put(day);

        if (date === get().selectedDate) {
          set({ currentDay: day });
        }
      }
    } catch (err: any) {
      set({ error: err.message || "Erreur lors de la suppression de l'entrée." });
    } finally {
      set({ isLoading: false });
    }
  },

  updateDailyWeight: async (date: string, weight: number | null) => {
    set({ isLoading: true, error: null });
    try {
      let day = await db.logbook.get(date);
      if (!day) {
        day = { date, entries: [], dailyWeight: weight };
      } else {
        day.dailyWeight = weight;
      }
      await db.logbook.put(day);

      // Déclencher le lissage et recalcul de la chaîne EMA globale
      await get().recalculateAllEMA();
    } catch (err: any) {
      set({ error: err.message || 'Erreur lors de la mise à jour du poids.' });
      set({ isLoading: false });
    }
  },

  addCustomFood: async (food: Omit<CustomFood, 'id'>) => {
    set({ isLoading: true, error: null });
    try {
      await db.customFoods.add(food);
      const customFoods = await db.customFoods.toArray();
      set({ customFoods });
    } catch (err: any) {
      set({ error: err.message || "Erreur lors de l'ajout de l'aliment personnalisé." });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteCustomFood: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await db.customFoods.delete(id);
      const customFoods = await db.customFoods.toArray();
      set({ customFoods });
    } catch (err: any) {
      set({ error: err.message || "Erreur lors de la suppression de l'aliment." });
    } finally {
      set({ isLoading: false });
    }
  },

  addRecipe: async (recipe: Omit<Recipe, 'id'>) => {
    set({ isLoading: true, error: null });
    try {
      await db.recipes.add(recipe);
      const recipes = await db.recipes.toArray();
      set({ recipes });
    } catch (err: any) {
      set({ error: err.message || "Erreur lors de l'ajout de la recette." });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteRecipe: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await db.recipes.delete(id);
      const recipes = await db.recipes.toArray();
      set({ recipes });
    } catch (err: any) {
      set({ error: err.message || 'Erreur lors de la suppression de la recette.' });
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings: Partial<Omit<UserSettings, 'id'>>) => {
    set({ isLoading: true, error: null });
    try {
      const current = await db.settings.get(1);
      const updated = {
        ...(current || {
          id: 1,
          targetDeficit: 500,
          macroSplit: { protein: 30, carbs: 40, fat: 30 },
          macroSplitType: 'percentage',
          defaultTDEE: 2200,
        }),
        ...newSettings,
      } as UserSettings;
      
      await db.settings.put(updated);
      set({ settings: updated });
    } catch (err: any) {
      set({ error: err.message || 'Erreur lors de la mise à jour des paramètres.' });
    } finally {
      set({ isLoading: false });
    }
  },

  recalculateAllEMA: async () => {
    // 1. Récupérer toutes les journées triées chronologiquement
    const allDays = await db.logbook.toArray();
    allDays.sort((a, b) => a.date.localeCompare(b.date));

    let runningEMA: number | null = null;
    const daysToUpdate: LogbookDay[] = [];

    // 2. Parcourir et recalculer l'EMA
    for (const day of allDays) {
      if (day.dailyWeight !== null) {
        runningEMA = calculateEMA(day.dailyWeight, runningEMA);
        day.smoothedWeight = runningEMA;
        daysToUpdate.push(day);
      } else if (runningEMA !== null) {
        // Porter le poids lissé précédent même s'il n'y a pas de pesée ce jour-là
        day.smoothedWeight = runningEMA;
        daysToUpdate.push(day);
      } else {
        day.smoothedWeight = null;
      }
    }

    // 3. Persister les modifications dans Dexie
    if (daysToUpdate.length > 0) {
      await db.logbook.bulkPut(daysToUpdate);
    }

    // 4. Mettre à jour les paramètres de l'utilisateur avec la dernière valeur d'EMA
    const settings = await db.settings.get(1);
    if (settings) {
      settings.smoothedWeight = runningEMA;
      await db.settings.put(settings);
      set({ settings });
    }

    // 5. Mettre à jour la journée en cours d'affichage dans le store
    const currentSelected = get().selectedDate;
    const currentDay = allDays.find(d => d.date === currentSelected);
    if (currentDay) {
      set({ currentDay });
    } else {
      const refreshedDay = await get().fetchDay(currentSelected);
      set({ currentDay: refreshedDay });
    }
  },

  runWeeklyCheckin: async () => {
    const { selectedDate, customFoods, recipes, settings } = get();
    if (!settings) {
      return { success: false, message: 'Paramètres utilisateur introuvables.' };
    }

    set({ isLoading: true, error: null });

    try {
      // 1. Récupérer la fenêtre des 14 derniers jours se terminant à selectedDate
      const dates: string[] = [];
      const baseDate = new Date(selectedDate);
      
      for (let i = 13; i >= 0; i--) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        dates.push(getLocalDateString(d));
      }

      const days = await Promise.all(
        dates.map(async (date) => {
          let day = await db.logbook.get(date);
          if (!day) {
            day = { date, entries: [], dailyWeight: null };
          }
          return day;
        })
      );

      // 2. Vérifier s'il y a assez de données (>= 10 jours de poids ET >= 10 jours d'alimentation)
      const weightDays = days.filter(d => d.dailyWeight !== null);
      const foodDays = days.filter(d => {
        const totals = calculateDayTotals(d, customFoods, recipes);
        return totals.calories > 0;
      });

      if (weightDays.length < 10 || foodDays.length < 10) {
        return {
          success: false,
          message: `Données insuffisantes : ${weightDays.length}/10 pesées et ${foodDays.length}/10 journées alimentaires enregistrées sur les 14 derniers jours.`,
        };
      }

      // 3. Calculer la moyenne calorique ingérée
      const totalCalories = days.reduce((sum, d) => {
        const totals = calculateDayTotals(d, customFoods, recipes);
        return sum + totals.calories;
      }, 0);
      const averageCalories = totalCalories / 14;

      // 4. Calculer la variation de poids lissé (EMA)
      // On prend l'EMA du dernier jour (index 13) et du premier jour (index 0) de la fenêtre
      // Si une valeur est manquante (normalement impossible car >= 10 pesées garantit une initialisation), on fallback sur le poids brut
      const endWeight = days[13].smoothedWeight ?? days[13].dailyWeight ?? 0;
      const startWeight = days[0].smoothedWeight ?? days[0].dailyWeight ?? 0;
      const weightChange = endWeight - startWeight;

      // 5. Calculer le nouveau TDEE via metabolism.ts
      const newTDEE = calculateDynamicTDEE(averageCalories, weightChange, 14);
      const roundedTDEE = Math.round(newTDEE);
      const previousTDEE = settings.defaultTDEE;

      // 6. Mettre à jour les paramètres dans Dexie et le store
      const updatedSettings = {
        ...settings,
        defaultTDEE: roundedTDEE,
      };

      await db.settings.put(updatedSettings);
      set({ settings: updatedSettings });

      return {
        success: true,
        message: `Check-in réussi ! Votre TDEE est passé de ${previousTDEE} kcal à ${roundedTDEE} kcal. Vos objectifs caloriques quotidiens ont été mis à jour.`,
        previousTDEE,
        newTDEE: roundedTDEE,
      };
    } catch (err: any) {
      const errMsg = err.message || 'Erreur lors du calcul du check-in.';
      set({ error: errMsg });
      return { success: false, message: errMsg };
    } finally {
      set({ isLoading: false });
    }
  },
}));

// ==========================================
// SELECTEURS DYNAMIQUES PRATIQUES POUR L'UI
// ==========================================

/**
 * Retourne les calories cibles quotidiennes (TDEE - déficit cible)
 * avec une limite plancher de sécurité de 1200 kcal.
 */
export const getTargetCalories = (settings: UserSettings | null): number => {
  if (!settings) return 0;
  return Math.max(1200, settings.defaultTDEE - settings.targetDeficit);
};

/**
 * Calcule les macros cibles quotidiennes en grammes basées sur les calories cibles
 */
export const getTargetMacros = (settings: UserSettings | null) => {
  if (!settings) return { protein: 0, carbs: 0, fat: 0 };
  const targetCals = getTargetCalories(settings);
  return calculateTargetMacros(targetCals, settings.macroSplit, settings.macroSplitType);
};
