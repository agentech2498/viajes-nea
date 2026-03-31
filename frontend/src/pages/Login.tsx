import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, Mail, Loader2, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isResetView, setIsResetView] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const navigate = useNavigate();
  const checkSession = useAuthStore(state => state.checkSession);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session) {
        localStorage.setItem('sb-access-token', data.session.access_token);
        await checkSession();
        navigate('/');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Por favor, ingresa tu correo electrónico.");
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/',
      });
      if (error) throw error;
      setResetSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al enviar correo de recuperación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 p-4">
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-600/20 blur-[120px] rounded-full"></div>
          <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-green-600/20 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Car size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1">Viajes NEA</h1>
          <p className="text-zinc-400 text-sm text-center">
            {isResetView ? "Recupera acceso a tu cuenta" : "Inicia sesión en tu panel corporativo"}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 text-sm px-4 py-3 rounded-xl animate-in fade-in">
            {errorMsg === "Invalid login credentials" ? "El correo o la contraseña son incorrectos." : errorMsg}
          </div>
        )}

        {resetSuccess ? (
          <div className="mb-6 bg-green-500/10 border border-green-500/50 text-green-400 text-sm px-4 py-6 rounded-xl animate-in fade-in text-center flex flex-col items-center">
            <CheckCircle2 size={48} className="text-green-500 mb-3" />
            <p className="font-bold text-lg mb-1">¡Correo enviado¡</p>
            <p>Revisa tu bandeja de entrada (y la carpeta de spam) para restablecer tu contraseña.</p>
            <button 
              onClick={() => { setIsResetView(false); setResetSuccess(false); }}
              className="mt-6 text-blue-400 hover:text-blue-300 font-medium underline"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : isResetView ? (
          <form onSubmit={handleResetPassword} className="space-y-5 animate-in slide-in-from-right-4 fade-in">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-zinc-500" />
                </div>
                <input
                  type="email"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
                  placeholder="admin@viajesnea.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 mt-2 bg-blue-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] hover:bg-blue-500 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Enviar Enlace de Recuperación"}
            </button>

            <button
              type="button"
              onClick={() => { setIsResetView(false); setErrorMsg(''); }}
              className="w-full flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors py-2 text-sm mt-2"
            >
              <ArrowLeft size={16} /> Volver a Iniciar Sesión
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5 animate-in slide-in-from-left-4 fade-in">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail size={18} className="text-zinc-500" />
                </div>
                <input
                  type="email"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
                  placeholder="admin@viajesnea.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1 mr-1">
                 <label className="block text-sm font-medium text-zinc-300">Contraseña</label>
                 <button 
                  type="button" 
                  onClick={() => { setIsResetView(true); setErrorMsg(''); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                 >
                   ¿Olvidaste tu contraseña?
                 </button>
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock size={18} className="text-zinc-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-11 pr-12 py-3 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 mt-2 bg-white text-black font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] hover:bg-zinc-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Acceder al Sistema"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
