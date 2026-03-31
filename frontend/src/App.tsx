import { useEffect } from "react";
import type { ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import AdminDashboard from "./pages/AdminDashboard";
import ChoferDashboard from "./pages/ChoferDashboard";
import Login from "./pages/Login";
import LiveTracker from "./pages/LiveTracker";
import TariffPrintView from "./pages/TariffPrintView";
import { useAuthStore } from "./store/useAuthStore";
import { LogOut } from "lucide-react";

// Componente para proteger rutas según el rol
function ProtectedRoute({ children, allowedRole }: { children: ReactNode, allowedRole: string }) {
  const { user, role, isLoading } = useAuthStore();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Cargando Sistema...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role !== allowedRole && role !== 'superadmin') return <Navigate to="/" />;

  return children;
}

function App() {
  const { checkSession, user, role, logout } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center font-sans selection:bg-blue-500/30">
        
        {/* Barra de navegación superior solo si hay sesión */}
        {user && (
          <nav className="w-full bg-zinc-900/50 backdrop-blur-md p-4 shadow-lg flex justify-between items-center border-b border-white/5 sticky top-0 z-50">
            <div className="flex items-center gap-6">
              <span className="text-xl font-black text-white ml-2 tracking-tight">Viajes NEA</span>
              
              <div className="flex gap-4 border-l border-white/10 pl-6 ml-2 text-sm font-medium">
                {role === 'admin' && (
                  <Link to="/admin" className="text-blue-400 hover:text-blue-300 transition-colors">Panel Admin</Link>
                )}
                {role === 'chofer' && (
                  <Link to="/chofer" className="text-green-400 hover:text-green-300 transition-colors">Panel Chofer</Link>
                )}
              </div>
            </div>

            <button onClick={logout} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </nav>
        )}
        
        <main className="w-full max-w-7xl relative flex-1">
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            
            <Route path="/track/:viajeId" element={<LiveTracker />} />
            
            <Route path="/" element={
              <div className="flexItems-center justify-center p-10 h-[80vh]">
                {user ? (
                  <Navigate to={role === 'admin' ? "/admin" : "/chofer"} />
                ) : (
                  <Navigate to="/login" />
                )}
              </div>
            } />

            <Route path="/admin" element={
              <ProtectedRoute allowedRole="admin">
                <div className="p-6"><AdminDashboard /></div>
              </ProtectedRoute>
            } />

            <Route path="/admin/print-tariff" element={
              <ProtectedRoute allowedRole="admin">
                <TariffPrintView />
              </ProtectedRoute>
            } />

            <Route path="/chofer" element={
              <ProtectedRoute allowedRole="chofer">
                <div className="p-6"><ChoferDashboard /></div>
              </ProtectedRoute>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
