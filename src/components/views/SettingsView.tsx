import React, { useEffect, useState, useRef } from 'react';
import { useLogbookStore, getTargetCalories } from '../../store/useLogbookStore';
import { exportDatabaseToJson, importDatabaseFromJson } from '../../db';
import { 
  Sliders, 
  Database, 
  Download, 
  Upload, 
  Check, 
  AlertCircle, 
  TrendingDown,
  Scale
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    init,
    isLoading
  } = useLogbookStore();

  // Inputs états locaux
  const [deficit, setDeficit] = useState<string>('');
  const [splitType, setSplitType] = useState<'percentage' | 'grams'>('percentage');
  const [protSplit, setProtSplit] = useState<string>('');
  const [carbSplit, setCarbSplit] = useState<string>('');
  const [fatSplit, setFatSplit] = useState<string>('');
  
  // Nouveaux états locaux pour objectifs personnalisés et poids cible
  const [calorieGoalMode, setCalorieGoalMode] = useState<'dynamic' | 'manual'>('dynamic');
  const [manualCalorieGoal, setManualCalorieGoal] = useState<string>('');
  const [targetWeight, setTargetWeight] = useState<string>('');
  const [targetWeightDate, setTargetWeightDate] = useState<string>('');
  const [defaultTDEE, setDefaultTDEE] = useState<string>('');
  const [smoothedWeight, setSmoothedWeight] = useState<string>('');

  // États de statut
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  
  // Référence pour le input file caché
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les paramètres depuis le store Zustand
  useEffect(() => {
    if (settings) {
      setDeficit(settings.targetDeficit.toString());
      setSplitType(settings.macroSplitType);
      setProtSplit(settings.macroSplit.protein.toString());
      setCarbSplit(settings.macroSplit.carbs.toString());
      setFatSplit(settings.macroSplit.fat.toString());
      
      setCalorieGoalMode(settings.calorieGoalMode || 'dynamic');
      setManualCalorieGoal(settings.manualCalorieGoal ? settings.manualCalorieGoal.toString() : '');
      setTargetWeight(settings.targetWeight ? settings.targetWeight.toString() : '');
      setTargetWeightDate(settings.targetWeightDate || '');
      setDefaultTDEE(settings.defaultTDEE ? settings.defaultTDEE.toString() : '');
      setSmoothedWeight(settings.smoothedWeight ? settings.smoothedWeight.toString() : '');
    }
  }, [settings]);

  // Validation du total en pourcentage
  const isPercentage = splitType === 'percentage';
  const protVal = parseFloat(protSplit) || 0;
  const carbVal = parseFloat(carbSplit) || 0;
  const fatVal = parseFloat(fatSplit) || 0;
  const totalPercentage = protVal + carbVal + fatVal;
  const isPercentSplitValid = !isPercentage || totalPercentage === 100;

  // Sauvegarder les modifications de réglages
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    if (isPercentage && totalPercentage !== 100) {
      alert("Le total des répartitions en pourcentage doit être égal à 100 %.");
      return;
    }

    const deficitVal = parseFloat(deficit);
    if (isNaN(deficitVal) || deficitVal < 0) return;

    const manualCalGoal = parseFloat(manualCalorieGoal);
    const targetW = parseFloat(targetWeight);
    const defTDEE = parseFloat(defaultTDEE);
    const smoothW = parseFloat(smoothedWeight);

    await updateSettings({
      targetDeficit: deficitVal,
      macroSplitType: splitType,
      macroSplit: {
        protein: protVal,
        carbs: carbVal,
        fat: fatVal,
      },
      calorieGoalMode,
      manualCalorieGoal: isNaN(manualCalGoal) ? null : manualCalGoal,
      targetWeight: isNaN(targetW) ? null : targetW,
      targetWeightDate: targetWeightDate || null,
      defaultTDEE: isNaN(defTDEE) ? 2200 : defTDEE,
      smoothedWeight: isNaN(smoothW) ? null : smoothW,
    });

    setSaveStatus('Objectifs enregistrés ✓');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Exporter la base vers un fichier .json
  const handleExport = async () => {
    try {
      const jsonString = await exportDatabaseToJson();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const formattedDate = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `macrotracker-backup-${formattedDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Erreur lors de l'exportation : " + err.message);
    }
  };

  // Déclencher le clic sur l'input file caché pour l'importation
  const triggerImportFile = () => {
    fileInputRef.current?.click();
  };

  // Importer le fichier JSON
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const jsonText = event.target?.result as string;
        await importDatabaseFromJson(jsonText);
        
        // Re-initialiser le store Zustand immédiatement après l'import pour actualiser les données
        await init();
        
        setImportStatus({ success: true, message: 'Sauvegarde restaurée avec succès !' });
      } catch (err: any) {
        setImportStatus({ 
          success: false, 
          message: "Erreur d'import : assurez-vous que le fichier est un JSON valide de MacroTracker. " + err.message 
        });
      }
      
      // Réinitialiser le input pour pouvoir réimporter le même fichier
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black overflow-hidden">
      
      {/* Header fixe */}
      <div className="bg-zinc-950/80 backdrop-blur-md pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 px-4 border-b border-zinc-900 text-center shrink-0">
        <h2 className="text-lg font-display font-bold text-slate-100 select-none">
          Réglages Métaboliques
        </h2>
      </div>

      <div className="flex-1 ios-scroll pb-10 no-scrollbar">

      <div className="px-4 py-4 space-y-6 max-w-md mx-auto w-full">
        
        {/* Résumé des cibles actuelles */}
        {settings && (
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5">
              <Sliders className="h-24 w-24 text-accent-violet" />
            </div>
            
            <h3 className="text-xs font-display font-bold text-accent-violet tracking-wide uppercase mb-3">Vos Objectifs Actuels</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Budget Calories</span>
                <p className="text-2xl font-display font-extrabold text-slate-200 tabular-nums">
                  {getTargetCalories(settings)} <span className="text-xs text-slate-500 font-normal">kcal</span>
                </p>
              </div>
              
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Poids Lissé</span>
                <p className="text-2xl font-display font-extrabold text-slate-200 tabular-nums">
                  {settings.smoothedWeight ? `${settings.smoothedWeight.toFixed(1)} kg` : 'Aucun'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Formulaire complet de réglages */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          
          {/* Section 1 : Cibles & Mode */}
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 space-y-5 shadow-lg">
            <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase flex items-center space-x-2">
              <Sliders className="h-4.5 w-4.5 text-accent-violet" />
              <span>Objectifs Caloriques</span>
            </h3>

            {/* Sélecteur Mode Objectif (Segmented control) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Calcul des Calories Cibles</label>
              <div className="bg-black p-1 rounded-xl flex justify-between items-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCalorieGoalMode('dynamic')}
                  className={`flex-1 py-1.5 text-center rounded-lg transition active:scale-98 ${
                    calorieGoalMode === 'dynamic' ? 'bg-zinc-800 text-slate-100 shadow' : 'text-slate-500'
                  }`}
                >
                  Calculé (TDEE - Déficit)
                </button>
                <button
                  type="button"
                  onClick={() => setCalorieGoalMode('manual')}
                  className={`flex-1 py-1.5 text-center rounded-lg transition active:scale-98 ${
                    calorieGoalMode === 'manual' ? 'bg-zinc-800 text-slate-100 shadow' : 'text-slate-500'
                  }`}
                >
                  Manuel personnalisé
                </button>
              </div>
            </div>

            {/* Inputs Conditionnels */}
            {calorieGoalMode === 'manual' ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-xs font-semibold text-slate-400">Objectif Calorique Manuel (kcal)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  required
                  placeholder="Ex: 2000"
                  value={manualCalorieGoal}
                  onChange={(e) => setManualCalorieGoal(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-violet font-semibold text-center"
                />
              </div>
            ) : (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                  <span>Déficit Calorique Cible (kcal)</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  required
                  value={deficit}
                  onChange={(e) => setDeficit(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-violet font-semibold text-center"
                  placeholder="500"
                />
                <p className="text-[10px] text-slate-500">Sera soustrait de votre TDEE calculé automatiquement (ex: 500 kcal).</p>
              </div>
            )}

            {/* TDEE de base (kcal) */}
            <div className="space-y-1.5 pt-3.5 border-t border-zinc-800/60">
              <label className="text-xs font-semibold text-slate-400">TDEE Actuel / de Base (kcal)</label>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9]*"
                required
                placeholder="Ex: 2200"
                value={defaultTDEE}
                onChange={(e) => setDefaultTDEE(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-violet font-semibold text-center"
              />
              <p className="text-[10px] text-slate-500">Dépense énergétique journalière estimée (mise à jour lors des check-ins hebdomadaires).</p>
            </div>
          </div>

          {/* Section 2 : Répartition Macros */}
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 space-y-5 shadow-lg">
            <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase flex items-center space-x-2">
              <Sliders className="h-4.5 w-4.5 text-accent-teal" />
              <span>Répartition des Macros</span>
            </h3>

            {/* Type de répartition (Segmented control) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Format des Objectifs</label>
              <div className="bg-black p-1 rounded-xl flex justify-between items-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSplitType('percentage')}
                  className={`flex-1 py-1.5 text-center rounded-lg transition active:scale-98 ${
                    splitType === 'percentage' ? 'bg-zinc-800 text-slate-100 shadow' : 'text-slate-500'
                  }`}
                >
                  Pourcentages (%)
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType('grams')}
                  className={`flex-1 py-1.5 text-center rounded-lg transition active:scale-98 ${
                    splitType === 'grams' ? 'bg-zinc-800 text-slate-100 shadow' : 'text-slate-500'
                  }`}
                >
                  Grammes fixes (g)
                </button>
              </div>
            </div>

            {/* Inputs Macros */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase text-center block">Prot</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    value={protSplit}
                    onChange={(e) => setProtSplit(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 text-sm text-slate-200 text-center focus:outline-none font-bold"
                  />
                  <span className="absolute right-2.5 top-3 text-[10px] text-slate-600 font-bold">
                    {isPercentage ? '%' : 'g'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase text-center block">Gluc</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    value={carbSplit}
                    onChange={(e) => setCarbSplit(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 text-sm text-slate-200 text-center focus:outline-none font-bold"
                  />
                  <span className="absolute right-2.5 top-3 text-[10px] text-slate-600 font-bold">
                    {isPercentage ? '%' : 'g'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase text-center block">Lip</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    value={fatSplit}
                    onChange={(e) => setFatSplit(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 text-sm text-slate-200 text-center focus:outline-none font-bold"
                  />
                  <span className="absolute right-2.5 top-3 text-[10px] text-slate-600 font-bold">
                    {isPercentage ? '%' : 'g'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contrôle de validité pourcentages */}
            {isPercentage && (
              <div className="flex items-center space-x-2">
                <div className={`p-1 rounded-full shrink-0 ${isPercentSplitValid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {isPercentSplitValid ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                </div>
                <span className={`text-[11px] font-semibold ${isPercentSplitValid ? 'text-slate-400' : 'text-rose-400'}`}>
                  {isPercentSplitValid 
                    ? 'Répartition valide (total 100 %)'
                    : `Le total doit faire 100 % (Actuel : ${totalPercentage} %)`}
                </span>
              </div>
            )}
          </div>

          {/* Section 3 : Objectif de Poids Temporel */}
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 space-y-4 shadow-lg">
            <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase flex items-center space-x-2">
              <Scale className="h-4.5 w-4.5 text-accent-violet" />
              <span>Objectif de Poids</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Poids Cible (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ex: 75.0"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-violet font-semibold text-center"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Date Cible</label>
                <div className="relative">
                  <input
                    type="date"
                    value={targetWeightDate}
                    onChange={(e) => setTargetWeightDate(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-accent-violet font-semibold text-center"
                  />
                </div>
              </div>
            </div>

            {/* Poids Lissé Actuel (kg) */}
            <div className="space-y-1.5 pt-3.5 border-t border-zinc-800/60">
              <label className="text-xs font-semibold text-slate-400">Poids Lissé Actuel (kg)</label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="Ex: 78.5"
                value={smoothedWeight}
                onChange={(e) => setSmoothedWeight(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent-violet font-semibold text-center"
              />
              <p className="text-[10px] text-slate-500">Poids lissé de départ ou actuel de l'algorithme (EMA).</p>
            </div>
          </div>

          {/* Validation Form Button */}
          <button
            type="submit"
            disabled={isLoading || !isPercentSplitValid}
            className="w-full h-14 bg-gradient-to-r from-accent-teal to-blue-600 text-white font-display font-bold rounded-2xl shadow-lg active:scale-98 transition duration-150 disabled:opacity-50"
          >
            Sauvegarder tous les objectifs
          </button>

          {saveStatus && (
            <p className="text-xs text-center text-emerald-400 font-bold mt-1">
              {saveStatus}
            </p>
          )}

        </form>

        {/* Section 4 : Données & Sauvegarde */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-5 space-y-5 shadow-lg">
          <h3 className="text-sm font-display font-bold text-slate-400 tracking-wide uppercase flex items-center space-x-2">
            <Database className="h-4.5 w-4.5 text-blue-500" />
            <span>Sécurité des Données</span>
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed">
            Vos données sont conservées localement dans votre iPhone. Effectuez régulièrement des sauvegardes pour ne pas les perdre lors d'une réinitialisation de Safari.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-1">
            {/* Bouton Export */}
            <button
              onClick={handleExport}
              className="h-12 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-slate-200 font-semibold rounded-2xl flex items-center justify-center space-x-2 transition active:scale-98"
            >
              <Download className="h-4.5 w-4.5 text-blue-400" />
              <span>Exporter la Sauvegarde (JSON)</span>
            </button>

            {/* Bouton Import */}
            <button
              onClick={triggerImportFile}
              className="h-12 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-slate-200 font-semibold rounded-2xl flex items-center justify-center space-x-2 transition active:scale-98"
            >
              <Upload className="h-4.5 w-4.5 text-emerald-400" />
              <span>Restaurer une Sauvegarde</span>
            </button>

            {/* Input file caché */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleImportFileChange}
              className="hidden"
            />
          </div>

          {importStatus && (
            <div className={`p-3 rounded-xl text-xs flex items-start space-x-2 ${
              importStatus.success 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
            }`}>
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="font-medium">{importStatus.message}</p>
            </div>
          )}
        </div>

      </div>
      </div>
    </div>
  );
};
