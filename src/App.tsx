import { useEffect } from 'react';
import { useLogbookStore } from './store/useLogbookStore';
import { Journal } from './components/views/Journal';
import { AddView } from './components/views/AddView';
import { SettingsView } from './components/views/SettingsView';
import { 
  ClipboardList, 
  PlusCircle, 
  Settings as SettingsIcon
} from 'lucide-react';

function App() {
  const init = useLogbookStore((state) => state.init);
  const activeTab = useLogbookStore((state) => state.activeTab);
  const setActiveTab = useLogbookStore((state) => state.setActiveTab);

  // Initialiser la base locale et le store au chargement de la PWA
  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="h-[100dvh] w-full bg-black text-slate-100 flex flex-col overflow-hidden select-none touch-manipulation">
      
      {/* Zone de Contenu Principal (remplit l'espace au-dessus de la Tab Bar) */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {activeTab === 'journal' && <Journal />}
        
        {activeTab === 'add' && <AddView />}
        {activeTab === 'settings' && <SettingsView />}
      </div>

      {/* iOS Standalone Tab Bar - Navigation principale en bas */}
      <nav className="bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-900/80 pb-safe pt-2.5 z-40">
        <div className="max-w-md mx-auto px-6 flex justify-around items-center">
          
          {/* Bouton Journal */}
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex flex-col items-center space-y-1.5 focus:outline-none transition active:scale-95 ${
              activeTab === 'journal' ? 'text-accent-teal' : 'text-slate-500'
            }`}
          >
            <ClipboardList className="h-6 w-6 stroke-[2.2]" />
            <span className="text-[10px] font-display font-semibold tracking-wide">Journal</span>
          </button>

          {/* Bouton Ajouter */}
          <button
            onClick={() => setActiveTab('add')}
            className={`flex flex-col items-center space-y-1.5 focus:outline-none transition active:scale-95 ${
              activeTab === 'add' ? 'text-accent-teal' : 'text-slate-500'
            }`}
          >
            <PlusCircle className="h-6 w-6 stroke-[2.2]" />
            <span className="text-[10px] font-display font-semibold tracking-wide">Ajouter</span>
          </button>

          {/* Bouton Paramètres */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center space-y-1.5 focus:outline-none transition active:scale-95 ${
              activeTab === 'settings' ? 'text-accent-violet' : 'text-slate-500'
            }`}
          >
            <SettingsIcon className="h-6 w-6 stroke-[2.2]" />
            <span className="text-[10px] font-display font-semibold tracking-wide">Réglages</span>
          </button>

        </div>
      </nav>

    </div>
  );
}

export default App;
