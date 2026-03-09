import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Moon, Sun, BookOpen, HeartPulse, Zap, Plus, Home, BarChart2, CheckCircle2, Circle, Trash2, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
// Initialize Firebase outside the component to prevent re-initialization
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- KATEGORI HABIT ---
const CATEGORIES = {
  Ibadah: { icon: Moon, color: 'text-[#109ef0]', bg: 'bg-[#9fedfb]/30', border: 'border-[#109ef0]' },
  Ilmu: { icon: BookOpen, color: 'text-[#03d6fa]', bg: 'bg-[#9fedfb]/20', border: 'border-[#03d6fa]' },
  Kesehatan: { icon: HeartPulse, color: 'text-[#109ef0]', bg: 'bg-[#109ef0]/10', border: 'border-[#109ef0]' },
  Produktivitas: { icon: Zap, color: 'text-[#03d6fa]', bg: 'bg-[#03d6fa]/10', border: 'border-[#03d6fa]' },
};

// --- DATA HABIT BAWAAN (DEFAULT) ---
const DEFAULT_HABITS = [
  { name: '🧎 Shalat Tahajud', category: 'Ibadah', order: 1 },
  { name: '📿 Dzikir Pagi', category: 'Ibadah', order: 2 },
  { name: '📖 Tilawah Quran', category: 'Ibadah', order: 3 },
  { name: '📿 Dzikir Petang', category: 'Ibadah', order: 4 },
  { name: '💡 Hafalan Quran', category: 'Ilmu', order: 5 },
  { name: '📚 Membaca Buku', category: 'Ilmu', order: 6 },
  { name: '🤲 Sedekah', category: 'Produktivitas', order: 7 },
  { name: '🏋️ Olahraga', category: 'Kesehatan', order: 8 }
];

