import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { getViajeTrackingInfo } from "../services/api";
import { supabase } from "../lib/supabase";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Car, Loader2, MapPin, Navigation, Info, ShieldCheck, CheckCircle2 } from "lucide-react";
import L from "leaflet";

// Cargar Icono de coche
const carIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/3202/3202926.png",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

const destIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Componente para re-centrar el mapa al auto
function RecenterMap({ lat, lng }: { lat: number, lng: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng], 16, { animate: true });
    }, [lat, lng, map]);
    return null;
}

export default function LiveTracker() {
  const { viajeId } = useParams();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [liveCoords, setLiveCoords] = useState<{lat: number, lng: number} | null>(null);
  
  const channelRef = useRef<any>(null);
  
  // Función para obtener/refrescar info base
  const fetchTracking = async () => {
      try {
          if (!viajeId) return;
          const res = await getViajeTrackingInfo(viajeId);
          setData(res);
          
          if (res.chofer?.lat && res.chofer?.lng && !liveCoords) {
              setLiveCoords({ lat: res.chofer.lat, lng: res.chofer.lng });
          }
      } catch (err: any) {
          setErrorMsg(err.response?.data?.detail || "Link inválido o no disponible.");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchTracking();
      // Polling de seguridad de estado general cada 15 segundos
      const interval = setInterval(() => {
          fetchTracking();
      }, 15000);
      return () => clearInterval(interval);
  }, [viajeId]);

  // Suscripción al GPS en vivo (Presence Channel)
  useEffect(() => {
      if (data && data.organizacion_id && data.chofer?.usuario_id && !channelRef.current) {
          // Nos conectamos al radar PÚBLICO general
          channelRef.current = supabase.channel(`tracking:${data.organizacion_id}`);
          
          channelRef.current
            .on("presence", { event: "sync" }, () => {
              const newState = channelRef.current.presenceState();
              // Buscamos a nuestro chofer en especpifico iterando el state
              for (const key in newState) {
                  const presences = newState[key];
                  presences.forEach((presence: any) => {
                      if (presence.chofer_id === data.chofer.usuario_id) {
                          setLiveCoords({ lat: presence.lat, lng: presence.lng });
                      }
                  });
              }
            })
            .subscribe((status: string) => {
                console.log("Tracker Subscribe Status:", status);
            });
      }
      return () => {
          if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
          }
      }
  }, [data]);

  if (loading) {
      return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white text-center">
              <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
              <h1 className="text-xl font-bold">Cargando GPS del Vehículo...</h1>
          </div>
      );
  }

  if (errorMsg) {
       return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white text-center">
              <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/30 max-w-sm w-full">
                 <ShieldCheck className="text-red-500 mx-auto mb-4" size={48} />
                 <h1 className="text-xl font-bold mb-2">Seguimiento No Disponible</h1>
                 <p className="text-zinc-400 text-sm">{errorMsg}</p>
              </div>
          </div>
      );
  }

  const isFinalizado = data.estado === "finalizado";
  const isCancelado = data.estado === "cancelado";
  const isEnPuerta = data.estado === "en_puerta";

  if (isFinalizado) {
       return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white text-center">
              <div className="bg-green-500/10 p-6 rounded-2xl border border-green-500/30 max-w-sm w-full">
                 <CheckCircle2 className="text-green-500 mx-auto mb-4" size={64} />
                 <h1 className="text-2xl font-black text-green-400 mb-2">Viaje Finalizado</h1>
                 <p className="text-sm font-medium">Gracias por viajar con Viajes NEA.</p>
              </div>
          </div>
      );
  }

  if (isCancelado) {
       return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white text-center">
              <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/30 max-w-sm w-full">
                 <ShieldCheck className="text-red-500 mx-auto mb-4" size={64} />
                 <h1 className="text-2xl font-black text-red-500 mb-2">Viaje Cancelado</h1>
                 <p className="text-zinc-400 text-sm">Este viaje fue dado de baja o hubo un inconveniente. Solicita uno nuevo enviando un mensaje a nuestro WhatsApp.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-950 relative overflow-hidden font-sans text-white">
        
        {/* Cabecera / Status Móvil */}
        <div className="absolute top-0 w-full z-[400] p-4 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl pointer-events-auto">
                <div className="flex border-b border-white/5 pb-3 mb-3 items-center justify-between">
                    <div>
                        <h2 className="font-black text-lg tracking-tight">Viajes NEA</h2>
                        <p className="text-xs text-zinc-400">Seguridad en Viaje</p>
                    </div>
                </div>
                
                {isEnPuerta ? (
                    <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-3 rounded-xl flex items-center gap-3 animate-pulse">
                        <MapPin size={24} />
                        <div>
                            <p className="font-bold">¡Tu chofer llegó!</p>
                            <p className="text-xs">Identifícalo y acércate al auto.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-blue-600/20 text-blue-400 border border-blue-600/30 px-4 py-3 rounded-xl flex items-center gap-3">
                        <Navigation size={24} className="animate-bounce" />
                        <div>
                            <p className="font-bold">El chofer va en camino</p>
                            <p className="text-xs">Sigue su ubicación en el mapa.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 w-full relative z-0">
            {liveCoords ? (
                <MapContainer center={[liveCoords.lat, liveCoords.lng]} zoom={15} className="h-full w-full" zoomControl={false}>
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Marcador del Auto (Movimiento) */}
                    <Marker position={[liveCoords.lat, liveCoords.lng]} icon={carIcon}>
                        <Popup>
                           <div className="font-bold text-center text-zinc-900 leading-tight">
                              Mi Patente es<br/><span className="text-lg bg-yellow-200 px-1 py-0.5 mt-1 block uppercase rounded">{data.chofer?.patente}</span>
                           </div>
                        </Popup>
                    </Marker>
                    <RecenterMap lat={liveCoords.lat} lng={liveCoords.lng} />

                    {/* Marcador de Origen del Pasajero */}
                    {data.origen?.lat && (
                        <Marker position={[data.origen.lat, data.origen.lng]} icon={destIcon}>
                            <Popup>Punto de Encuentro</Popup>
                        </Marker>
                    )}
                </MapContainer>
            ) : (
                <div className="h-full w-full bg-zinc-900 flex items-center justify-center">
                    <p className="text-zinc-500 flex items-center gap-2"><Loader2 className="animate-spin" /> Conectando al satélite...</p>
                </div>
            )}
        </div>

        {/* Info Inferior Panel del Auto */}
        <div className="absolute bottom-0 w-full z-[400] p-4 pointer-events-none">
            <div className="bg-black/90 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto">
                <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-blue-950/50 rounded-full flex items-center justify-center text-blue-500 border border-blue-900">
                           <Car size={24} />
                        </div>
                        <div>
                            <p className="font-black text-lg text-white">{data.chofer?.nombre}</p>
                            <p className="text-sm text-zinc-400 capitalize">{data.chofer?.vehiculo}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase font-bold text-zinc-500 mb-1">Patente</p>
                        <p className="bg-white text-black font-black px-3 py-1 rounded shadow text-sm whitespace-nowrap uppercase">
                            {data.chofer?.patente}
                        </p>
                    </div>
                </div>

                <div className="mt-4 flex gap-4 text-sm text-zinc-400 p-2">
                    <Info size={16} className="text-blue-500 flex-shrink-0" />
                    <p>Por tu seguridad, este enlace es temporal y se destruirá automáticamente al completar el viaje.</p>
                </div>
            </div>
        </div>
        
    </div>
  );
}
