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

export const DEFAULT_FOODS: Omit<CustomFood, 'id'>[] = [
  { name: "Blanc de poulet cru", calories: 110, protein: 23, carbs: 0, fat: 1.5 },
  { name: "Steak haché bœuf 5% cru", calories: 125, protein: 21, carbs: 0, fat: 5 },
  { name: "Saumon cru", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "Thon au naturel égoutté", calories: 110, protein: 25, carbs: 0, fat: 1 },
  { name: "Œuf entier", calories: 143, protein: 12, carbs: 1, fat: 10 },
  { name: "Blanc d'œuf", calories: 48, protein: 11, carbs: 1, fat: 0 },
  { name: "Fromage blanc 0%", calories: 48, protein: 8, carbs: 4, fat: 0 },
  { name: "Skyr nature", calories: 57, protein: 10, carbs: 4, fat: 0 },
  { name: "Whey Isolate", calories: 370, protein: 90, carbs: 1, fat: 1 },
  { name: "Tofu nature", calories: 144, protein: 15, carbs: 2, fat: 8 },
  { name: "Riz basmati cru", calories: 350, protein: 8, carbs: 77, fat: 1 },
  { name: "Pâtes crues", calories: 350, protein: 12, carbs: 71, fat: 1.5 },
  { name: "Crème de riz poudre", calories: 360, protein: 7, carbs: 80, fat: 1 },
  { name: "Flocons d'avoine", calories: 370, protein: 13, carbs: 60, fat: 7 },
  { name: "Pomme de terre crue", calories: 80, protein: 2, carbs: 17, fat: 0 },
  { name: "Patate douce crue", calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name: "Quinoa cru", calories: 368, protein: 14, carbs: 64, fat: 6 },
  { name: "Lentilles crues", calories: 353, protein: 25, carbs: 54, fat: 1 },
  { name: "Galette de riz", calories: 380, protein: 8, carbs: 82, fat: 2 },
  { name: "Pain de mie complet", calories: 250, protein: 9, carbs: 43, fat: 4 },
  { name: "Huile d'olive", calories: 900, protein: 0, carbs: 0, fat: 100 },
  { name: "Beurre de cacahuète 100%", calories: 588, protein: 25, carbs: 16, fat: 50 },
  { name: "Amandes", calories: 579, protein: 21, carbs: 21, fat: 49 },
  { name: "Noix", calories: 654, protein: 15, carbs: 14, fat: 65 },
  { name: "Avocat", calories: 160, protein: 2, carbs: 8, fat: 15 },
  { name: "Beurre doux", calories: 717, protein: 0.8, carbs: 0.6, fat: 81 },
  { name: "Brocoli cru", calories: 34, protein: 2.8, carbs: 4, fat: 0.4 },
  { name: "Haricots verts crus", calories: 31, protein: 1.8, carbs: 7, fat: 0.2 },
  { name: "Courgette crue", calories: 17, protein: 1, carbs: 3, fat: 0.3 },
  { name: "Épinards crus", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: "Tomate", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: "Banane", calories: 89, protein: 1, carbs: 22, fat: 0.3 },
  { name: "Pomme", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name: "Myrtilles", calories: 57, protein: 0.7, carbs: 14, fat: 0.3 },
  { name: "Miel", calories: 304, protein: 0.3, carbs: 82, fat: 0 },
  { name: "Chocolat noir 70%", calories: 598, protein: 8, carbs: 34, fat: 43 }
];

db.on('populate', () => {
  // Aliments de base pré-configurés
  db.customFoods.bulkAdd(DEFAULT_FOODS);

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
