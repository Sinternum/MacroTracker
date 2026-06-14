import React, { useState } from 'react';
import { useLogbookStore } from '../../store/useLogbookStore';
import { 
  Search, 
  Plus, 
  X, 
  Utensils, 
  Flame, 
  Info
} from 'lucide-react';
import { type RecipeIngredient } from '../../db';
import { calculateRecipeMacrosPer100g } from '../../utils/metabolism';

export const AddView: React.FC = () => {
  const {
    selectedDate,
    customFoods,
    recipes,
    addEntry,
    addCustomFood,
    addRecipe,
    isLoading
  } = useLogbookStore();

  // Navigation par sous-onglets
  const [subTab, setSubTab] = useState<'foods' | 'recipes' | 'quick-add'>('foods');

  // Recherche d'aliments
  const [searchQuery, setSearchQuery] = useState('');

  // Modale d'ajout d'une portion (Aliment ou Recette)
  const [selectedItem, setSelectedItem] = useState<{
    id: number;
    name: string;
    type: 'food' | 'recipe';
  } | null>(null);
  const [portionWeight, setPortionWeight] = useState<string>('');

  // Modale de création d'aliment
  const [isCreatingFood, setIsCreatingFood] = useState(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodCalories, setNewFoodCalories] = useState('');
  const [newFoodProtein, setNewFoodProtein] = useState('');
  const [newFoodCarbs, setNewFoodCarbs] = useState('');
  const [newFoodFat, setNewFoodFat] = useState('');

  // Modale de création de recette
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [ingredientRawWeight, setIngredientRawWeight] = useState<string>('');
  const [totalCookedWeight, setTotalCookedWeight] = useState<string>('');

  // Saisies Quick Add
  const [quickAddCalories, setQuickAddCalories] = useState('');
  const [quickAddProtein, setQuickAddProtein] = useState('');
  const [quickAddCarbs, setQuickAddCarbs] = useState('');
  const [quickAddFat, setQuickAddFat] = useState('');
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);

  // ==========================================
  // ACTIONS ET HANDLERS
  // ==========================================

  // Filtrer les aliments par recherche
  const filteredFoods = customFoods.filter(food => 
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ajouter un aliment consommé au journal
  const handleAddEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !portionWeight) return;
    const weight = parseFloat(portionWeight);
    if (isNaN(weight) || weight <= 0) return;

    if (selectedItem.type === 'food') {
      await addEntry(selectedDate, {
        type: 'food',
        foodId: selectedItem.id,
        weight,
      });
    } else {
      await addEntry(selectedDate, {
        type: 'recipe',
        recipeId: selectedItem.id,
        weight,
      });
    }

    // Reset modale
    setSelectedItem(null);
    setPortionWeight('');
  };

  // Créer un aliment personnalisé
  const handleCreateFoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFoodName || !newFoodCalories) return;

    await addCustomFood({
      name: newFoodName,
      calories: parseFloat(newFoodCalories) || 0,
      protein: parseFloat(newFoodProtein) || 0,
      carbs: parseFloat(newFoodCarbs) || 0,
      fat: parseFloat(newFoodFat) || 0,
    });

    // Reset formulaire
    setIsCreatingFood(false);
    setNewFoodName('');
    setNewFoodCalories('');
    setNewFoodProtein('');
    setNewFoodCarbs('');
    setNewFoodFat('');
  };

  // Ajouter un ingrédient dans la recette temporaire
  const handleAddIngredientToRecipe = () => {
    const foodId = parseInt(selectedIngredientId);
    const rawWeight = parseFloat(ingredientRawWeight);
    if (isNaN(foodId) || isNaN(rawWeight) || rawWeight <= 0) return;

    // Éviter les doublons d'ingrédients
    if (recipeIngredients.some(ing => ing.foodId === foodId)) {
      alert("Cet ingrédient est déjà présent dans la recette.");
      return;
    }

    setRecipeIngredients([...recipeIngredients, { foodId, rawWeight }]);
    setIngredientRawWeight('');
  };

  // Supprimer un ingrédient de la recette temporaire
  const handleRemoveIngredientFromRecipe = (foodId: number) => {
    setRecipeIngredients(recipeIngredients.filter(ing => ing.foodId !== foodId));
  };

  // Créer la recette finale
  const handleCreateRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeName || recipeIngredients.length === 0 || !totalCookedWeight) return;

    const cookedWeight = parseFloat(totalCookedWeight);
    if (isNaN(cookedWeight) || cookedWeight <= 0) return;

    await addRecipe({
      name: newRecipeName,
      ingredients: recipeIngredients,
      totalCookedWeight: cookedWeight,
    });

    // Reset
    setIsCreatingRecipe(false);
    setNewRecipeName('');
    setRecipeIngredients([]);
    setSelectedIngredientId('');
    setIngredientRawWeight('');
    setTotalCookedWeight('');
  };

  // Soumettre un Quick Add
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const calories = parseFloat(quickAddCalories) || 0;
    const protein = parseFloat(quickAddProtein) || 0;
    const carbs = parseFloat(quickAddCarbs) || 0;
    const fat = parseFloat(quickAddFat) || 0;

    if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return;

    await addEntry(selectedDate, {
      type: 'quick-add',
      weight: 100,
      quickAdd: { calories, protein, carbs, fat },
    });

    // Indiquer le succès temporairement
    setQuickAddSuccess(true);
    setTimeout(() => setQuickAddSuccess(false), 2000);

    // Reset des champs
    setQuickAddCalories('');
    setQuickAddProtein('');
    setQuickAddCarbs('');
    setQuickAddFat('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black overflow-y-auto pb-10 no-scrollbar relative">
      
      {/* Segmented Control Header style iOS */}
      <div className="bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 py-3.5 px-4 border-b border-zinc-900">
        <div className="max-w-md mx-auto w-full bg-zinc-900 p-1 rounded-2xl flex justify-between items-center text-xs font-semibold">
          <button
            onClick={() => setSubTab('foods')}
            className={`flex-1 py-2 text-center rounded-xl transition duration-200 active:scale-98 ${
              subTab === 'foods' 
                ? 'bg-zinc-800 text-slate-100 shadow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Aliments
          </button>
          
          <button
            onClick={() => setSubTab('recipes')}
            className={`flex-1 py-2 text-center rounded-xl transition duration-200 active:scale-98 ${
              subTab === 'recipes' 
                ? 'bg-zinc-800 text-slate-100 shadow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Recettes
          </button>

          <button
            onClick={() => setSubTab('quick-add')}
            className={`flex-1 py-2 text-center rounded-xl transition duration-200 active:scale-98 ${
              subTab === 'quick-add' 
                ? 'bg-zinc-800 text-slate-100 shadow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ajout Rapide
          </button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-md mx-auto w-full flex-1">
        
        {/* ==========================================
            SOUS-VUE : ALIMENTS
           ========================================== */}
        {subTab === 'foods' && (
          <div className="space-y-4">
            
            {/* Barre de Recherche + Créer Aliment */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Rechercher un aliment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800/80 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-teal transition"
                />
              </div>

              <button
                onClick={() => setIsCreatingFood(true)}
                className="p-3 bg-accent-teal/10 text-accent-teal rounded-2xl hover:bg-accent-teal/20 transition active:scale-95 flex items-center justify-center"
                title="Créer un aliment"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Liste des aliments personnalisés */}
            <div className="space-y-2.5">
              {filteredFoods.length === 0 ? (
                <div className="bg-zinc-900/20 border border-zinc-800 border-dashed rounded-3xl p-8 text-center text-slate-500 text-xs">
                  <Utensils className="h-6 w-6 mx-auto mb-2 text-slate-600" />
                  Aucun aliment correspondant trouvé. <br />
                  Appuyez sur le bouton <strong className="text-slate-400 font-semibold">+</strong> pour en créer un.
                </div>
              ) : (
                filteredFoods.map(food => (
                  <div
                    key={food.id}
                    onClick={() => setSelectedItem({ id: food.id!, name: food.name, type: 'food' })}
                    className="bg-zinc-900/50 border border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700/60 rounded-2xl p-4 flex justify-between items-center cursor-pointer transition active:scale-[0.99] duration-100"
                  >
                    <div className="space-y-1 pr-2 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{food.name}</p>
                      <p className="text-xs text-slate-500 font-semibold tabular-nums">
                        {food.calories} kcal <span className="text-slate-600">•</span> P: {food.protein}g <span className="text-slate-600">•</span> G: {food.carbs}g <span className="text-slate-600">•</span> L: {food.fat}g
                      </p>
                    </div>
                    <span className="text-[10px] bg-zinc-950 px-2 py-1 rounded-md text-slate-500 font-bold uppercase tracking-wider shrink-0">
                      pour 100g
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            SOUS-VUE : RECETTES
           ========================================== */}
        {subTab === 'recipes' && (
          <div className="space-y-4">
            
            {/* En-tête création recette */}
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase">Vos Recettes</h3>
              <button
                onClick={() => setIsCreatingRecipe(true)}
                className="text-xs font-semibold text-accent-teal bg-accent-teal/10 hover:bg-accent-teal/20 px-3 py-1.5 rounded-xl transition inline-flex items-center space-x-1 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nouvelle Recette</span>
              </button>
            </div>

            {/* Liste des recettes existantes */}
            <div className="space-y-2.5">
              {recipes.length === 0 ? (
                <div className="bg-zinc-900/20 border border-zinc-800 border-dashed rounded-3xl p-8 text-center text-slate-500 text-xs">
                  <Utensils className="h-6 w-6 mx-auto mb-2 text-slate-600" />
                  Aucune recette enregistrée. <br />
                  Appuyez sur "Nouvelle Recette" pour en créer une.
                </div>
              ) : (
                recipes.map(recipe => {
                  const macro100 = calculateRecipeMacrosPer100g(recipe, customFoods);
                  return (
                    <div
                      key={recipe.id}
                      onClick={() => setSelectedItem({ id: recipe.id!, name: recipe.name, type: 'recipe' })}
                      className="bg-zinc-900/50 border border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700/60 rounded-2xl p-4 flex justify-between items-center cursor-pointer transition active:scale-[0.99] duration-100"
                    >
                      <div className="space-y-1 pr-2 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{recipe.name}</p>
                        <p className="text-xs text-slate-500 font-semibold tabular-nums">
                          {Math.round(macro100.calories)} kcal <span className="text-slate-600">•</span> P: {Math.round(macro100.protein)}g <span className="text-slate-600">•</span> G: {Math.round(macro100.carbs)}g <span className="text-slate-600">•</span> L: {Math.round(macro100.fat)}g
                        </p>
                      </div>
                      <span className="text-[10px] bg-zinc-950 px-2 py-1 rounded-md text-accent-teal font-bold uppercase tracking-wide shrink-0">
                        cuit 100g
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            SOUS-VUE : AJOUT RAPIDE (QUICK ADD)
           ========================================== */}
        {subTab === 'quick-add' && (
          <form onSubmit={handleQuickAddSubmit} className="space-y-6">
            
            <div className="text-center space-y-1">
              <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase">Ajout Instantané de Macros</h3>
              <p className="text-[10px] text-slate-500">Permet d'ajouter des nutriments sans créer d'aliment.</p>
            </div>

            {/* Formulaire Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Calories */}
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center space-x-1">
                  <Flame className="h-3 w-3 text-amber-500" />
                  <span>Calories</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={quickAddCalories}
                  onChange={(e) => setQuickAddCalories(e.target.value)}
                  className="w-full bg-transparent text-xl font-display font-extrabold text-slate-100 text-center focus:outline-none placeholder-zinc-700"
                />
              </div>

              {/* Protéines */}
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Protéines (g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={quickAddProtein}
                  onChange={(e) => setQuickAddProtein(e.target.value)}
                  className="w-full bg-transparent text-xl font-display font-extrabold text-slate-100 text-center focus:outline-none placeholder-zinc-700"
                />
              </div>

              {/* Glucides */}
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Glucides (g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={quickAddCarbs}
                  onChange={(e) => setQuickAddCarbs(e.target.value)}
                  className="w-full bg-transparent text-xl font-display font-extrabold text-slate-100 text-center focus:outline-none placeholder-zinc-700"
                />
              </div>

              {/* Lipides */}
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Lipides (g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={quickAddFat}
                  onChange={(e) => setQuickAddFat(e.target.value)}
                  className="w-full bg-transparent text-xl font-display font-extrabold text-slate-100 text-center focus:outline-none placeholder-zinc-700"
                />
              </div>
            </div>

            {/* Bouton de Validation */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-gradient-to-r from-accent-teal to-blue-600 text-white font-display font-bold rounded-2xl flex items-center justify-center shadow-lg active:scale-98 transition duration-150"
            >
              {quickAddSuccess ? 'Ajouté avec succès ! ✓' : 'Ajouter au Journal'}
            </button>
          </form>
        )}

      </div>

      {/* ==========================================
          MODALE : SAISIE DE LA PORTION CONSOMMÉE
         ========================================== */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-zinc-950 border-t border-zinc-800 w-full max-w-md rounded-t-3xl p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {selectedItem.type === 'food' ? 'Aliment' : 'Recette'}
                </span>
                <h4 className="text-lg font-display font-extrabold text-slate-100">{selectedItem.name}</h4>
              </div>
              <button 
                onClick={() => { setSelectedItem(null); setPortionWeight(''); }}
                className="p-1.5 bg-zinc-900 text-slate-400 hover:text-slate-200 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddEntrySubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Poids consommé (grammes)</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    autoFocus
                    required
                    placeholder="Ex: 150"
                    value={portionWeight}
                    onChange={(e) => setPortionWeight(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-4 text-center text-2xl font-display font-extrabold text-slate-200 focus:outline-none focus:border-accent-teal transition"
                  />
                  <span className="absolute right-4 top-5 text-sm font-bold text-slate-500">g</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-accent-teal text-white font-display font-bold rounded-2xl shadow-lg active:scale-98 transition duration-150"
              >
                Valider l'Ajout
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODALE : CRÉATION ALIMENT
         ========================================== */}
      {isCreatingFood && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-zinc-950 border-t border-zinc-800 w-full max-w-md rounded-t-3xl p-6 space-y-6 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200">
            
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-display font-extrabold text-slate-100">Nouvel Aliment</h4>
                <p className="text-[10px] text-slate-500 font-semibold">Toutes les valeurs doivent être exprimées pour 100g cru/cuit</p>
              </div>
              <button 
                onClick={() => setIsCreatingFood(false)}
                className="p-1.5 bg-zinc-900 text-slate-400 hover:text-slate-200 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFoodSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Nom de l'aliment</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Flocons d'Avoine"
                  value={newFoodName}
                  onChange={(e) => setNewFoodName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-teal transition font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Calories (kcal)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    placeholder="0"
                    value={newFoodCalories}
                    onChange={(e) => setNewFoodCalories(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-teal transition font-semibold text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Protéines (g)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    placeholder="0"
                    value={newFoodProtein}
                    onChange={(e) => setNewFoodProtein(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-teal transition font-semibold text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Glucides (g)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    placeholder="0"
                    value={newFoodCarbs}
                    onChange={(e) => setNewFoodCarbs(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-teal transition font-semibold text-center"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Lipides (g)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    placeholder="0"
                    value={newFoodFat}
                    onChange={(e) => setNewFoodFat(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-teal transition font-semibold text-center"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-accent-teal text-white font-display font-bold rounded-2xl shadow-lg active:scale-98 transition duration-150 mt-2"
              >
                Créer l'Aliment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODALE : CRÉATION RECETTE (AVEC CONVERSION)
         ========================================== */}
      {isCreatingRecipe && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-zinc-950 border-t border-zinc-800 w-full max-w-md rounded-t-3xl p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-200">
            
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-display font-extrabold text-slate-100">Créer une Recette</h4>
                <p className="text-[10px] text-slate-500 font-semibold">Calcul automatique des macros cuits</p>
              </div>
              <button 
                onClick={() => setIsCreatingRecipe(false)}
                className="p-1.5 bg-zinc-900 text-slate-400 hover:text-slate-200 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecipeSubmit} className="space-y-5">
              
              {/* Nom */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Nom de la recette</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Riz-Blanc de poulet coco"
                  value={newRecipeName}
                  onChange={(e) => setNewRecipeName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-teal transition font-medium"
                />
              </div>

              {/* Ajouter ingrédient (Sélecteur + Poids) */}
              <div className="bg-zinc-900/40 p-4 border border-zinc-800 rounded-2xl space-y-3.5">
                <h5 className="text-xs font-display font-bold text-slate-300">Ajouter un Ingrédient Cru</h5>
                
                <div className="space-y-2">
                  <select
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="">-- Sélectionner un aliment --</option>
                    {customFoods.map(food => (
                      <option key={food.id} value={food.id}>
                        {food.name} ({food.calories} kcal)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      pattern="[0-9]*"
                      placeholder="Poids cru (g)"
                      value={ingredientRawWeight}
                      onChange={(e) => setIngredientRawWeight(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none text-center"
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-slate-500 font-bold">g</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddIngredientToRecipe}
                    className="px-4 py-2.5 bg-accent-teal text-black text-xs font-bold rounded-xl active:scale-95 transition flex items-center space-x-1"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Ajouter</span>
                  </button>
                </div>
              </div>

              {/* Liste ingrédients ajoutés */}
              {recipeIngredients.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-display font-bold text-slate-400">Ingrédients de la préparation :</h5>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {recipeIngredients.map((ing) => {
                      const food = customFoods.find(f => f.id === ing.foodId);
                      return (
                        <div key={ing.foodId} className="flex justify-between items-center bg-zinc-900 px-3 py-2 rounded-xl text-xs">
                          <span className="text-slate-300 font-medium truncate max-w-[200px]">{food?.name}</span>
                          <div className="flex items-center space-x-3 shrink-0">
                            <span className="font-bold text-slate-400 tabular-nums">{ing.rawWeight}g cru</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientFromRecipe(ing.foodId)}
                              className="text-rose-500 p-1 rounded-md"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Poids Cuit Final */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <label className="text-xs font-semibold text-slate-400">Poids Cuit Final de la Recette</label>
                  <span className="text-[9px] text-slate-500 font-medium flex items-center space-x-0.5">
                    <Info className="h-3 w-3 inline text-accent-teal mr-0.5" />
                    Cru total vs Cuit
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    placeholder="Poids total après cuisson (g)"
                    value={totalCookedWeight}
                    onChange={(e) => setTotalCookedWeight(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-teal transition font-semibold text-center"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-slate-500">g cuit</span>
                </div>
              </div>

              {/* Validation */}
              <button
                type="submit"
                disabled={isLoading || recipeIngredients.length === 0 || !totalCookedWeight}
                className="w-full h-12 bg-accent-teal text-white font-display font-bold rounded-2xl shadow-lg active:scale-98 transition disabled:opacity-50 duration-150 mt-2"
              >
                Créer la Recette
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
