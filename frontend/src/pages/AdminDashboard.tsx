import { useState, useEffect, useRef } from "react";
import { Users, Car, Map as MapIcon, Tag, Loader2, CheckCircle2, Gift, Wallet, AlertTriangle, PlusCircle, History, Lock, Edit3, Trash2, Search, Calendar, Zap } from "lucide-react";
import TariffManager from "../components/TariffManager";
import ReservationTable from "../components/ReservationTable";
import RecaudacionAdmin from "../components/RecaudacionAdmin";
import { createChofer, registrarPagoChofer, updateChofer, deleteChofer } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { supabase } from "../lib/supabase";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fijar el icono de Leaflet para Vite
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("choferes");
  
  // States Formularios Alta
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [vehiculo, setVehiculo] = useState('');
  const [patente, setPatente] = useState('');
  const [dni, setDni] = useState('');
  const [tipoPago, setTipoPago] = useState('comision'); // 'base' o 'comision'
  const [valorPago, setValorPago] = useState(20); // 20% por defecto
  
  // Carga y Errores
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdChofer, setCreatedChofer] = useState<{ nombre: string, email: string, password_temporal: string } | null>(null);

  // Rastreo en Vivo (Realtime)
  const { orgId } = useAuthStore();
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);
  const channelRef = useRef<any>(null);
  const [sosAlert, setSosAlert] = useState<any | null>(null);

  // States Formularios Promociones
  const [promoTitulo, setPromoTitulo] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoPuntos, setPromoPuntos] = useState(0);
  const [loadingPromo, setLoadingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promociones, setPromociones] = useState<any[]>([]);
  
  // States Historial y Liquidaciones
  const [historialGeneral, setHistorialGeneral] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // States Caja de Choferes (Finanzas)
  const [choferesFinanzas, setChoferesFinanzas] = useState<any[]>([]);
  const [loadingFinanzas, setLoadingFinanzas] = useState(false);
  const [selectedChofer, setSelectedChofer] = useState<any | null>(null);
  const [montoPago, setMontoPago] = useState<number>(0);
  const [tipoMovimiento, setTipoMovimiento] = useState('recarga');
  const [descPago, setDescPago] = useState('');
  const [savingPago, setSavingPago] = useState(false);

  // States Fleet Management
  const [fleetDrivers, setFleetDrivers] = useState<any[]>([]);
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editChofer, setEditChofer] = useState<any | null>(null);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [historyPoints, setHistoryPoints] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [updatingFleet, setUpdatingFleet] = useState(false);

  const fetchPromos = async () => {
      if (orgId) {
          const { data } = await supabase.from('promociones').select('*').eq('organizacion_id', orgId).order('creado_en', { ascending: false });
          if (data) setPromociones(data);
      }
  };

  const fetchHistorialGeneral = async () => {
      if (!orgId) return;
      setLoadingHistorial(true);
      const { data } = await supabase
          .from('viajes')
          .select(`
             *,
             choferes ( vehiculo, tipo_pago, valor_pago, usuarios ( nombre ) )
          `)
          .eq('organizacion_id', orgId)
          .in('estado', ['finalizado', 'cancelado'])
          .order('creado_en', { ascending: false })
          .limit(100);
      if (data) setHistorialGeneral(data);
      setLoadingHistorial(false);
  };

  const fetchChoferesFinanzas = async () => {
      if (!orgId) return;
      setLoadingFinanzas(true);
      const { data } = await supabase
          .from('choferes')
          .select(`
             id, 
             dni, 
             tipo_pago, 
             valor_pago, 
             saldo, 
             limite_deuda,
             usuarios ( nombre, email )
          `)
          .eq('organizacion_id', orgId)
          .order('saldo', { ascending: true });
      if (data) setChoferesFinanzas(data);
      setLoadingFinanzas(false);
  };

  const fetchFleetDrivers = async () => {
      if (!orgId) return;
      setLoadingFleet(true);
      const { data } = await supabase
          .from('choferes')
          .select(`
             *,
             usuarios ( nombre, email, telefono, activo )
          `)
          .eq('organizacion_id', orgId)
          .order('creado_en', { ascending: false });
      if (data) setFleetDrivers(data);
      setLoadingFleet(false);
  };

  const fetchActiveTrips = async () => {
    if (!orgId) return;
    const { data } = await supabase
        .from('viajes')
        .select('*')
        .eq('organizacion_id', orgId)
        .eq('estado', 'aceptado');
    if (data) setActiveTrips(data);
  };

  useEffect(() => {
    if (activeTab === 'promos') fetchPromos();
    if (activeTab === 'liquidaciones') fetchHistorialGeneral();
    if (activeTab === 'finanzas') fetchChoferesFinanzas();
    if (activeTab === 'fleet') fetchFleetDrivers();
    if (activeTab === 'viajes') fetchActiveTrips();
  }, [activeTab, orgId]);

  const fetchHistory = async (choferId: string) => {
      setLoadingHistory(true);
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { data } = await supabase
          .from('ubicaciones_logs')
          .select('*')
          .eq('chofer_id', choferId)
          .gte('creado_en', oneHourAgo)
          .order('creado_en', { ascending: true });
      
      if (data) {
          setHistoryPoints(data.map(p => [p.lat, p.lng]));
      }
      setLoadingHistory(false);
  };

  useEffect(() => {
    if (orgId && !channelRef.current) {
      channelRef.current = supabase.channel(`tracking:${orgId}`);
      channelRef.current
        .on("presence", { event: "sync" }, () => {
          const newState = channelRef.current.presenceState();
          let flatDrivers: any[] = [];
          for (const key in newState) {
              const presences = newState[key];
              presences.forEach((presence: any) => flatDrivers.push(presence));
          }
          setOnlineDrivers(flatDrivers);
        })
        .on("broadcast", { event: "sos" }, (payload: any) => {
            setSosAlert(payload.payload);
            try {
                const audio = new Audio("https://actions.google.com/sounds/v1/alarms/spaceship_alarm.ogg");
                audio.play().catch(() => {});
            } catch (err) {}
        })
        .subscribe();
    }
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orgId]);

  const handleAltaChofer = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true); setErrorMsg(''); setCreatedChofer(null);
      try {
          const res = await createChofer({ 
              nombre, email, telefono, vehiculo, patente, dni,
              tipo_pago: tipoPago, valor_pago: Number(valorPago)
          });
          setCreatedChofer(res);
          setNombre(''); setEmail(''); setTelefono(''); setVehiculo(''); setPatente(''); setDni('');
          setTipoPago('comision'); setValorPago(20);
      } catch (err: any) {
          setErrorMsg(err.response?.data?.detail || "Error creando chofer.");
      } finally { setLoading(false); }
  };

  const handleAltaPromocion = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoadingPromo(true); setPromoError('');
      try {
          const { error } = await supabase.from('promociones').insert({
              organizacion_id: orgId, titulo: promoTitulo, descripcion: promoDesc, puntos_requeridos: promoPuntos
          });
          if (error) setPromoError(error.message);
          else { setPromoTitulo(''); setPromoDesc(''); setPromoPuntos(0); fetchPromos(); }
      } catch (err: any) { setPromoError("Error de red."); }
      finally { setLoadingPromo(false); }
  };

  const handleRegistrarPago = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedChofer || montoPago <= 0) return;
      setSavingPago(true);
      try {
          await registrarPagoChofer(selectedChofer.id, {
              monto: montoPago, tipo: tipoMovimiento, descripcion: descPago || `Registro de ${tipoMovimiento}`
          });
          alert("¡Pago registrado con éxito!");
          setMontoPago(0); setDescPago(''); setSelectedChofer(null);
          fetchChoferesFinanzas();
      } catch (err: any) {
          alert("Error: " + (err.response?.data?.detail || err.message));
      } finally { setSavingPago(false); }
  };

  const handleUpdateChofer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editChofer) return;
      setUpdatingFleet(true);
      try {
          await updateChofer(editChofer.id, {
              nombre: editChofer.usuarios?.nombre,
              email: editChofer.usuarios?.email,
              telefono: editChofer.usuarios?.telefono,
              vehiculo: editChofer.vehiculo,
              patente: editChofer.patente,
              dni: editChofer.dni,
              tipo_pago: editChofer.tipo_pago,
              valor_pago: editChofer.valor_pago,
              activo: editChofer.usuarios?.activo
          });
          setEditChofer(null);
          fetchFleetDrivers();
          alert("Chofer actualizado exitosamente.");
      } catch (err: any) {
          alert("Error actualizando: " + (err.response?.data?.detail || err.message));
      } finally { setUpdatingFleet(false); }
  };

  const handleDeleteChofer = async (id: string) => {
      setUpdatingFleet(true);
      try {
          await deleteChofer(id);
          setShowDeleteConfirm(null);
          fetchFleetDrivers();
          alert("Chofer eliminado correctamente.");
      } catch (err: any) {
          alert("Error eliminando: " + (err.response?.data?.detail || err.message));
      } finally { setUpdatingFleet(false); }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-500 w-full overflow-hidden relative">
      <h1 className="text-3xl font-black text-white mb-6 tracking-tight">
        Panel de Administración <span className="text-blue-500 font-light">| Remisería</span>
      </h1>
      
      <div className="flex gap-4 mb-8 border-b border-zinc-800 pb-4 overflow-x-auto">
        <button onClick={() => setActiveTab("choferes")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'choferes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
          <Car size={18} /> Alta de Choferes
        </button>
        <button onClick={() => setActiveTab("viajes")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'viajes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
          <MapIcon size={18} /> Rastreo en Vivo
          {onlineDrivers.length > 0 && <span className="bg-green-500 text-black px-2 py-0.5 rounded-full text-xs animate-pulse">{onlineDrivers.length}</span>}
        </button>
        <button onClick={() => setActiveTab("promos")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'promos' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
          <Tag size={18} /> Premios a Conductores
        </button>
        <button onClick={() => setActiveTab("fleet")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'fleet' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
          <Users size={18} /> Gestión de Flota
        </button>
        <button onClick={() => setActiveTab("reservas")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'reservas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
          <Calendar size={18} /> Reservas Inteligentes
        </button>
        <button onClick={() => setActiveTab("tarifas")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'tarifas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
          <Zap size={18} /> Tarifario IA
        </button>
        <button onClick={() => setActiveTab("finanzas")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'finanzas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
          <Wallet size={18} /> Caja de Choferes
        </button>
        <button onClick={() => setActiveTab("liquidaciones")} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'liquidaciones' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
          <History size={18} /> Historial Global
        </button>
      </div>

      <div className="bg-zinc-950/50 p-6 md:p-8 rounded-2xl border border-zinc-800/80">
        
        {activeTab === "tarifas" && <TariffManager />}
        {activeTab === "reservas" && <ReservationTable />}
        
        {activeTab === "choferes" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <h2 className="text-2xl font-black mb-2 text-white">Alta Especializada</h2>
              <p className="text-zinc-400 mb-6 text-sm">Crea la cuenta del chofer y configura su rentabilidad.</p>
              {errorMsg && <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg text-sm">{errorMsg}</div>}
              <form onSubmit={handleAltaChofer} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                     <input type="text" required value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre Completo" className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none" />
                     <input type="tel" required value={telefono} onChange={e=>setTelefono(e.target.value)} placeholder="Teléfono" className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Correo Electrónico" className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none" />
                     <input type="text" required value={dni} onChange={e=>setDni(e.target.value)} placeholder="Número de DNI" className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <input type="text" required value={vehiculo} onChange={e=>setVehiculo(e.target.value)} placeholder="Vehículo" className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none" />
                     <input type="text" required value={patente} onChange={e=>setPatente(e.target.value)} placeholder="Patente" className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white outline-none uppercase" />
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl">
                      <div className="grid grid-cols-2 gap-4">
                          <select value={tipoPago} onChange={e => setTipoPago(e.target.value)} className="bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-lg text-white text-sm outline-none">
                              <option value="comision">Por Comisión (%)</option>
                              <option value="base">Base Fija Semanal ($)</option>
                          </select>
                          <input type="number" required value={valorPago} onChange={e => setValorPago(Number(e.target.value))} className="bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-lg text-white text-sm outline-none" />
                      </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50">
                      {loading ? "Procesando..." : "Crear Conductor"}
                  </button>
              </form>
            </div>
            <div className="flex flex-col items-center justify-center p-6 border-l border-zinc-800">
               {createdChofer ? (
                   <div className="w-full bg-green-950/30 border border-green-500/40 p-6 rounded-2xl">
                       <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2"><CheckCircle2/> Alta Exitosa</h3>
                       <div className="bg-black/50 p-4 rounded-xl border border-zinc-700 font-mono">
                           <p className="text-xs text-zinc-500 uppercase mb-1">USUARIO</p>
                           <p className="text-blue-300 mb-3">{createdChofer.email}</p>
                           <p className="text-xs text-zinc-500 uppercase mb-1">CONTRASEÑA TEMPORAL</p>
                           <p className="text-green-300 text-lg">{createdChofer.password_temporal}</p>
                       </div>
                   </div>
               ) : <p className="text-zinc-600 text-center">Completa el formulario.</p>}
            </div>
          </div>
        )}

        {activeTab === "viajes" && (
          <div className="h-[600px] border border-zinc-700/50 rounded-2xl overflow-hidden relative">
              <div className="absolute top-4 right-4 z-[1000] bg-zinc-900/90 p-3 rounded-xl border border-zinc-700 backdrop-blur-sm shadow-xl text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div><span className="text-zinc-300">Libre</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div><span className="text-zinc-300">En Viaje</span></div>
                  <div className="flex items-center gap-2"><div className="w-8 h-[2px] bg-blue-500"></div><span className="text-zinc-300">Ruta Activa</span></div>
              </div>

              <MapContainer center={[-27.45, -58.98]} zoom={13} className="h-full w-full bg-zinc-800">
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                 
                 {/* Líneas de rutas activas */}
                 {activeTrips.map((trip) => (
                    trip.lat_origen && trip.lat_destino && (
                        <Polyline 
                          key={trip.id} 
                          positions={[[trip.lat_origen, trip.lng_origen], [trip.lat_destino, trip.lng_destino]]} 
                          color="#3b82f6" 
                          weight={3} 
                          opacity={0.6}
                          dashArray="10, 10"
                        />
                    )
                 ))}

                 {/* Historial Breadcrumbs */}
                 {showHistory && historyPoints.length > 0 && (
                     <Polyline positions={historyPoints} color="#94a3b8" weight={2} dashArray="5, 5" opacity={0.5} />
                 )}

                 {onlineDrivers.map((driver, idx) => {
                    const isBusy = driver.status === 'busy';
                    const icon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background-color: ${isBusy ? '#f97316' : '#10b981'}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7]
                    });

                    return (
                        <Marker key={idx} position={[driver.lat, driver.lng]} icon={icon}>
                           <Popup>
                              <div className="p-1 min-w-[120px]">
                                  <p className="font-bold text-zinc-900 mb-0.5">{driver.nombre}</p>
                                  <p className="text-[10px] text-zinc-500 uppercase font-black mb-2">{isBusy ? 'En Servicio' : 'Disponible'}</p>
                                  <button 
                                      onClick={() => {
                                          if (showHistory === driver.chofer_id) {
                                              setShowHistory(null);
                                              setHistoryPoints([]);
                                          } else {
                                              setShowHistory(driver.chofer_id);
                                              fetchHistory(driver.chofer_id);
                                          }
                                      }}
                                      className="w-full py-1.5 px-3 bg-zinc-900 text-white rounded-lg text-[10px] font-bold hover:bg-black transition-colors shadow-lg active:scale-95"
                                  >
                                      {showHistory === driver.chofer_id ? 'Ocultar Recorrido' : 'Ver Recorrido (1h)'}
                                  </button>
                                  {loadingHistory && showHistory === driver.chofer_id && (
                                     <div className="flex items-center justify-center gap-1 mt-2">
                                        <Loader2 className="animate-spin text-zinc-400" size={10} />
                                        <p className="text-[9px] text-zinc-400 italic">Cargando...</p>
                                     </div>
                                  )}
                              </div>
                           </Popup>
                        </Marker>
                    );
                 })}
              </MapContainer>
          </div>
        )}

        {activeTab === "promos" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-2xl font-black mb-2 text-white">Nuevo Beneficio</h2>
              <p className="text-zinc-400 mb-6 text-sm">Ofrece recompensas para motivar a tus choferes.</p>
              {promoError && <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-lg text-sm">{promoError}</div>}
              <form onSubmit={handleAltaPromocion} className="flex flex-col gap-4">
                  <input type="text" required value={promoTitulo} onChange={e=>setPromoTitulo(e.target.value)} placeholder="Título del premio" className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                  <textarea required value={promoDesc} onChange={e=>setPromoDesc(e.target.value)} placeholder="Descripción..." rows={3} className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                  <input type="number" required min="0" value={promoPuntos} onChange={e=>setPromoPuntos(Number(e.target.value))} placeholder="Puntos requeridos" className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none w-1/2" />
                  <button type="submit" disabled={loadingPromo} className="w-full bg-blue-600 text-white font-bold py-3.5 mt-2 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {loadingPromo ? <Loader2 className="animate-spin" size={20} /> : "Publicar Beneficio"}
                  </button>
              </form>
            </div>
            <div className="relative flex flex-col p-6 border-l lg:border-l-zinc-800 lg:border-t-0 border-t border-zinc-800 mt-6 lg:mt-0">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Gift size={22} className="text-blue-500"/> Promociones Activas</h3>
                <div className="flex flex-col gap-4 overflow-y-auto max-h-[440px]">
                    {promociones.map(promo => (
                        <div key={promo.id} className="bg-zinc-900/80 border border-blue-900/30 p-5 rounded-xl">
                            <h4 className="font-bold text-white text-lg">{promo.titulo}</h4>
                            <p className="text-zinc-400 text-sm">{promo.descripcion}</p>
                            <div className="mt-3 text-xs font-bold text-blue-400 bg-blue-950/40 w-max px-3 py-1.5 rounded-lg border border-blue-500/20">{promo.puntos_requeridos} PUNTOS</div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}

        {activeTab === "fleet" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-2">Control de Unidades</h2>
                  <p className="text-zinc-500 text-sm">Gestiona los perfiles y vehículos de tu flota activa.</p>
               </div>
               <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="Buscar por nombre o patente..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
               </div>
            </div>

            {loadingFleet ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32}/></div> : (
               <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-zinc-900 text-zinc-500 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-800">
                        <tr>
                           <th className="px-6 py-4">Conductor</th>
                           <th className="px-6 py-4">Vehículo</th>
                           <th className="px-6 py-4">Pago</th>
                           <th className="px-6 py-4">Saldo</th>
                           <th className="px-6 py-4 text-center">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-800/50">
                        {fleetDrivers.filter(f => 
                           (f.usuarios?.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (f.patente || "").toLowerCase().includes(searchTerm.toLowerCase())
                        ).map(fd => (
                           <tr key={fd.id} className="hover:bg-zinc-800/30 transition-colors group">
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                                       {(fd.usuarios?.nombre || "?").substring(0,1)}
                                    </div>
                                    <div>
                                       <p className="font-bold text-white leading-none mb-1">{fd.usuarios?.nombre}</p>
                                       <p className="text-[10px] text-zinc-500 uppercase">{fd.dni || 'S/DNI'}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <p className="text-zinc-300 font-medium">{fd.vehiculo}</p>
                                 <p className="text-[10px] text-zinc-500 font-mono bg-zinc-950 w-max px-1.5 py-0.5 rounded border border-zinc-800 mt-1 uppercase tracking-tighter">{fd.patente}</p>
                              </td>
                              <td className="px-6 py-4">
                                 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${fd.tipo_pago === 'base' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                    {fd.tipo_pago === 'base' ? 'Semanal' : 'Comisión %'}
                                 </span>
                              </td>
                              <td className="px-6 py-4 font-mono font-bold">
                                 <span className={(fd.saldo || 0) < (fd.limite_deuda || -2000) ? 'text-red-500' : (fd.saldo || 0) < 0 ? 'text-orange-400' : 'text-emerald-500'}>
                                    ${(fd.saldo || 0).toFixed(0)}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                 <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditChofer(fd)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors" title="Editar">
                                       <Edit3 size={16} />
                                    </button>
                                    <button onClick={() => setShowDeleteConfirm(fd.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar">
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}

            {/* Modal Edición (Aesthetic Glassmorphism) */}
            {editChofer && (
               <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
                     <button onClick={() => setEditChofer(null)} className="absolute right-6 top-6 text-zinc-500 hover:text-white">✕</button>
                     <h3 className="text-xl text-white font-black mb-1">Editar Conductor</h3>
                     <p className="text-zinc-500 text-sm mb-6">Actualiza el perfil y los datos del automóvil.</p>
                     
                     <form onSubmit={handleUpdateChofer} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Información Personal</h4>
                           <div>
                              <label className="text-[10px] text-zinc-500 mb-1 block uppercase">Nombre Completo</label>
                              <input required value={editChofer.usuarios?.nombre || ""} onChange={e=>setEditChofer({...editChofer, usuarios:{...(editChofer.usuarios || {}), nombre:e.target.value}})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                           </div>
                           <div>
                              <label className="text-[10px] text-zinc-500 mb-1 block uppercase">Correo Electrónico</label>
                              <input required type="email" value={editChofer.usuarios?.email || ""} onChange={e=>setEditChofer({...editChofer, usuarios:{...(editChofer.usuarios || {}), email:e.target.value}})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                           </div>
                           <div>
                              <label className="text-[10px] text-zinc-500 mb-1 block uppercase">Teléfono de Contacto</label>
                              <input required value={editChofer.usuarios?.telefono || ""} onChange={e=>setEditChofer({...editChofer, usuarios:{...(editChofer.usuarios || {}), telefono:e.target.value}})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                           </div>
                           <div>
                              <label className="text-[10px] text-zinc-500 mb-1 block uppercase">DNI</label>
                              <input required value={editChofer.dni || ""} onChange={e=>setEditChofer({...editChofer, dni:e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                           </div>
                        </div>

                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Datos de la Unidad y Pago</h4>
                           <div>
                              <label className="text-[10px] text-zinc-500 mb-1 block uppercase">Vehículo / Modelo</label>
                              <input required value={editChofer.vehiculo || ""} onChange={e=>setEditChofer({...editChofer, vehiculo:e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                           </div>
                           <div>
                              <label className="text-[10px] text-zinc-500 mb-1 block uppercase">Patente / Placa</label>
                              <input required value={editChofer.patente || ""} onChange={e=>setEditChofer({...editChofer, patente:e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500 uppercase" />
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                              <div>
                                 <label className="text-[10px] text-zinc-500 mb-1 block uppercase">Tipo Pago</label>
                                 <select value={editChofer.tipo_pago || "comision"} onChange={e=>setEditChofer({...editChofer, tipo_pago:e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none">
                                    <option value="comision">Comisión</option>
                                    <option value="base">Semanal</option>
                                 </select>
                              </div>
                              <div>
                                 <label className="text-[10px] text-zinc-500 mb-1 block uppercase">Valor</label>
                                 <input type="number" value={editChofer.valor_pago ?? 0} onChange={e=>setEditChofer({...editChofer, valor_pago:Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none" />
                              </div>
                           </div>
                        </div>

                        <div className="md:col-span-2 flex gap-3 mt-4 pt-6 border-t border-zinc-800">
                           <button type="button" onClick={() => setEditChofer(null)} className="flex-1 bg-zinc-800 text-zinc-400 py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors">Cancelar</button>
                           <button type="submit" disabled={updatingFleet} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50">
                              {updatingFleet ? <Loader2 className="animate-spin mx-auto"/> : "Guardar Cambios"}
                           </button>
                        </div>
                     </form>
                  </div>
               </div>
            )}

            {/* Modal Confirmación Eliminación */}
            {showDeleteConfirm && (
               <div className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-zinc-900 border border-red-900/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
                     <AlertTriangle size={48} className="text-red-500 mx-auto mb-4 animate-bounce" />
                     <h3 className="text-xl text-white font-black mb-2">¿Confirmar Baja?</h3>
                     <p className="text-zinc-500 text-sm mb-6">Esta acción es irreversible. Se eliminará el perfil del chofer y su acceso a la plataforma.</p>
                     <div className="flex flex-col gap-3">
                        <button disabled={updatingFleet} onClick={() => handleDeleteChofer(showDeleteConfirm)} className="bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-500 transition-colors">
                           {updatingFleet ? <Loader2 className="animate-spin mx-auto"/> : "Eliminar Definitivamente"}
                        </button>
                        <button onClick={() => setShowDeleteConfirm(null)} className="text-zinc-500 text-sm hover:text-white transition-colors">Mantener Conductor</button>
                     </div>
                  </div>
               </div>
            )}
          </div>
        )}

        {activeTab === "finanzas" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <RecaudacionAdmin />
            </div>
        )}

        {activeTab === "liquidaciones" && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-950/20 border-2 border-blue-900/50 p-6 rounded-2xl">
                   <p className="text-xs text-blue-500 font-bold mb-1">RECAUDACIÓN TOTAL</p>
                   <h3 className="text-3xl font-black text-blue-400">${historialGeneral.filter(v => v.estado === 'finalizado').reduce((acc, v) => acc + Number(v.precio || 0), 0).toFixed(0)}</h3>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"><p className="text-xs text-zinc-500 font-bold mb-1">VIAJES COMPLETADOS</p><h3 className="text-2xl font-black text-green-400">{historialGeneral.filter(v=>v.estado==='finalizado').length}</h3></div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"><p className="text-xs text-zinc-500 font-bold mb-1">COMISIONES ESTIMADAS</p><h3 className="text-2xl font-black text-emerald-400">${historialGeneral.filter(v => v.estado === 'finalizado' && v.choferes?.tipo_pago === 'comision').reduce((acc, v) => acc + (Number(v.precio || 0) * (Number(v.choferes?.valor_pago || 0) / 100)), 0).toFixed(0)}</h3></div>
             </div>
             <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300"><thead className="bg-zinc-900 text-xs font-bold border-b border-zinc-800"><tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Chofer</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Monto</th></tr></thead>
                <tbody>{historialGeneral.map(v => (
                    <tr key={v.id} className="border-b border-zinc-800/50">
                        <td className="px-6 py-4">{new Date(v.creado_en).toLocaleDateString()}</td>
                        <td className="px-6 py-4">{v.choferes?.usuarios?.nombre}</td>
                        <td className="px-6 py-4">{v.estado}</td>
                        <td className="px-6 py-4 text-right font-bold">${v.precio}</td>
                    </tr>
                ))}</tbody></table>
             </div>
           </div>
        )}
      </div>

      {sosAlert && (
          <div className="fixed inset-0 z-[9999] bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-red-900 border-4 border-red-500 rounded-3xl p-12 max-w-xl w-full text-center shadow-2xl">
                   <AlertTriangle size={80} className="mx-auto text-red-500 animate-pulse mb-6" />
                   <h1 className="text-5xl font-black text-white mb-2">¡ALERTA SOS!</h1>
                   <p className="text-xl text-red-200 font-bold mb-6">Conductor: {sosAlert.nombre}</p>
                   <div className="flex gap-4">
                       <a href={`https://www.google.com/maps/search/?api=1&query=${sosAlert.lat},${sosAlert.lng}`} target="_blank" className="flex-1 bg-white text-red-900 font-black py-4 rounded-xl">RASTREAR</a>
                       <button onClick={() => setSosAlert(null)} className="flex-1 bg-red-950 text-white font-bold py-4 rounded-xl">Ignorar</button>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
}
