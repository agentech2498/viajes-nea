import axios from "axios";

// Instancia de API base apuntando a FastAPI
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
});

// Interceptor para inyectar token JWT de Supabase
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sb-access-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getChoferes = async () => {
    const res = await api.get("/admin/choferes");
    return res.data;
};

export const createChofer = async (choferData: { 
    nombre: string, 
    email: string, 
    telefono: string, 
    vehiculo: string, 
    patente: string,
    dni: string,
    tipo_pago: string,
    valor_pago: number
}) => {
    const res = await api.post("/admin/chofer", choferData);
    return res.data;
};

export const finalizarViaje = async (viajeId: string) => {
    const res = await api.post(`/chofer/viajes/${viajeId}/finalizar`);
    return res.data;
};

export const registrarPagoChofer = async (choferId: string, pagoData: { monto: number, tipo: string, descripcion: string }) => {
    const res = await api.post(`/admin/chofer/${choferId}/pago`, pagoData);
    return res.data;
};

export const updateChofer = async (choferId: string, data: any) => {
    const res = await api.put(`/admin/chofer/${choferId}`, data);
    return res.data;
};

export const deleteChofer = async (choferId: string) => {
    const res = await api.delete(`/admin/chofer/${choferId}`);
    return res.data;
};

export const notificarAceptacionViaje = async (viajeId: string) => {
    const res = await api.post(`/chofer/viajes/${viajeId}/notificar-aceptacion`);
    return res.data;
};

export const notificarFinalizacionViaje = async (viajeId: string) => {
    const res = await api.post(`/chofer/viajes/${viajeId}/notificar-finalizacion`);
    return res.data;
};

export const chatWithOpenAI = async (message: string) => {
    const res = await api.post("/ai/chat", null, { params: { user_message: message }});
    return res.data.response;
};

export const notificarLlegadaViaje = async (viajeId: string) => {
    const res = await api.post(`/chofer/viajes/${viajeId}/notificar-llegada`);
    return res.data;
};

export const cancelarViajeChofer = async (viajeId: string) => {
    const res = await api.post(`/chofer/viajes/${viajeId}/cancelar`);
    return res.data;
};

export const getViajeTrackingInfo = async (viajeId: string) => {
    // Endpoints públicos están bajo /public, así que este no usa auth
    const res = await api.get(`/public/viajes/${viajeId}/tracking`);
    return res.data;
};

export const notificarEmergencia = async (lat: number, lng: number) => {
    const res = await api.post("/chofer/sos", null, { params: { lat, lng } });
    return res.data;
};

// --- NUEVOS ENDPOINTS: TARIFAS ---
export const getActiveTariff = async () => {
    const res = await api.get("/tariffs/active");
    return res.data;
};

export const getTariffsHistory = async () => {
    const res = await api.get("/tariffs/");
    return res.data;
};

export const createTariff = async (data: { base_fare: number, per_fraction_price: number, fraction_km: number }) => {
    const res = await api.post("/tariffs/", data);
    return res.data;
};

// --- NUEVOS ENDPOINTS: RESERVAS ---
export const getReservations = async (estado?: string) => {
    const res = await api.get("/reservations/", { params: { estado } });
    return res.data;
};

export const updateReservationStatus = async (id: string, estado: string) => {
    const res = await api.put(`/reservations/${id}/estado`, { estado });
    return res.data;
};

// --- NUEVOS ENDPOINTS: DESTINOS FIJOS ---
export const getFixedDestinations = async () => {
    const res = await api.get("/tariffs/destinations");
    return res.data;
};

export const createFixedDestination = async (data: { name: string, price: number, details?: string, peaje?: boolean, column_index: number }) => {
    const res = await api.post("/tariffs/destinations", data);
    return res.data;
};

export const deleteFixedDestination = async (id: string) => {
    const res = await api.delete(`/tariffs/destinations/${id}`);
    return res.data;
};

