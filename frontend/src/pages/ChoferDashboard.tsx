import { useState, useEffect, useRef } from "react";
import { Users, Gift, MapPin, Navigation, Power, CheckCircle2, Navigation2, Settings, Lock, Loader2, Eye, EyeOff, Wallet, BellRing, XCircle, AlertTriangle, Zap, Calendar } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { supabase } from "../lib/supabase";
import { notificarAceptacionViaje, finalizarViaje, notificarLlegadaViaje, cancelarViajeChofer, notificarEmergencia, getActiveTariff, getReservations } from "../services/api";
import BilleteraChofer from "../components/BilleteraChofer";
import WeatherWidget from "../components/WeatherWidget";

// Formula Haversine para calcular distancia en km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): string {
    if (!lat1 || !lon1 || !lat2 || !lon2) return "0.0";
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distancia en km
    return distance.toFixed(1);
}

export default function ChoferDashboard() {
  const [activeTab, setActiveTab] = useState("rutas");
  const [isOnline, setIsOnline] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [viajesDisponibles, setViajesDisponibles] = useState<any[]>([]);
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [viajeActivo, setViajeActivo] = useState<any | null>(null);
  const [choferIdReal, setChoferIdReal] = useState<string | null>(null);
  const [choferCoords, setChoferCoords] = useState<{lat: number, lng: number} | null>(null);
  const [acceptError, setAcceptError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatePassLoading, setUpdatePassLoading] = useState(false);
  const [updatePassMsg, setUpdatePassMsg] = useState({ text: "", type: "" });
  const [historialCaja, setHistorialCaja] = useState<any[]>([]);
  const [loadingCaja, setLoadingCaja] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [configPago, setConfigPago] = useState<{ tipo: string, valor: number, dni: string, saldo: number, limite_deuda: number } | null>(null);
  
  // Nuevos states para Tarifas y Reservas Chofer
  const [activeTariff, setActiveTariff] = useState<any>(null);
  const [choferReservas, setChoferReservas] = useState<any[]>([]);
  const [loadingChoferData, setLoadingChoferData] = useState(false);

  const { user, orgId } = useAuthStore();
  
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);

  const isBlocked = configPago && configPago.saldo < configPago.limite_deuda;

  // Inicializar Canal Realtime de Organización + Viajes
  useEffect(() => {
    if (orgId && user) {
        // Suscripción al tracker gps
        channelRef.current = supabase.channel(`tracking:${orgId}`, {
            config: {
              presence: {
                key: user.id,
              },
            },
        });
        channelRef.current.subscribe();

        // 🟢 NUEVO: Suscripción a la tabla de Viajes
        const viajesChannel = supabase.channel('radar_viajes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'viajes', filter: `organizacion_id=eq.${orgId}` },
                (payload) => {
                    if (payload.new.estado === 'solicitado') {
                        setViajesDisponibles((prev) => [payload.new, ...prev]);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'viajes' },
                (payload) => {
                    // Si el viaje cambia de estado (ej: aceptado o cancelado), lo retiramos del radar
                    if (payload.new.estado !== 'solicitado') {
                        setViajesDisponibles((prev) => prev.filter(v => v.id !== payload.new.id));
                    }
                }
            )
            .subscribe();

        // 🔵 NUEVO: Suscripción a cambios en MI PERFIL (Finanzas y Bloqueo)
        const profileChannel = supabase.channel(`chofer_perfil_${user.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'choferes', filter: `usuario_id=eq.${user.id}` },
                (payload) => {
                    console.log("Actualización de perfil recibida:", payload.new);
                    setConfigPago({
                        tipo: payload.new.tipo_pago,
                        valor: payload.new.valor_pago,
                        dni: payload.new.dni,
                        saldo: payload.new.saldo || 0,
                        limite_deuda: payload.new.limite_deuda || -2000
                    });
                }
            )
            .subscribe();

        // Cargar viajes pendientes y viaje activo
        const fetchDatosGenerales = async () => {
            // 1. Obtener ID real del chofer
            let cId = null;
            const { data: cData } = await supabase.from('choferes').select('id, tipo_pago, valor_pago, dni, saldo, limite_deuda').eq('usuario_id', user.id).single();
            if (cData) {
                cId = cData.id;
                setChoferIdReal(cId);
                setConfigPago({ 
                    tipo: cData.tipo_pago, 
                    valor: cData.valor_pago, 
                    dni: cData.dni, 
                    saldo: cData.saldo || 0, 
                    limite_deuda: cData.limite_deuda || -2000 
                });
            }

            // 2. Recuperar viaje activo (Resiliencia si recarga la página)
            if (cId) {
                const { data: vActivo } = await supabase
                    .from('viajes')
                    .select('*')
                    .eq('chofer_id', cId)
                    .in('estado', ['asignado', 'en_camino', 'en_puerta'])
                    .limit(1)
                    .maybeSingle();
                
                if (vActivo) {
                    setViajeActivo(vActivo);
                }
            }

            // 3. Cargar radar de pendientes
            const { data, error } = await supabase
                .from('viajes')
                .select('*')
                .eq('estado', 'solicitado')
                .order('creado_en', { ascending: false });
            
            if (data) {
                setViajesDisponibles(data);
            } else if (error) {
                console.error("Error cargando viajes:", error);
            }

            // 4. Cargar Beneficios
            const { data: bData } = await supabase
                .from('promociones')
                .select('*')
                .eq('organizacion_id', orgId)
                .order('creado_en', { ascending: false });
            if (bData) setBeneficios(bData);
        };
        fetchDatosGenerales();

        return () => {
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
            if (channelRef.current) supabase.removeChannel(channelRef.current);
            supabase.removeChannel(viajesChannel);
        };
    }
  }, [orgId, user]);

  useEffect(() => {
     if (activeTab === "caja" && choferIdReal) {
         fetchHistorialCaja();
     }
     if (activeTab === "tarifas" || activeTab === "reservas") {
         fetchChoferDataConfig();
     }
  }, [activeTab, choferIdReal]);

  const fetchChoferDataConfig = async () => {
      setLoadingChoferData(true);
      try {
          const t = await getActiveTariff();
          setActiveTariff(t);
          
          const r = await getReservations('confirmada'); // Mostrar las que puedan tomar o estén por asignarse
          setChoferReservas(r);
      } catch (err) {}
      setLoadingChoferData(false);
  };

  const fetchHistorialCaja = async () => {
      setLoadingCaja(true);
      const { data } = await supabase
          .from('viajes')
          .select('*')
          .eq('chofer_id', choferIdReal)
          .in('estado', ['finalizado', 'cancelado'])
          .order('creado_en', { ascending: false })
          .limit(50);
          
      if (data) {
          setHistorialCaja(data);
      }
      setLoadingCaja(false);
  };

  const toggleService = () => {
      if (isOnline) {
          // Desconectar GPS y avisar Offline
          if (watchIdRef.current) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
          }
          channelRef.current?.untrack();
          setIsOnline(false);
          setChoferCoords(null);
      } else {
          // Conectar GPS y avisar Online
          setLocationError("");
          setAcceptError("");
          if (!navigator.geolocation) {
              setLocationError("Tu dispositivo no soporta GPS web.");
              return;
          }

          setIsOnline(true);
          const id = navigator.geolocation.watchPosition(
              (pos) => {
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;

                  setChoferCoords({ lat, lng });

                  const isBusy = !!viajeActivo;
                  const payload = {
                      chofer_id: user?.id,
                      nombre: user?.email, 
                      lat,
                      lng,
                      status: isBusy ? 'busy' : 'free',
                      timestamp: new Date().toISOString()
                  };
                  // Enviar presencia al canal de Supabase
                  channelRef.current?.track(payload);
              },
              () => {
                  setLocationError("GPS denegado. Permite el acceso e intenta de nuevo.");
                  setIsOnline(false);
                  if (watchIdRef.current) {
                      navigator.geolocation.clearWatch(watchIdRef.current);
                      watchIdRef.current = null;
                  }
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
          watchIdRef.current = id;
      }
  };

  // Historial de ubicación (Breadcrumbs) cada 60 segundos
  useEffect(() => {
    let logInterval: any;
    if (isOnline && choferIdReal && choferCoords && orgId) {
        const logUbicacion = async () => {
            try {
                await supabase.from('ubicaciones_logs').insert({
                    chofer_id: choferIdReal,
                    organizacion_id: orgId,
                    lat: choferCoords.lat,
                    lng: choferCoords.lng
                });
            } catch (err) {}
        };
        logUbicacion();
        logInterval = setInterval(logUbicacion, 60000);
    }
    return () => { if (logInterval) clearInterval(logInterval); };
  }, [isOnline, choferIdReal, (choferCoords?.lat), (choferCoords?.lng), orgId]);

  const handleAceptarViaje = async (viaje: any) => {
      if (!user) return;
      setAcceptError("");

      // 1. Validar identidad real de la tabla Choferes
      let cId = choferIdReal;
      if (!cId) {
          const { data: choferInfo } = await supabase
              .from('choferes')
              .select('id')
              .eq('usuario_id', user.id)
              .single();
              
          if (choferInfo) {
              cId = choferInfo.id;
              setChoferIdReal(cId);
          } else {
              setAcceptError("No tienes un perfil de chofer activo asignado.");
              return;
          }
      }

      // 2. Transacción Atómica
      const { data, error } = await supabase
          .from('viajes')
          .update({ chofer_id: cId, estado: 'asignado' })
          .eq('id', viaje.id)
          .eq('estado', 'solicitado')
          .select();

      if (error) {
          setAcceptError("Error de base de datos al aceptar el viaje: " + error.message);
          return;
      }

      if (!data || data.length === 0) {
          setAcceptError("¡Ups! Este viaje acaba de ser tomado por otro compañero.");
          setViajesDisponibles(prev => prev.filter(v => v.id !== viaje.id));
      } else {
          try {
              await notificarAceptacionViaje(viaje.id);
          } catch (err) {
              console.error("No se pudo notificar al cliente vía WhatsApp", err);
          }
          setViajeActivo(data[0]);
      }
  };

  const handleFinalizarViaje = async () => {
    if (!viajeActivo) return;
    
    try {
        await finalizarViaje(viajeActivo.id);
        
        // Actualizar saldo localmente para feedback inmediato
        if (configPago && configPago.tipo === 'comision') {
            const comision = (viajeActivo.precio || 0) * (configPago.valor / 100);
            setConfigPago({ ...configPago, saldo: configPago.saldo - comision });
        }
        
        setViajeActivo(null); // Volver al radar
    } catch (err: any) {
        alert("Error al finalizar el viaje: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleNotificarLlegada = async () => {
      if (!viajeActivo) return;
      
      const { error } = await supabase.from('viajes').update({ estado: 'en_puerta' }).eq('id', viajeActivo.id);
      if (error) {
          alert("Error de conexión: " + error.message);
          return;
      }
      
      setViajeActivo({ ...viajeActivo, estado: 'en_puerta' });
      try {
          await notificarLlegadaViaje(viajeActivo.id);
      } catch (err) {
          console.error("Error al notificar llegada por WhatsApp", err);
      }
  };

  const handleCancelarViaje = async () => {
      if (!viajeActivo) return;
      
      if (!window.confirm("¿Seguro que deseas reportar un problema y cancelar este viaje?")) return;
      
      const { error } = await supabase.from('viajes').update({ estado: 'cancelado' }).eq('id', viajeActivo.id);
      if (error) {
          alert("Error de conexión al cancelar: " + error.message);
          return;
      }
      
      try {
          await cancelarViajeChofer(viajeActivo.id);
      } catch (err) {}
      
      setViajeActivo(null);
  };

  const handleSOS = async () => {
      if (sosLoading || !choferCoords) {
          if (!choferCoords) alert("No tenemos tu GPS para enviar el SOS.");
          return;
      }
      
      if (!window.confirm("🚨 ¿Confirmas emitir la ALERTA SOS? Se le notificará a la central de forma inmediata tu ubicación.")) return;
      
      setSosLoading(true);
      try {
          channelRef.current?.send({
              type: 'broadcast',
              event: 'sos',
              payload: {
                  lat: choferCoords.lat,
                  lng: choferCoords.lng,
                  chofer_id: choferIdReal,
                  nombre: user?.email, 
                  timestamp: new Date().toISOString()
              }
          });
          
          await notificarEmergencia(choferCoords.lat, choferCoords.lng);
          alert("Alerta SOS enviada correctamente a la Central.");
      } catch (e: any) {
          alert("Sucedió un problema al emitir, intenta de nuevo o llama a la policía.");
      }
      setSosLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 6) {
          setUpdatePassMsg({ text: "La contraseña debe tener al menos 6 caracteres", type: "error" });
          return;
      }
      setUpdatePassLoading(true);
      setUpdatePassMsg({ text: "", type: "" });
      
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
          setUpdatePassMsg({ text: error.message, type: "error" });
      } else {
          setUpdatePassMsg({ text: "Contraseña actualizada correctamente", type: "success" });
          setNewPassword("");
      }
      setUpdatePassLoading(false);
  };

  return (
    <div className={`relative p-6 sm:p-8 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border backdrop-blur-xl w-full max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-700 transition-all ${isOnline ? 'bg-zinc-900/90 border-green-500/30 ring-1 ring-green-500/10' : 'bg-neutral-900/90 border-white/5'}`}>
      
      {/* DECORACIÓN FONDO (Brillo sutil) */}
      <div className={`absolute -top-24 -left-24 w-64 h-64 blur-[120px] rounded-full pointer-events-none transition-opacity duration-1000 ${isOnline ? 'bg-green-500/10 opacity-100' : 'bg-white/5 opacity-0'}`} />
      
      {isBlocked && (
          <div className="relative mb-8 bg-red-600 text-white p-5 rounded-3xl flex items-center gap-4 animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.3)] border-2 border-red-400/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg] animate-[shine_2s_infinite]" />
              <AlertTriangle size={40} className="flex-shrink-0" />
              <div>
                  <p className="font-black text-xl leading-tight tracking-tight uppercase">Cuenta Bloqueada</p>
                  <p className="text-sm opacity-90 font-medium">Límite de deuda superado (${configPago?.saldo.toFixed(0)}). Regulariza tu situación.</p>
              </div>
          </div>
      )}
      
      {/* HEADER PREMIUM */}
      <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 pb-8 border-b border-white/5 gap-6">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-3">
               <div className={`p-2 rounded-xl ${isOnline ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400'} transition-colors duration-500`}>
                  <Zap size={24} fill="currentColor" />
               </div>
               <h1 className="text-4xl font-black text-white tracking-tighter">
                  Viajes <span className={isOnline ? "text-green-500" : "text-zinc-500"}>NEA</span>
               </h1>
            </div>
            <p className="text-xs font-bold text-zinc-500 mt-2 tracking-[0.2em] max-w-[200px] truncate uppercase sm:ml-11">{user?.email}</p>
            <div className="sm:ml-10 w-full animate-in fade-in slide-in-from-left-4 duration-700">
               <WeatherWidget />
            </div>
          </div>
          
          <button 
            onClick={isBlocked ? () => alert("Tu cuenta está bloqueada por deuda. Debes saldar con administración para volver online.") : toggleService}
            className={`
              relative group flex w-full sm:w-auto justify-center items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm tracking-widest transition-all duration-300 active:scale-95 overflow-hidden
              ${isBlocked 
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                : (isOnline 
                    ? 'bg-green-500 text-black shadow-[0_0_25px_rgba(34,197,94,0.4)] hover:bg-green-400 hover:shadow-green-400/60' 
                    : 'bg-white text-black hover:bg-zinc-200 shadow-xl shadow-white/5')}
            `}
          >
              <Power size={20} className={isOnline ? "animate-pulse" : ""} /> 
              {isOnline ? "FINALIZAR TURNO" : "COMENZAR TURNO"}
          </button>
      </div>
      
      {locationError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-500 px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-2">
              <XCircle size={20} />
              {locationError}
          </div>
      )}

      {acceptError && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-5 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in zoom-in-95">
              <AlertTriangle size={20} />
              {acceptError}
          </div>
      )}

      {/* ESTADO VISUAL LIVE */}
      <div className={`relative mb-10 p-5 flex items-center gap-4 rounded-3xl border transition-all duration-700 ${isOnline ? 'bg-green-500/5 border-green-500/20 text-green-400 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]' : 'bg-zinc-950/30 border-white/5 text-zinc-500'}`}>
          <div className="relative flex h-5 w-5">
            {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-40"></span>}
            <span className={`relative inline-flex rounded-full h-5 w-5 border-2 ${isOnline ? 'bg-green-500 border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-zinc-700 border-zinc-600'}`}></span>
          </div>
          <p className="font-bold text-sm tracking-tight">{isOnline ? "CONECTADO: TRANSMITIENDO SEÑAL GPS EN VIVO" : "DESCONECTADO: SEÑAL DE RADAR INACTIVA"}</p>
      </div>

      {/* GRID DE NAVEGACIÓN PREMIUM (Resolución de Ajustes Fuera del Marco) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
        {[
          { id: 'rutas', icon: Navigation, label: 'Solicitudes', badge: isOnline && viajesDisponibles.length > 0 ? viajesDisponibles.length : 0, color: 'text-green-400' },
          { id: 'reservas', icon: Calendar, label: 'Reservas', color: 'text-blue-400' },
          { id: 'caja', icon: Wallet, label: 'Mi Caja', color: 'text-emerald-400' },
          { id: 'tarifas', icon: Zap, label: 'Tarifario', color: 'text-yellow-400' },
          { id: 'premios', icon: Gift, label: 'Premios', color: 'text-purple-400' },
          { id: 'ajustes', icon: Settings, label: 'Ajustes', color: 'text-zinc-400' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 group overflow-hidden
              ${activeTab === tab.id 
                ? 'bg-zinc-800/80 border-green-500/50 shadow-[0_15px_30px_-10px_rgba(34,197,94,0.15)] ring-1 ring-green-500/20 transform scale-[1.02]' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-800/40 hover:border-white/10'}
            `}
          >
            <tab.icon size={26} className={`mb-2.5 transition-all duration-300 ${activeTab === tab.id ? tab.color : 'text-zinc-500 group-hover:text-zinc-300 group-hover:scale-110'}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === tab.id ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`}>{tab.label}</span>
            
            {tab.badge > 0 && (
              <span className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20 animate-bounce border-2 border-zinc-900">
                {tab.badge}
              </span>
            )}
            
            {activeTab === tab.id && (
              <div className="absolute inset-x-4 bottom-2 h-1 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            )}
          </button>
        ))}
      </div>

      <div className="relative bg-zinc-950/40 backdrop-blur-sm p-6 sm:p-8 rounded-[2rem] border border-white/5 shadow-inner transition-all duration-500">
        {/* LUZ DE FONDO PARA EL CONTENIDO */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-tr-[2rem] pointer-events-none" />
        {activeTab === "tarifas" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-xl font-bold mb-4 text-blue-400 flex items-center gap-2"><Zap size={20}/> Tarifario Oficial IA</h2>
                <p className="text-zinc-400 mb-6 text-sm">Estos son los valores oficiales que nuestra Inteligencia Artificial le cotiza a los clientes.</p>
                {loadingChoferData ? <Loader2 className="animate-spin text-zinc-500 mx-auto"/> : activeTariff ? (
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col gap-4">
                       <div className="flex justify-between items-center bg-zinc-950 p-4 rounded-xl border border-zinc-700/50">
                           <span className="text-zinc-400 font-bold uppercase text-xs">Bajada de Bandera (1KM)</span>
                           <span className="text-white text-2xl font-black">${activeTariff.base_fare}</span>
                       </div>
                       <div className="flex justify-between items-center bg-zinc-950 p-4 rounded-xl border border-zinc-700/50">
                           <span className="text-zinc-400 font-bold uppercase text-xs">Fracción adicional ({activeTariff.fraction_km} KM)</span>
                           <span className="text-white text-2xl font-black">${activeTariff.per_fraction_price}</span>
                       </div>
                    </div>
                ) : <p className="text-zinc-500 italic text-center py-6">Tarifario no configurado por la administración.</p>}
            </div>
        )}

        {activeTab === "reservas" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Calendar size={20} className="text-blue-500"/> Reservas Programadas</h2>
                <p className="text-zinc-400 mb-6 text-sm">Viajes futuros que el sistema pronto despachará. Estate atento para tomarlos.</p>
                
                <div className="space-y-4">
                    {loadingChoferData ? <Loader2 className="animate-spin tracking-widest text-zinc-500 mx-auto"/> : choferReservas.length === 0 ? (
                        <p className="text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-xl">No hay reservas pendientes de despachar.</p>
                    ) : choferReservas.map(r => (
                        <div key={r.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                            <div className="flex justify-between items-start mb-2 border-b border-zinc-800 pb-2">
                                <span className="font-bold text-white text-lg">{new Date(r.fecha_viaje).toLocaleDateString()} a las <span className="text-blue-400">{r.hora_viaje.substring(0,5)}hs</span></span>
                                <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-blue-500/30">Próximamente</span>
                            </div>
                            <p className="text-sm font-medium text-white flex items-center gap-2 mt-3"><MapPin size={14} className="text-red-400"/> {r.origen}</p>
                            <p className="text-sm font-medium text-zinc-400 flex items-center gap-2 mt-1"><Navigation size={14} className="text-green-500"/> {r.destino}</p>
                            <div className="bg-zinc-950 p-2 rounded block mt-3 text-center">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Pasajero: {r.nombre_cliente}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === "rutas" && (
          <div>
            {viajeActivo ? (
                // PANTALLA DE VIAJE EN CURSO 
                <div className="bg-gradient-to-b from-green-950/40 to-zinc-900 border-2 border-green-500/40 p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="text-center mb-6">
                        <span className="bg-green-500/20 text-green-400 font-bold px-4 py-1.5 rounded-full text-sm uppercase tracking-wide border border-green-500/30 inline-block mb-3 animate-pulse">
                            Viaje en Curso
                        </span>
                        <h2 className="text-2xl font-black text-white">Navegando al Destino</h2>
                        <p className="text-zinc-400 mt-1">
                            El pasajero te está esperando.
                            {viajeActivo.origen?.cliente_telefono && ` (📱 ${viajeActivo.origen.cliente_telefono})`}
                        </p>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                            <p className="text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-widest">Punto de Origen</p>
                            <p className="text-lg text-white font-medium flex items-center gap-2">
                                <MapPin className="text-red-400" size={20} />
                                {viajeActivo.origen?.direccion || "Origen"}
                            </p>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                            <p className="text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-widest">Punto de Destino</p>
                            <p className="text-lg text-white font-medium flex items-center gap-2">
                                <Navigation className="text-green-400" size={20} />
                                {viajeActivo.destino?.direccion || "Destino"}
                            </p>
                        </div>
                        <div className="bg-green-950/20 p-4 rounded-xl border border-green-500/20 text-center">
                            <p className="text-sm font-semibold text-green-500 mb-1 uppercase tracking-widest">Cobro en Efectivo</p>
                            <p className="text-2xl text-green-400 font-black">
                                ${viajeActivo.precio}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {viajeActivo.origen?.lat && viajeActivo.destino?.lat && (
                            <a 
                                href={`https://www.google.com/maps/dir/?api=1&origin=${viajeActivo.origen.lat},${viajeActivo.origen.lng}&destination=${viajeActivo.destino.lat},${viajeActivo.destino.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full bg-blue-600 hover:bg-blue-500 flex justify-center items-center gap-2 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                            >
                                <Navigation2 size={20} /> ABRIR EN GOOGLE MAPS
                            </a>
                        )}
                        
                        <div className="grid grid-cols-2 gap-3 mt-2">
                           {viajeActivo.estado === 'asignado' || viajeActivo.estado === 'en_camino' ? (
                               <button 
                                   onClick={handleNotificarLlegada}
                                   className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 flex justify-center items-center gap-2 text-white font-bold py-4 rounded-xl transition-all shadow-lg"
                               >
                                   <BellRing size={18} /> AVISAR LLEGADA
                               </button>
                           ) : (
                               <button 
                                   disabled
                                   className="w-full bg-blue-900/50 text-blue-300 opacity-60 flex justify-center items-center gap-2 font-bold py-4 rounded-xl cursor-default"
                               >
                                   <CheckCircle2 size={18} /> PASAJERO NOTIFICADO
                               </button>
                           )}
                           
                           <button 
                               onClick={handleCancelarViaje}
                               className="w-full bg-red-950/40 hover:bg-red-900 border border-red-900/50 active:scale-95 flex justify-center items-center gap-2 text-red-400 font-bold py-4 rounded-xl transition-all"
                           >
                               <XCircle size={18} /> CANCELAR
                           </button>
                        </div>
                        
                        <button 
                            onClick={handleFinalizarViaje}
                            className="w-full mt-2 bg-green-500 hover:bg-green-400 active:scale-95 flex justify-center items-center gap-2 text-black font-black py-5 rounded-xl transition-all shadow-xl shadow-green-500/30 text-lg uppercase"
                        >
                            <CheckCircle2 size={24} /> FINALIZAR VIAJE Y COBRAR
                        </button>
                    </div>
                </div>
            ) : (
                // PANTALLA DE RADAR DE VIAJES PENDIENTES
                <>
                <h2 className="text-xl font-bold mb-4 text-white">Nuevas Solicitudes de Viajes</h2>
                {isBlocked ? (
                    <div className="bg-zinc-900/50 border-2 border-dashed border-red-900/30 p-12 rounded-3xl text-center space-y-4">
                        <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-red-500/20">
                            <Lock size={40} className="text-red-500" />
                        </div>
                        <h3 className="text-2xl font-black text-white">Radar Deshabilitado</h3>
                        <p className="text-zinc-400 max-w-md mx-auto">
                            No puedes recibir solicitudes de viajes mientras tu cuenta esté bloqueada por deuda. Regulariza tu situación en la oficina para volver a trabajar.
                        </p>
                    </div>
                ) : !isOnline ? (
                    <p className="text-zinc-500 py-6 text-center text-sm border border-dashed border-zinc-800 rounded-xl">Inicia tu turno para buscar viajes locales.</p>
                ) : (
                <div className="space-y-4">
                    {viajesDisponibles.length === 0 ? (
                        <p className="text-green-500/80 text-sm animate-pulse mb-2 font-medium flex items-center gap-2">
                           <Navigation2 className="animate-spin-slow" size={16}/> Escuchando el radar general...
                        </p>
                    ) : (
                        viajesDisponibles.map((viaje) => {
                            const distancia = choferCoords && viaje.origen?.lat ? 
                                calculateDistance(choferCoords.lat, choferCoords.lng, viaje.origen.lat, viaje.origen.lng) 
                                : "N/A ";
                            return (
                                <div key={viaje.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-zinc-700 animate-in slide-in-from-top-4 fade-in duration-300">
                                    <div className="w-full">
                                        <div className="flex justify-between w-full items-start">
                                            <p className="font-bold text-lg text-white flex items-center gap-2">
                                                <MapPin size={18} className="text-red-400"/> {viaje.origen?.direccion || "Origen Desconocido"}
                                            </p>
                                            <p className="text-green-400 font-bold bg-green-950/40 px-3 py-1 rounded-full text-sm flex-shrink-0">
                                                ${viaje.precio}
                                            </p>
                                        </div>
                                        <p className="text-zinc-400 text-sm mt-2 flex items-center gap-2">
                                            <Navigation size={14}/> Destino: {viaje.destino?.direccion || "A confirmar"}
                                        </p>
                                        <p className="text-yellow-500/90 text-xs mt-2 font-medium bg-yellow-950/30 inline-block px-2 py-1 rounded-md">
                                            📍 Pasajero a {distancia} Km de tu posición
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => handleAceptarViaje(viaje)}
                                        className="w-full sm:w-auto mt-2 sm:mt-0 bg-white hover:bg-zinc-200 text-black font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-white/10 active:scale-95 whitespace-nowrap"
                                    >
                                        Aceptar Viaje
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
            </>
            )}
          </div>
        )}

        {activeTab === "caja" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
             <BilleteraChofer />
          </div>
        )}
        
        {activeTab === "premios" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold mb-4 text-purple-400 flex items-center gap-2"><Gift size={20}/> Tus Beneficios</h2>
            <p className="text-zinc-400 mb-6 text-sm">Estas son las recompensas y acuerdos exclusivos habilitados por tu empresa en comercios adheridos.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {beneficios.length === 0 ? (
                     <div className="col-span-1 sm:col-span-2 text-center opacity-40 p-8 border border-dashed border-zinc-700 rounded-xl my-4">
                        <Gift size={48} className="mx-auto mb-4 text-zinc-600" />
                        <p className="text-sm">No hay beneficios disponibles en este momento.</p>
                     </div>
                 ) : (
                     beneficios.map(ben => (
                         <div key={ben.id} className="bg-gradient-to-br from-purple-900/40 to-zinc-900 border border-purple-800/30 p-5 rounded-2xl shadow-xl hover:border-purple-500/40 transition-colors relative overflow-hidden group flex flex-col">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                             <h3 className="font-bold text-white mb-1 text-lg">{ben.titulo}</h3>
                             <p className="text-sm text-purple-200 leading-relaxed mb-6">{ben.descripcion}</p>
                             <div className="flex items-center justify-between mt-auto">
                                 <div className="text-xs font-bold text-purple-400 bg-purple-950/40 border border-purple-500/20 px-2 py-1.5 rounded">
                                     {ben.puntos_requeridos > 0 ? `${ben.puntos_requeridos} PUNTOS` : 'GRATUITO'}
                                 </div>
                                 <button className="text-xs font-bold uppercase disabled bg-purple-600/50 px-3 py-1.5 rounded-lg text-white flex items-center gap-1 shadow-lg shadow-purple-900/50"><CheckCircle2 size={14}/> Disponible</button>
                             </div>
                         </div>
                     ))
                 )}
            </div>
          </div>
        )}

        {activeTab === "ajustes" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Settings size={20}/> Ajustes y Seguridad</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
               {/* Card Datos Personales */}
               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Users size={18} className="text-emerald-400" /> Perfil del Conductor
                  </h3>
                  <p className="text-zinc-400 text-sm mb-6">Información registrada en la flota.</p>
                  
                  <div className="space-y-4">
                      <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                          <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Nombre Completo</p>
                          <p className="text-white font-medium">{user?.nombre || 'Cargando...'}</p>
                      </div>
                      <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                          <p className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Documento (DNI)</p>
                          <p className="text-blue-400 font-mono font-bold tracking-widest">{configPago?.dni || 'Sin registrar'}</p>
                      </div>
                  </div>
               </div>

               {/* Card Cambio de Clave */}
               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Lock size={18} className="text-blue-400" /> Cambiar Contraseña
                  </h3>
                  <p className="text-zinc-400 text-sm mb-4">Actualiza tu contraseña periódicamente por seguridad. Asegurate de usar al menos 6 caracteres.</p>

                  {updatePassMsg.text && (
                    <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${updatePassMsg.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-green-500/10 text-green-400 border border-green-500/30'}`}>
                       {updatePassMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                       <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Nueva Contraseña</label>
                       <div className="relative">
                         <input 
                            type={showPassword ? "text" : "password"}
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 pr-12 bg-zinc-950/50 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-white placeholder-zinc-600"
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
                       disabled={updatePassLoading || newPassword.length < 6}
                       className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2"
                    >
                       {updatePassLoading ? <Loader2 size={18} className="animate-spin" /> : "Actualizar Contraseña"}
                    </button>
                  </form>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTÓN DE PÁNICO SOS FLOTANTE */}
      {isOnline && (
          <button
              onClick={handleSOS}
              disabled={sosLoading}
              title="Emitir Alerta SOS a la Central"
              className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[999] group bg-red-600 text-white p-5 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:bg-red-500 hover:scale-110 active:scale-95 transition-all outline-none flex items-center justify-center disabled:opacity-50 border-2 border-red-400/50"
          >
              <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20 group-hover:opacity-40" />
              <AlertTriangle size={32} className="relative z-10" />
          </button>
      )}
    </div>
  );
}
