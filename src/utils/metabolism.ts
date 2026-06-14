import type { Recipe, CustomFood, LogbookDay } from '../db';

/**

 * Calcule la moyenne mobile exponentielle (EMA) pour le lissage du poids corporel.
 * Formule : EMA = (Poids actuel * alpha) + (EMA précédent * (1 - alpha))
 * 
 * @param currentWeight Poids mesuré aujourd'hui (en kg)
 * @param previousEMA Valeur de l'EMA calculée la veille (en kg)
 * @param alpha Facteur de lissage (par défaut 0.1 pour 14 jours, soit environ 2 / (N + 1))
 */
export function calculateEMA(
  currentWeight: number,
  previousEMA: number | null,
  alpha = 0.1
): number {
  if (previousEMA === null) {
    return currentWeight;
  }
  return currentWeight * alpha + previousEMA * (1 - alpha);
}

/**
 * Calcule le TDEE dynamique réel basé sur la balance énergétique.
 * Formule : TDEE = MoyenneCalories - ((ChangementPoids * 7700) / JoursObserves)
 * 
 * @param averageCalories Moyenne des calories ingérées sur la période (kcal/jour)
 * @param weightChange Différence de poids lissé sur la période (poids_fin - poids_debut en kg)
 * @param daysObserved Nombre de jours observés (ex: 14 jours)
 */
export function calculateDynamicTDEE(
  averageCalories: number,
  weightChange: number,
  daysObserved: number
): number {
  if (daysObserved <= 0) return averageCalories;
  // 1kg de gras corporel = environ 7700 kcal
  const energyFromWeightChange = (weightChange * 7700) / daysObserved;
  return averageCalories - energyFromWeightChange;
}

/**
 * Calcule les objectifs de macros en grammes basés sur le total calorique cible et la répartition choisie.
 * 
 * @param targetCalories Calories cibles quotidiennes (kcal)
 * @param macroSplit Répartition configurée { protein, carbs, fat }
 * @param splitType 'percentage' (pourcentages) ou 'grams' (grammes fixes)
 */
export function calculateTargetMacros(
  targetCalories: number,
  macroSplit: { protein: number; carbs: number; fat: number },
  splitType: 'percentage' | 'grams'
): { protein: number; carbs: number; fat: number } {
  if (splitType === 'grams') {
    // Si c'est déjà en grammes fixes, on retourne les valeurs arrondies
    return {
      protein: Math.round(macroSplit.protein),
      carbs: Math.round(macroSplit.carbs),
      fat: Math.round(macroSplit.fat),
    };
  }

  // Si c'est en pourcentages :
  // - Protéines : 4 kcal/g
  // - Glucides : 4 kcal/g
  // - Lipides : 9 kcal/g
  const proteinGrams = (targetCalories * (macroSplit.protein / 100)) / 4;
  const carbsGrams = (targetCalories * (macroSplit.carbs / 100)) / 4;
  const fatGrams = (targetCalories * (macroSplit.fat / 100)) / 9;

  return {
    protein: Math.max(0, Math.round(proteinGrams)),
    carbs: Math.max(0, Math.round(carbsGrams)),
    fat: Math.max(0, Math.round(fatGrams)),
  };
}

/**
 * Calcule les macros et calories finales pour 100g d'une recette
 * en fonction de ses ingrédients crus et du poids final cuit.
 * 
 * @param recipe La recette
 * @param foods La liste des aliments personnalisés (pour retrouver les macros des ingrédients)
 */
export function calculateRecipeMacrosPer100g(
  recipe: Recipe,
  foods: CustomFood[]
): { protein: number; carbs: number; fat: number; calories: number } {
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalCalories = 0;

  for (const ing of recipe.ingredients) {
    const food = foods.find(f => f.id === ing.foodId);
    if (food) {
      const factor = ing.rawWeight / 100;
      totalProtein += food.protein * factor;
      totalCarbs += food.carbs * factor;
      totalFat += food.fat * factor;
      totalCalories += food.calories * factor;
    }
  }

  const cookedWeight = recipe.totalCookedWeight || 1; // Évite la division par zéro
  const factor = 100 / cookedWeight;

  return {
    protein: totalProtein * factor,
    carbs: totalCarbs * factor,
    fat: totalFat * factor,
    calories: totalCalories * factor,
  };
}

/**
 * Calcule le total des macros et calories consommés pour une journée donnée.
 * 
 * @param day La journée de suivi
 * @param foods La liste des aliments personnalisés
 * @param recipes La liste des recettes
 */
export function calculateDayTotals(
  day: LogbookDay,
  foods: CustomFood[],
  recipes: Recipe[]
): { protein: number; carbs: number; fat: number; calories: number } {
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let calories = 0;

  for (const entry of day.entries) {
    if (entry.type === 'food') {
      const food = foods.find(f => f.id === entry.foodId);
      if (food) {
        const factor = entry.weight / 100;
        protein += food.protein * factor;
        carbs += food.carbs * factor;
        fat += food.fat * factor;
        calories += food.calories * factor;
      }
    } else if (entry.type === 'recipe') {
      const recipe = recipes.find(r => r.id === entry.recipeId);
      if (recipe) {
        const recipeMacros = calculateRecipeMacrosPer100g(recipe, foods);
        const factor = entry.weight / 100;
        protein += recipeMacros.protein * factor;
        carbs += recipeMacros.carbs * factor;
        fat += recipeMacros.fat * factor;
        calories += recipeMacros.calories * factor;
      }
    } else if (entry.type === 'quick-add' && entry.quickAdd) {
      protein += entry.quickAdd.protein;
      carbs += entry.quickAdd.carbs;
      fat += entry.quickAdd.fat;
      calories += entry.quickAdd.calories;
    }
  }

  return {
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    calories: Math.round(calories),
  };
}


