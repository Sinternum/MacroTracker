import Dexie, { type Table } from 'dexie';

// ==========================================
// INTERFACES DES DONNÉES (TYPESCRIPT)
// ==========================================

export interface CustomFood {
  id?: number; // Incrémenté automatiquement par IndexedDB
  name: string;
  protein: number;  // grammes pour 100g
  carbs: number;    // grammes pour 100g
  fat: number;      // grammes pour 100g
  calories: number; // kcal pour 100g
  link?: string;    // lien internet/source optionnel (ex: fiche produit, magasin)
}

export interface RecipeIngredient {
  foodId: number;
  rawWeight: number; // poids cru de l'ingrédient en grammes
}

export interface Recipe {
  id?: number; // Incrémenté automatiquement par IndexedDB
  name: string;
  ingredients: RecipeIngredient[];
  totalCookedWeight: number; // poids total cuit final de la recette en grammes
  notes?: string; // notes/instructions de préparation (texte additionnel optionnel)
}
export interface LogbookEntry {
  id: string; // crypto.randomUUID() ou id unique généré à la volée
  foodId?: number;   // présent si type === 'food'
  recipeId?: number; // présent si type === 'recipe'
  type: 'food' | 'recipe' | 'quick-add';
  weight: number; // poids consommé en grammes
  meal?: string;  // catégorie de repas (ex: 'Petit-déjeuner', 'Déjeuner', 'Dîner', 'En-cas', etc.)
  quickAdd?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface LogbookDay {
  date: string; // Format "YYYY-MM-DD" (Sert de clé primaire)
  entries: LogbookEntry[];
  dailyWeight: number | null; // poids corporel en kg pour cette journée
  smoothedWeight?: number | null; // poids lissé en kg pour cette journée (calculé)
  steps?: number | null; // Nombre de pas du jour
  manualBurnedCalories?: number | null; // Calories dépensées manuellement
}

export interface UserSettings {
  id: number; // Fixé à 1 pour une instance unique
  targetDeficit: number; // Déficit calorique cible (ex: 500 kcal)
  macroSplit: {
    protein: number; // % ou grammes fixes
    carbs: number;   // % ou grammes fixes
    fat: number;     // % ou grammes fixes
  };
  macroSplitType: 'percentage' | 'grams'; // Type de répartition (pourcentage ou absolu)
  defaultTDEE: number; // TDEE de base estimé au départ (ex: 2000 kcal)
  smoothedWeight?: number | null; // Dernier poids lissé calculé par l'algorithme (en kg)
  calorieGoalMode: 'dynamic' | 'manual'; // Mode de calcul des calories cibles
  manualCalorieGoal?: number | null; // Objectif calorique manuel
  targetWeight?: number | null; // Objectif de poids cible (en kg)
  targetWeightDate?: string | null; // Date cible pour le poids (YYYY-MM-DD)
  mealTargets?: Record<string, number>; // Cibles caloriques par repas (ex: { 'Petit-déjeuner': 500 })
  height?: number | null; // Taille en cm (pour le calcul des pas)
}

// Interface structurée pour les fichiers d'import/export
export interface BackupData {
  customFoods: CustomFood[];
  recipes: Recipe[];
  logbook: LogbookDay[];
  settings: UserSettings[];
}

// ==========================================
// INITIALISATION DE LA BASE DEXIE.JS
// ==========================================

export class MacroTrackerDB extends Dexie {
  customFoods!: Table<CustomFood, number>;
  recipes!: Table<Recipe, number>;
  logbook!: Table<LogbookDay, string>;
  settings!: Table<UserSettings, number>;

  constructor() {
    super('MacroTrackerDB');
    
    // Déclaration des index de recherche (uniquement les propriétés clés)
    this.version(1).stores({
      customFoods: '++id, name',
      recipes: '++id, name',
      logbook: 'date',
      settings: 'id',
    });
  }
}

// Création de l'instance globale
export const db = new MacroTrackerDB();

// ==========================================
// PEUPLEMENT INITIAL (SEEDS POUR LE DEV)
// ==========================================

db.on('populate', () => {
  // Aliments de base pré-configurés
  db.customFoods.bulkAdd([
    { name: 'Blanc de poulet (cuit)', protein: 31, carbs: 0, fat: 3.6, calories: 165 },
    { name: 'Riz basmati (cru)', protein: 8.5, carbs: 78, fat: 1.2, calories: 360 },
    { name: 'Œuf entier (cuit)', protein: 13, carbs: 1.1, fat: 11, calories: 155 },
    { name: 'Flocons d\'avoine', protein: 13.5, carbs: 58.7, fat: 7, calories: 375 },
    { name: 'Banane', protein: 1.1, carbs: 20, fat: 0.3, calories: 89 },
    { name: 'Huile d\'olive', protein: 0, carbs: 0, fat: 100, calories: 884 },
    { name: 'Pomme', protein: 0.3, carbs: 14, fat: 0.2, calories: 52 },
    { name: 'Skyr Nature', protein: 11, carbs: 4, fat: 0.2, calories: 57 }
  ]);

  // Paramètres initiaux par défaut
  db.settings.add({
    id: 1,
    targetDeficit: 500,
    macroSplit: { protein: 30, carbs: 40, fat: 30 },
    macroSplitType: 'percentage',
    defaultTDEE: 2200,
    smoothedWeight: null,
    calorieGoalMode: 'dynamic',
    manualCalorieGoal: null,
    targetWeight: null,
    targetWeightDate: null,
    mealTargets: {},
    height: null
  });
});

// ==========================================
// UTILITIES DE SAUVEGARDE & RESTAURATION (BACKUP)
// ==========================================

/**
 * Exporte l'intégralité de la base de données locale dans un fichier JSON stringifié.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const customFoods = await db.customFoods.toArray();
  const recipes = await db.recipes.toArray();
  const logbook = await db.logbook.toArray();
  const settings = await db.settings.toArray();
  
  const backup: BackupData = {
    customFoods,
    recipes,
    logbook,
    settings,
  };
  
  return JSON.stringify(backup, null, 2);
}

/**
 * Importe et écrase la base de données locale à partir d'une chaîne JSON.
 * Utilise une transaction IndexedDB pour garantir l'atomicité de l'opération (tout ou rien).
 */
export async function importDatabaseFromJson(jsonString: string): Promise<void> {
  const backup = JSON.parse(jsonString) as Partial<BackupData>;
  
  // Validation minimale
  if (!backup || typeof backup !== 'object') {
    throw new Error('Le format JSON fourni est invalide.');
  }

  // Exécution atomique des suppressions et insertions
  await db.transaction('rw', [db.customFoods, db.recipes, db.logbook, db.settings], async () => {
    // Vider les tables existantes
    await db.customFoods.clear();
    await db.recipes.clear();
    await db.logbook.clear();
    await db.settings.clear();
    
    // Réinjecter les données si elles sont présentes
    if (Array.isArray(backup.customFoods)) {
      await db.customFoods.bulkAdd(backup.customFoods);
    }
    if (Array.isArray(backup.recipes)) {
      await db.recipes.bulkAdd(backup.recipes);
    }
    if (Array.isArray(backup.logbook)) {
      await db.logbook.bulkAdd(backup.logbook);
    }
    if (Array.isArray(backup.settings)) {
      await db.settings.bulkAdd(backup.settings);
    }
  });
}