export default function IslamicHabitTracker() {
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'add', 'stats'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statsDate, setStatsDate] = useState(new Date());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('habbitqu_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('habbitqu_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Form State
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitCategory, setNewHabitCategory] = useState('Ibadah');

  // --- 1. FIREBASE AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 2. FIREBASE DATA FETCHING ---
  useEffect(() => {
    if (!user) return;

    // RULE 1: Strict path for private user data
    const habitsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'habits');
    
    // RULE 2: No complex queries. Fetch all, sort in memory.
    const q = query(habitsRef);

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      
      // --- AUTO-POPULATE HABIT DEFAULT ---
      if (snapshot.empty) {
        const hasSeeded = localStorage.getItem(`seeded_habbitqu_${user.uid}`);
        if (!hasSeeded) {
          localStorage.setItem(`seeded_habbitqu_${user.uid}`, 'true'); 
          try {
            for (const habit of DEFAULT_HABITS) {
              await addDoc(habitsRef, {
                name: habit.name,
                category: habit.category,
                order: habit.order,
                completedDates: [],
                createdAt: Date.now()
              });
            }
          } catch (error) {
            console.error("Gagal menambahkan habit default:", error);
          }
          return; 
        }
      }

      const fetchedHabits = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      fetchedHabits.sort((a, b) => {
        if (a.order && b.order) return a.order - b.order;
        if (a.order) return -1;
        if (b.order) return 1;
        return b.createdAt - a.createdAt;
      });
      
      setHabits(fetchedHabits);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- HELPER FUNCTIONS ---
  const getFormattedDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDateStr = getFormattedDate(selectedDate);

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  // --- CRUD OPERATIONS ---
  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!user || !newHabitName.trim()) return;

    try {
      const habitsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'habits');
      await addDoc(habitsRef, {
        name: newHabitName.trim(),
        category: newHabitCategory,
        completedDates: [], 
        createdAt: Date.now()
      });
      setNewHabitName('');
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Error adding habit:", error);
    }
  };

  const toggleHabitCompletion = async (habit) => {
    if (!user) return;

    const habitRef = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habit.id);
    const isCompleted = habit.completedDates?.includes(selectedDateStr);
    
    let updatedDates = [...(habit.completedDates || [])];
    
    if (isCompleted) {
      updatedDates = updatedDates.filter(d => d !== selectedDateStr); 
    } else {
      updatedDates.push(selectedDateStr); 
    }

    try {
      await updateDoc(habitRef, {
        completedDates: updatedDates
      });
    } catch (error) {
      console.error("Error updating habit:", error);
    }
  };

  const deleteHabit = async (habitId) => {
    if (!user) return;
    try {
      const habitRef = doc(db, 'artifacts', appId, 'users', user.uid, 'habits', habitId);
      await deleteDoc(habitRef);
    } catch (error) {
      console.error("Error deleting habit:", error);
    }
  };

  // --- RENDER COMPONENTS ---

  const renderDashboard = () => (
    <div className="flex-1 overflow-y-auto pb-24 px-5 pt-5 animate-in fade-in">
      {/* Calendar Strip */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-8 transition-colors">
        <div className="flex justify-between items-center mb-5">
          <button 
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d); }}
            className="p-1 text-gray-400 hover:text-[#109ef0] transition"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 tracking-wide transition-colors">
            {selectedDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </h2>
          <button 
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d); }}
            className="p-1 text-gray-400 hover:text-[#109ef0] transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex justify-between gap-2">
          {calendarDays.map((date, i) => {
            const isSelected = getFormattedDate(date) === selectedDateStr;
            const isToday = getFormattedDate(date) === getFormattedDate(new Date());
            
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center w-12 h-16 rounded-2xl transition-all duration-300 ${
                  isSelected 
                    ? 'bg-[#109ef0] text-white shadow-lg shadow-[#109ef0]/30 transform scale-105' 
                    : isToday 
                      ? 'bg-[#9fedfb]/30 dark:bg-[#109ef0]/20 text-[#109ef0] border-2 border-[#9fedfb] dark:border-[#109ef0]/50'
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent dark:border-gray-700'
                }`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider mb-1">
                  {date.toLocaleDateString('id-ID', { weekday: 'short' }).substring(0, 3)}
                </span>
                <span className="font-black text-sm">{date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Habit List */}
      <div className="space-y-4">
        {habits.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-[#9fedfb]/20 dark:bg-[#109ef0]/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-[#109ef0]">
              <CalendarDays size={36} />
            </div>
            <h3 className="text-gray-800 dark:text-gray-100 font-bold text-lg mb-2 transition-colors">Belum ada Habit</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 transition-colors">Mulai bangun rutinitas positif Anda hari ini.</p>
            <button 
              onClick={() => setActiveTab('add')}
              className="bg-[#109ef0] text-white px-8 py-3.5 rounded-full text-sm font-bold tracking-wide hover:bg-[#03d6fa] transition shadow-[0_8px_20px_0_rgba(16,158,240,0.3)]"
            >
              Tambah Habit
            </button>
          </div>
        ) : (
          habits.map(habit => {
            const isCompleted = habit.completedDates?.includes(selectedDateStr);
            const cat = CATEGORIES[habit.category] || CATEGORIES['Ibadah'];
            const Icon = cat.icon;

            return (
              <div 
                key={habit.id} 
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-blue-50/50 dark:bg-[#109ef0]/10 border-[#9fedfb] dark:border-[#109ef0]/50 shadow-sm transform scale-[1.02]' 
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:border-gray-200 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-colors ${isCompleted ? 'bg-[#109ef0] text-white' : `${cat.bg} ${cat.color}`}`}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg transition-colors ${isCompleted ? 'text-[#109ef0]' : 'text-gray-800 dark:text-gray-100'}`}>
                      {habit.name}
                    </h3>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 transition-colors ${isCompleted ? 'text-[#03d6fa]' : 'text-gray-400 dark:text-gray-500'}`}>{habit.category}</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleHabitCompletion(habit)}
                  className={`p-2 rounded-full transition-all duration-300 active:scale-90 ${
                    isCompleted ? 'text-[#109ef0] drop-shadow-[0_0_8px_rgba(16,158,240,0.4)]' : 'text-gray-200 dark:text-gray-600 hover:text-[#9fedfb] dark:hover:text-[#109ef0]'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={36} /> : <Circle size={36} />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderAddHabit = () => (
    <div className="flex-1 overflow-y-auto pb-24 px-5 pt-5 animate-in fade-in">
      <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-8 tracking-tight transition-colors">Tambah Habit</h2>
      
      <form onSubmit={handleAddHabit} className="space-y-8">
        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest mb-3 transition-colors">Nama Kebiasaan</label>
          <input 
            type="text" 
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder="Contoh: Tilawah 1 Juz..."
            className="w-full px-5 py-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#109ef0] focus:border-transparent bg-white dark:bg-gray-800 shadow-sm font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest mb-3 transition-colors">Kategori</label>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(CATEGORIES).map(([catName, catData]) => {
              const Icon = catData.icon;
              const isSelected = newHabitCategory === catName;
              return (
                <button
                  type="button"
                  key={catName}
                  onClick={() => setNewHabitCategory(catName)}
                  className={`flex flex-col items-center p-5 rounded-2xl border-2 transition-all duration-300 ${
                    isSelected 
                      ? `border-[#109ef0] bg-[#f0f9ff] dark:bg-[#109ef0]/20 text-[#109ef0] shadow-md transform scale-[1.02]` 
                      : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={28} className="mb-3" />
                  <span className="text-xs font-bold uppercase tracking-wider">{catName}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button 
          type="submit"
          className="w-full bg-gradient-to-r from-[#109ef0] to-[#03d6fa] hover:from-[#03d6fa] hover:to-[#109ef0] text-white font-black uppercase tracking-widest text-sm py-4.5 rounded-2xl shadow-[0_8px_20px_0_rgba(16,158,240,0.3)] transition-all active:scale-[0.98] mt-4"
        >
          Simpan Habit
        </button>
      </form>
    </div>
  );

  const renderStats = () => {
    const targetMonth = String(statsDate.getMonth() + 1).padStart(2, '0');
    const targetYear = statsDate.getFullYear();
    const daysInMonth = new Date(targetYear, statsDate.getMonth() + 1, 0).getDate();
    
    let totalPossible = habits.length * daysInMonth;
    let totalCompleted = 0;

    const habitStats = habits.map(habit => {
      const completedThisMonth = (habit.completedDates || []).filter(d => d.startsWith(`${targetYear}-${targetMonth}`)).length;
      totalCompleted += completedThisMonth;
      return {
        ...habit,
        completedThisMonth,
        percentage: Math.round((completedThisMonth / daysInMonth) * 100)
      };
    });

    const globalAverage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
    
    return (
      <div className="flex-1 overflow-y-auto pb-24 px-5 pt-5 animate-in fade-in">
        <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 tracking-tight transition-colors">Pencapaian</h2>
        
        {/* Month Navigator */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-8 flex justify-between items-center transition-colors">
          <button 
            onClick={() => { const d = new Date(statsDate); d.setMonth(d.getMonth() - 1); setStatsDate(d); }}
            className="p-2 text-gray-400 hover:text-[#109ef0] hover:bg-[#f0f9ff] dark:hover:bg-gray-700 rounded-full transition"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 tracking-wide transition-colors">
              {statsDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 transition-colors">
              {statsDate.getMonth() === new Date().getMonth() && statsDate.getFullYear() === new Date().getFullYear() ? 'Bulan Ini' : 
               statsDate.getMonth() === new Date().getMonth() + 1 && statsDate.getFullYear() === new Date().getFullYear() ? 'Bulan Depan' : 
               statsDate.getMonth() === new Date().getMonth() - 1 && statsDate.getFullYear() === new Date().getFullYear() ? 'Bulan Lalu' : 'Periode'}
            </p>
          </div>
          <button 
            onClick={() => { const d = new Date(statsDate); d.setMonth(d.getMonth() + 1); setStatsDate(d); }}
            className="p-2 text-gray-400 hover:text-[#109ef0] hover:bg-[#f0f9ff] dark:hover:bg-gray-700 rounded-full transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Global Summary Card */}
        <div className="bg-gradient-to-br from-[#109ef0] to-[#03d6fa] text-white rounded-[2rem] p-7 mb-8 shadow-xl shadow-[#109ef0]/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl transform translate-x-12 -translate-y-12"></div>
          <h3 className="text-[#9fedfb] text-xs font-bold uppercase tracking-widest mb-3 relative z-10">Rata-rata Pencapaian</h3>
          <div className="flex items-end gap-3 relative z-10">
            <span className="text-6xl font-black">{globalAverage}%</span>
            <span className="text-[#f0f9ff] text-sm mb-2 pb-0.5 font-medium">dari {habits.length} kebiasaan</span>
          </div>
        </div>
        
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4 transition-colors">Detail per Habit</h3>
        <div className="space-y-5">
          {habitStats.length === 0 ? (
            <p className="text-center text-gray-400 py-10 font-medium">Belum ada data untuk dianalisis.</p>
          ) : (
            habitStats.map(habit => {
              return (
                <div key={habit.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg transition-colors">{habit.name}</h3>
                    <button 
                      onClick={() => deleteHabit(habit.id)}
                      className="text-gray-300 dark:text-gray-500 hover:text-red-500 transition-colors p-1"
                      title="Hapus Habit"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between text-sm mb-3 font-medium">
                    <span className="text-gray-500 dark:text-gray-400 transition-colors">{habit.completedThisMonth} dari {daysInMonth} hari</span>
                    <span className="text-[#109ef0] font-black">{habit.percentage}%</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 shadow-inner overflow-hidden transition-colors">
                    <div 
                      className="h-full bg-gradient-to-r from-[#03d6fa] to-[#109ef0] rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${habit.percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center font-sans">
          <div className="animate-pulse flex flex-col items-center">
            <Moon className="text-[#109ef0] mb-5" size={56} weight="fill" />
            <div className="text-[#109ef0] font-bold uppercase tracking-widest text-sm">Memuat Data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex justify-center font-sans selection:bg-[#9fedfb] selection:text-[#109ef0] transition-colors duration-300">
        {/* Mobile App Container */}
        <div className="w-full max-w-md bg-white dark:bg-gray-900 h-screen flex flex-col relative shadow-[0_0_50px_rgba(0,0,0,0.05)] dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden sm:border-x border-gray-200 dark:border-gray-800 transition-colors duration-300">
          
          {/* App Header */}
          <header className="bg-gradient-to-r from-[#109ef0] to-[#03d6fa] pt-8 pb-6 px-6 shadow-lg z-10 rounded-b-3xl border-none relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-8 -translate-y-8"></div>
            <div className="flex justify-between items-center relative z-10">
              <div>
                <p className="text-[10px] text-[#9fedfb] font-bold uppercase tracking-widest mb-1">HabbitQu</p>
                <h1 className="text-2xl font-black text-white tracking-tight">Assalamu'alaikum</h1>
              </div>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-inner transition-all duration-300 active:scale-95 cursor-pointer"
                title="Toggle Dark Mode"
              >
                {isDarkMode ? <Sun size={24} fill="currentColor" /> : <Moon size={24} fill="currentColor" />}
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'add' && renderAddHabit()}
          {activeTab === 'stats' && renderStats()}

          {/* Bottom Navigation */}
          <nav className="absolute bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-around p-2 pb-safe z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.2)] rounded-t-3xl transition-colors duration-300">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center p-3 transition-colors duration-300 ${activeTab === 'dashboard' ? 'text-[#109ef0]' : 'text-gray-400 dark:text-gray-500 hover:text-[#03d6fa]'}`}
            >
              <Home size={24} className={activeTab === 'dashboard' ? 'fill-[#e0f2fe] dark:fill-[#109ef0]/20' : ''} />
              <span className="text-[10px] mt-1.5 font-bold uppercase tracking-widest">Hari Ini</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('add')}
              className={`flex flex-col items-center p-2 transition-transform duration-300 hover:scale-105`}
            >
              <div className={`rounded-full p-4 -mt-10 shadow-xl transition-colors ${activeTab === 'add' ? 'bg-white dark:bg-gray-900 text-[#109ef0] border-2 border-[#109ef0]' : 'bg-gradient-to-tr from-[#109ef0] to-[#03d6fa] text-white shadow-[#109ef0]/40'}`}>
                <Plus size={28} />
              </div>
              <span className={`text-[10px] mt-2 font-bold uppercase tracking-widest ${activeTab === 'add' ? 'text-[#109ef0]' : 'text-gray-400 dark:text-gray-500'}`}>Tambah</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('stats')}
              className={`flex flex-col items-center p-3 transition-colors duration-300 ${activeTab === 'stats' ? 'text-[#109ef0]' : 'text-gray-400 dark:text-gray-500 hover:text-[#03d6fa]'}`}
            >
              <BarChart2 size={24} />
              <span className="text-[10px] mt-1.5 font-bold uppercase tracking-widest">Statistik</span>
            </button>
          </nav>

        </div>
      </div>
    </div>
  );
}
