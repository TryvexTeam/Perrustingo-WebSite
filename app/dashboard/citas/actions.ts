"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { offsetNegocio } from "@/lib/agenda";
import { eliminarEventoCita, upsertEventoCita } from "@/lib/google/calendar";
import { BUCKET_FOTOS, rutaDeFoto } from "@/lib/fotosComun";
import type { EstadoCita } from "@/lib/citas";
import {
  explicarAtraso,
  minutosDeAtraso,
  obtenerPolitica,
  recargoPorAtraso,
  type PoliticaCitas,
} from "@/lib/politica";

const TRANSICIONES_EQUIPO: Record<string, EstadoCita[]> = {
  pendiente: ["confirmada", "cancelada"],
  confirmada: ["en_proceso", "cancelada"],
  en_proceso: ["completada", "cancelada"],
};

interface ResultadoAccion {
  success: boolean;
  error?: string;
}

interface OpcionesHorario {
  /** yyyy-mm-ddThh:mm:ss en hora de Chile — al confirmar, fija la hora real de la cita. */
  fechaCita?: string;
  duracionHoras?: number;
}

/** Cambia el estado de una cita. Solo equipo (admin/trabajador); RLS refuerza. */
export async function cambiarEstadoCita(
  citaId: string,
  nuevoEstado: EstadoCita,
  horario?: OpcionesHorario
): Promise<ResultadoAccion> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { success: false, error: "Sin permisos." };
  }

  /* Esta lectura va por el cliente de servicio, no por la sesión de quien
     aprieta el botón.

     Desde la migración 027 el rol 'trabajador' ya no puede leer `sesiones`:
     con su sesión, esta consulta vuelve vacía y el panel respondía "Cita no
     encontrada" al confirmar. Y la vista `sesiones_equipo` tampoco sirve
     acá, porque le entrega el contacto en NULL y estos datos alimentan el
     evento de Google Calendar, que es del negocio y sí los lleva.

     No hay filtración: lo leído se usa para validar la transición y para
     armar el evento del calendario. Nada de esto vuelve al navegador — la
     acción solo devuelve `success` o un mensaje de error.

     El permiso ya se comprobó arriba: sin rol de equipo no se llega hasta
     acá. */
  const servicio = crearClienteServicio();
  const lector = servicio ?? supabase;
  const escritor = servicio ?? supabase;

  const { data: cita, error: errorLectura } = await lector
    .from("sesiones")
    .select("estado, fecha_cita, fecha_fin, servicio, contacto_nombre, contacto_telefono, contacto_email, detalle_form")
    .eq("id", citaId)
    .single();

  if (!cita) {
    /* El fallo era mudo: se descartaba el error de Postgres y se decía "no
       encontrada", que tapa causas muy distintas — id inexistente, permiso
       denegado o credencial de servidor ausente. Se registra para poder
       distinguirlas; fue lo que destapó que a `service_role` le faltaba el
       GRANT sobre `sesiones` (migración 028). */
    console.error("[cambiarEstadoCita] no se pudo leer la cita", {
      citaId,
      rol: perfil.rol,
      conClienteDeServicio: Boolean(servicio),
      codigo: errorLectura?.code ?? null,
      /* El `code` solo viene en errores de PostgREST. Una credencial inválida
         la rechaza el gateway antes, con un cuerpo que no trae `code` — y sin
         el mensaje el fallo se veía idéntico a "la fila no existe". */
      mensaje: errorLectura?.message ?? null,
    });
    return { success: false, error: "Cita no encontrada." };
  }

  const permitidas = TRANSICIONES_EQUIPO[cita.estado] ?? [];
  if (!permitidas.includes(nuevoEstado)) {
    return { success: false, error: `No se puede pasar de ${cita.estado} a ${nuevoEstado}.` };
  }

  const cambios: Record<string, unknown> = {
    estado: nuevoEstado,
    updated_at: new Date().toISOString(),
  };
  if (horario?.fechaCita) {
    // El panel envía hora de Chile sin offset; se ancla a la zona del negocio
    // para que el instante guardado sea correcto aunque el servidor corra en
    // UTC — y con el offset real de esa fecha (Chile cambia de hora dos veces
    // al año, así que "-04:00" fijo correría las citas del verano).
    const inicio = new Date(`${horario.fechaCita}${offsetNegocio(horario.fechaCita.slice(0, 10))}`);
    if (isNaN(inicio.getTime())) return { success: false, error: "Horario inválido." };
    cambios.fecha_cita = inicio.toISOString();
    const duracion = horario.duracionHoras ?? 1.5;
    cambios.fecha_fin = new Date(inicio.getTime() + duracion * 3_600_000).toISOString();
  }

  /* La escritura va por el mismo camino que la lectura, y por la misma
     razón (migración 029): para MODIFICAR una fila Postgres primero tiene
     que ENCONTRARLA, y esa búsqueda usa las políticas de lectura. Como el
     peluquero ya no puede leer `sesiones`, su UPDATE no encontraba nada y
     se ejecutaba sin error sobre cero filas — el panel decía "listo" y la
     cita quedaba igual.

     El control no se pierde: arriba se verificó el rol del equipo y que la
     transición de estado sea válida. */
  const { data: tocadas, error } = await escritor
    .from("sesiones")
    .update(cambios)
    .eq("id", citaId)
    /* `.select()` para saber si la fila se tocó de verdad. Un UPDATE que no
       afecta nada no falla, y sin esto volveríamos a prometer un cambio que
       no ocurrió — que fue justamente el síntoma reportado. */
    .select("id");

  if (error) return { success: false, error: "No se pudo actualizar." };

  if (!tocadas || tocadas.length === 0) {
    console.error("[cambiarEstadoCita] el UPDATE no toco ninguna fila", {
      citaId,
      rol: perfil.rol,
      estadoPrevio: cita.estado,
      estadoPedido: nuevoEstado,
      conClienteDeServicio: Boolean(servicio),
    });
    return {
      success: false,
      error: "La base de datos rechazó el cambio. Avise al equipo técnico.",
    };
  }

  /* Espejo en Google Calendar. El respaldo NUNCA bloquea al panel: la cita ya
     quedó guardada en la base, así que un fallo de Google se registra y se
     sigue. Si faltan las envs, las funciones son no-op silencioso.

     Desde la Fase 5 la cita ya nace con hora (el cliente elige un bloque), así
     que al confirmar sin pasar `horario` se usa la que ya tenía — antes, sin
     `cambios.fecha_cita`, no se espejaba nada. */
  try {
    if (nuevoEstado === "cancelada") {
      await eliminarEventoCita(citaId);
    } else if (nuevoEstado === "confirmada") {
      const inicioISO = (cambios.fecha_cita as string | undefined) ?? cita.fecha_cita ?? null;
      const finISO =
        (cambios.fecha_fin as string | undefined) ??
        cita.fecha_fin ??
        (inicioISO ? new Date(new Date(inicioISO).getTime() + 1.5 * 3_600_000).toISOString() : null);

      if (inicioISO && finISO) {
        const detalle = cita.detalle_form as Record<string, string> | null;
        const perro = detalle?.nombrePerro ?? detalle?.Nombre ?? cita.contacto_nombre ?? "Cita";
        await upsertEventoCita({
          citaId,
          titulo: `🐾 ${perro} — ${cita.servicio ?? "Perrustingo"}`,
          descripcion: [
            cita.contacto_nombre && `Contacto: ${cita.contacto_nombre}`,
            cita.contacto_telefono && `Teléfono: ${cita.contacto_telefono}`,
            cita.contacto_email && `Email: ${cita.contacto_email}`,
            "Origen: plataforma Perrustingo",
          ]
            .filter(Boolean)
            .join("\n"),
          inicioISO,
          finISO,
        });
      }
    }
  } catch (e) {
    console.warn("[google-calendar] respaldo falló:", e);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/citas");
  revalidatePath("/agenda");
  return { success: true };
}

/** Notas del peluquero sobre la cita (pedido de Rodolfo 19-jul): detalles
    del servicio y tips entre colegas — se ven en la próxima visita. */
export async function guardarNotasEquipo(
  citaId: string,
  notas: string
): Promise<ResultadoAccion> {
  if (notas.length > 2000) return { success: false, error: "Nota demasiado larga." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { success: false, error: "Sin permisos." };
  }

  /* Mismo caso que `cambiarEstadoCita`: sin lectura sobre `sesiones`, el
     UPDATE del peluquero no encuentra la fila y se pierde en silencio.
     La nota se guardaría "con éxito" y no quedaría escrita. */
  const { data: tocadas, error } = await (crearClienteServicio() ?? supabase)
    .from("sesiones")
    .update({ notas_equipo: notas.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", citaId)
    .select("id");

  if (error) return { success: false, error: "No se pudo guardar la nota." };
  if (!tocadas || tocadas.length === 0) {
    return { success: false, error: "La base de datos rechazó el cambio. Avise al equipo técnico." };
  }

  revalidatePath("/dashboard/citas");
  return { success: true };
}

/* ── Llegada del cliente y recargo por atraso (migración 035) ───────────────

   POR QUÉ EXISTE ESTO: sin la hora de llegada real, los minutos de atraso no
   salen de ninguna parte y el recargo es incalculable. La cita agendada dice a
   qué hora se esperaba a alguien; solo el equipo sabe a qué hora apareció.

   EL SISTEMA PROPONE, EL EQUIPO CONFIRMA (decidido por el dueño el 4-ago).
   Marcar la llegada calcula el monto y lo deja en `recargo_aceptado = NULL`:
   sin decidir. Cobrar y perdonar son dos acciones separadas y explícitas.
   Nunca se cobra solo — hay que dejar margen para el cliente de siempre y para
   el taco de verdad.

   Todo lo que es plata sale de `lib/politica.ts`. Acá no se recalcula nada: si
   la política está apagada, `recargoPorAtraso` devuelve 0 y ese cero se
   respeta tal cual. */

/** Estado del atraso de una cita, tal como se lo muestra el panel al equipo. */
export interface EstadoAtraso {
  /** ISO de la llegada real, o null si todavía nadie la marcó. */
  llegadaEn: string | null;
  /** Minutos de atraso, 0 si llegó puntual o antes. */
  minutosAtraso: number;
  /** Lo que el sistema PROPONE cobrar. 0 con la política apagada. */
  recargo: number;
  /** NULL = sin decidir · true = se cobra · false = se perdonó. */
  aceptado: boolean | null;
  /** La frase ya redactada por el dominio, para no armarla en dos lugares. */
  explicacion: string;
  /** Si la política está encendida. Apagada, el panel no ofrece cobrar nada. */
  politicaActiva: boolean;
}

interface ResultadoAtraso extends ResultadoAccion {
  estado?: EstadoAtraso;
}

/** Guard de equipo idéntico al de `cambiarEstadoCita`: admin o trabajador.
    Quien atiende en el mesón es quien ve llegar al cliente. */
async function exigirEquipo(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>> } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { error: "Sin permisos." };
  }
  return { supabase };
}

/** Arma el estado a partir de la fila y la política vigente. */
function estadoDesdeFila(
  fila: {
    fecha_cita: string | null;
    llegada_en: string | null;
    recargo_atraso: number | null;
    recargo_aceptado: boolean | null;
  },
  politica: PoliticaCitas
): EstadoAtraso {
  const minutos =
    fila.llegada_en && fila.fecha_cita
      ? minutosDeAtraso(fila.fecha_cita, fila.llegada_en)
      : 0;
  return {
    llegadaEn: fila.llegada_en,
    minutosAtraso: minutos,
    /* El monto guardado manda sobre el recalculado: es el que se le mostró a
       la persona cuando se marcó la llegada. Cambiar la tasa después no puede
       reescribir lo que ya se acordó en el mesón. */
    recargo: fila.recargo_atraso ?? 0,
    aceptado: fila.recargo_aceptado,
    explicacion: fila.llegada_en
      ? explicarAtraso(minutos, politica)
      : "Todavía no se marca la llegada.",
    politicaActiva: politica.activa,
  };
}

/** Lee el estado del atraso de una cita.
 *
 *  Va por el servidor y no por el navegador porque la vista `sesiones_equipo`
 *  (migración 030) tiene una lista fija de columnas y no incluye `llegada_en`
 *  ni los recargos: desde el cliente esos campos no existen. */
export async function estadoAtrasoAction(citaId: string): Promise<ResultadoAtraso> {
  const sesion = await exigirEquipo();
  if ("error" in sesion) return { success: false, error: sesion.error };

  /* Mismo camino que `cambiarEstadoCita`: desde la migración 027 el rol
     'trabajador' no puede leer `sesiones` con su propia sesión. */
  const lector = crearClienteServicio() ?? sesion.supabase;

  const { data: cita, error } = await lector
    .from("sesiones")
    .select("fecha_cita, llegada_en, recargo_atraso, recargo_aceptado")
    .eq("id", citaId)
    .single();

  if (error || !cita) {
    if (error?.code === "42703") {
      return { success: false, error: "Falta aplicar la migración 035 en la base de datos." };
    }
    return { success: false, error: "Cita no encontrada." };
  }

  const politica = await obtenerPolitica(lector);
  return { success: true, estado: estadoDesdeFila(cita, politica) };
}

/**
 * Marca que el cliente llegó, ahora.
 *
 * Calcula los minutos de atraso contra la hora agendada y guarda el recargo
 * PROPUESTO, dejando `recargo_aceptado` en NULL. No cobra: deja la decisión
 * escrita para que alguien la tome mirando al cliente.
 */
export async function marcarLlegadaAction(citaId: string): Promise<ResultadoAtraso> {
  const sesion = await exigirEquipo();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const servicio = crearClienteServicio();
  const lector = servicio ?? sesion.supabase;
  const escritor = servicio ?? sesion.supabase;

  const { data: cita, error: errorLectura } = await lector
    .from("sesiones")
    .select("fecha_cita, llegada_en, recargo_atraso, recargo_aceptado")
    .eq("id", citaId)
    .single();

  if (errorLectura || !cita) {
    if (errorLectura?.code === "42703") {
      return { success: false, error: "Falta aplicar la migración 035 en la base de datos." };
    }
    console.error("[marcarLlegada] no se pudo leer la cita", {
      citaId,
      codigo: errorLectura?.code ?? null,
      mensaje: errorLectura?.message ?? null,
    });
    return { success: false, error: "Cita no encontrada." };
  }

  /* La llegada se marca UNA vez. Volver a apretar el botón media hora después
     correría la hora y subiría el recargo de alguien que ya está adentro. */
  if (cita.llegada_en) {
    const politica = await obtenerPolitica(lector);
    return {
      success: false,
      error: "La llegada ya estaba marcada.",
      estado: estadoDesdeFila(cita, politica),
    };
  }
  if (!cita.fecha_cita) {
    return {
      success: false,
      error: "La cita no tiene hora agendada, así que no hay contra qué medir el atraso.",
    };
  }

  const politica = await obtenerPolitica(lector);
  const llegada = new Date();
  const minutos = minutosDeAtraso(cita.fecha_cita, llegada);
  const recargo = recargoPorAtraso(minutos, politica);

  const { data: tocadas, error } = await escritor
    .from("sesiones")
    .update({
      llegada_en: llegada.toISOString(),
      recargo_atraso: recargo,
      // NULL a propósito: propuesto, sin decidir.
      recargo_aceptado: null,
      updated_at: llegada.toISOString(),
    })
    .eq("id", citaId)
    .select("id");

  if (error) return { success: false, error: "No se pudo marcar la llegada." };
  if (!tocadas || tocadas.length === 0) {
    console.error("[marcarLlegada] el UPDATE no toco ninguna fila", { citaId });
    return {
      success: false,
      error: "La base de datos rechazó el cambio. Avise al equipo técnico.",
    };
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/hoy");
  return {
    success: true,
    estado: estadoDesdeFila(
      {
        fecha_cita: cita.fecha_cita,
        llegada_en: llegada.toISOString(),
        recargo_atraso: recargo,
        recargo_aceptado: null,
      },
      politica
    ),
  };
}

/**
 * Confirma o perdona el recargo propuesto.
 *
 * `cobrar = true` deja registrado que se cobra; `false`, que se perdonó. Las
 * dos son decisiones válidas y las dos quedan escritas: un recargo perdonado
 * en silencio se vuelve a discutir en la visita siguiente.
 *
 * Perdonar deja el monto en 0. Cobrar conserva el que se propuso — el que la
 * persona vio en pantalla cuando decidió.
 */
export async function resolverRecargoAction(
  citaId: string,
  cobrar: boolean
): Promise<ResultadoAtraso> {
  const sesion = await exigirEquipo();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const servicio = crearClienteServicio();
  const lector = servicio ?? sesion.supabase;
  const escritor = servicio ?? sesion.supabase;

  const { data: cita, error: errorLectura } = await lector
    .from("sesiones")
    .select("fecha_cita, llegada_en, recargo_atraso, recargo_aceptado")
    .eq("id", citaId)
    .single();

  if (errorLectura || !cita) {
    if (errorLectura?.code === "42703") {
      return { success: false, error: "Falta aplicar la migración 035 en la base de datos." };
    }
    return { success: false, error: "Cita no encontrada." };
  }
  if (!cita.llegada_en) {
    return { success: false, error: "Primero marque la llegada del cliente." };
  }

  const politica = await obtenerPolitica(lector);

  /* Con la política apagada no hay monto que cobrar: el dominio ya devuelve 0
     y acá no se lo esquiva inventando uno. */
  if (cobrar && !politica.activa) {
    return {
      success: false,
      error: "La política está apagada: no hay recargo que cobrar.",
    };
  }

  const recargo = cobrar ? (cita.recargo_atraso ?? 0) : 0;

  const { data: tocadas, error } = await escritor
    .from("sesiones")
    .update({
      recargo_aceptado: cobrar,
      recargo_atraso: recargo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", citaId)
    .select("id");

  if (error) return { success: false, error: "No se pudo guardar la decisión." };
  if (!tocadas || tocadas.length === 0) {
    console.error("[resolverRecargo] el UPDATE no toco ninguna fila", { citaId });
    return {
      success: false,
      error: "La base de datos rechazó el cambio. Avise al equipo técnico.",
    };
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/hoy");
  return {
    success: true,
    estado: estadoDesdeFila(
      { ...cita, recargo_atraso: recargo, recargo_aceptado: cobrar },
      politica
    ),
  };
}

/* ── Cierre de la cita: lo que se cobró y quién la atiende ─────────────────

   DOS AGUJEROS QUE ESTA SECCIÓN TAPA.

   1) `precio_final` se leía en el dashboard, en las analíticas, en la jornada
      y en el perfil del cliente — y NO SE ESCRIBÍA EN NINGUNA PARTE. Los
      ingresos se estaban calculando sobre `precio_base`, que es el estimado
      que armó el navegador antes de ver al perro. Faltaba el lugar donde el
      equipo anota lo que de verdad entró por la puerta.

   2) `sesiones.peluquero_id` existe desde la migración 035 y nadie la
      escribía: ninguna cita tenía dueño. El admin asigna (decidido por el
      dueño el 4-ago); el trabajador ve a quién le tocó y no lo cambia.

   EL SISTEMA PROPONE, LA PERSONA DECIDE — misma regla que el recargo por
   atraso. Acá se sugiere `estimado + recargo aceptado`, pero el monto que se
   guarda es siempre el que alguien escribió y confirmó. Nada se fija solo.

   El estimado NO se pisa: `precio_base` queda intacto. Son dos datos
   distintos —lo que se prometió y lo que se cobró— y la diferencia entre los
   dos es justamente lo que el dueño quiere poder mirar.

   Todo esto viaja por server action y no como prop del panel porque la vista
   `sesiones_equipo` (migración 030) tiene lista fija de columnas y no incluye
   `peluquero_id`: desde el navegador del equipo ese campo no existe. Mismo
   camino que ya toma el estado del atraso. */

/** Un peluquero al que se le puede asignar una cita. */
export interface PeluqueroAsignable {
  id: string;
  nombre: string;
}

/** Lo que el panel necesita para cerrar la cita: plata y responsable. */
export interface EstadoCierre {
  /** `precio_base`: lo que se estimó al reservar. Nunca se sobrescribe. */
  precioEstimado: number | null;
  /** `precio_final`: lo que de verdad se cobró. NULL = todavía sin registrar. */
  precioCobrado: number | null;
  /** Lo que el sistema SUGIERE (estimado + recargo aceptado). No se guarda
      solo: es un número para que alguien lo mire y lo confirme o lo cambie. */
  sugerido: number | null;
  /** Recargo por atraso ya aceptado; 0 si se perdonó o no hubo. */
  recargoCobrado: number;
  peluqueroId: string | null;
  peluqueroNombre: string | null;
  /** Solo el admin asigna (decisión del dueño, 4-ago). */
  puedeAsignar: boolean;
  /** Vacía para quien no puede asignar: no se manda lo que no se usa. */
  peluqueros: PeluqueroAsignable[];
}

interface ResultadoCierre extends ResultadoAccion {
  estado?: EstadoCierre;
}

/* Tope de cordura para el monto cobrado. No es una regla de negocio: es el
   ataja-dedos del que escribe 380000 donde iba 38000 y lo manda a las
   analíticas de ingresos del mes. */
const MAXIMO_COBRADO = 2_000_000;

/** Mismo guard de equipo que `exigirEquipo`, pero además devuelve el rol:
    registrar el cobro lo hace cualquiera del equipo —es quien está en el
    mesón— y asignar la cita solo el admin. Sin el rol acá arriba habría que
    volver a preguntarlo abajo. */
async function exigirEquipoConRol(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>>; rol: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión expirada." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!perfil || !["admin", "trabajador"].includes(perfil.rol)) {
    return { error: "Sin permisos." };
  }
  return { supabase, rol: perfil.rol as string };
}

/** Traduce el error de Postgres. El 42501 se nombra con todas sus letras:
    en este proyecto una policy sobre una tabla sin GRANT ya se disfrazó tres
    veces de "no se pudo guardar" y costó horas cada vez. */
function explicarFalloEscritura(code: string | undefined, porDefecto: string): string {
  if (code === "42501") {
    return "La base de datos rechazó el cambio por permisos (42501): falta el GRANT sobre `sesiones`. Avise al equipo técnico.";
  }
  if (code === "42703") {
    return "Falta aplicar la migración 035 en la base de datos.";
  }
  if (code === "23503") {
    return "Esa persona ya no existe en el sistema. Actualice la página.";
  }
  return porDefecto;
}

/** Nombre presentable de un perfil, con el mismo criterio que el resto del panel. */
function nombreDePerfil(fila: { nombre: string | null; apellido: string | null }): string {
  return [fila.nombre, fila.apellido].filter(Boolean).join(" ").trim() || "Sin nombre";
}

/* DOS CLIENTES, A PROPÓSITO, Y NO ES UN DESCUIDO.

   · `sesiones` se lee con el cliente de SERVICIO, igual que el resto de este
     archivo: desde la migración 027 el rol 'trabajador' no puede leer la
     tabla con su propia sesión, y su UPDATE tampoco encuentra la fila.
     `service_role` tiene el GRANT desde la 028/029.

   · `perfiles` se lee con la sesión de QUIEN MIRA, no con la de servicio.
     `perfiles` nunca recibió GRANT para `service_role` (schema.sql lo otorgó
     a anon/authenticated, y la 008 lo repitió solo para authenticated): con
     el cliente de servicio esta lectura moriría con 42501 y la lista de
     peluqueros llegaría vacía sin decir por qué. Con la sesión funciona y
     además el recorte lo pone la base: la policy `admin_ve_todos_perfiles`
     deja al admin ver a todos, y `perfil_lee_propio` deja al trabajador ver
     el suyo — que es el único que puede tener asignado, porque la vista de
     la 038 solo le muestra sus citas y las sin asignar. */
type ClienteSupabase =
  | NonNullable<ReturnType<typeof crearClienteServicio>>
  | Awaited<ReturnType<typeof createClient>>;

async function leerCierre(
  lectorSesiones: ClienteSupabase,
  lectorPerfiles: Awaited<ReturnType<typeof createClient>>,
  citaId: string,
  puedeAsignar: boolean
): Promise<ResultadoCierre> {
  const { data: cita, error } = await lectorSesiones
    .from("sesiones")
    .select("precio_base, precio_final, peluquero_id, recargo_atraso, recargo_aceptado")
    .eq("id", citaId)
    .single();

  if (error || !cita) {
    if (error?.code === "42703") {
      return { success: false, error: "Falta aplicar la migración 035 en la base de datos." };
    }
    return { success: false, error: "Cita no encontrada." };
  }

  /* La lista solo se arma para quien puede usarla. Al trabajador se le manda
     vacía: no es un secreto, pero mandar opciones que no puede elegir invita
     a dibujar un selector que después la base rechaza. */
  let peluqueros: PeluqueroAsignable[] = [];
  if (puedeAsignar) {
    const { data: filas, error: errorLista } = await lectorPerfiles
      .from("perfiles")
      .select("id, nombre, apellido")
      .eq("es_peluquero", true)
      .order("nombre");
    /* Un fallo acá NO se traga: sin lista, el admin ve un selector vacío y
       concluye que no hay peluqueros marcados, que es exactamente la
       conclusión falsa que un 42501 mudo produce. */
    if (errorLista) {
      return {
        success: false,
        error: explicarFalloEscritura(
          errorLista.code,
          "No se pudo leer la lista de peluqueros."
        ),
      };
    }
    peluqueros = (filas ?? []).map((p) => ({
      id: p.id as string,
      nombre: nombreDePerfil(p),
    }));
  }

  let peluqueroNombre: string | null = null;
  if (cita.peluquero_id) {
    const yaEnLista = peluqueros.find((p) => p.id === cita.peluquero_id);
    if (yaEnLista) {
      peluqueroNombre = yaEnLista.nombre;
    } else {
      /* Puede no estar en la lista: o quien mira es trabajador (lista vacía),
         o al asignado le quitaron la marca de peluquero después. En los dos
         casos el nombre sigue siendo el dato que importa mostrar.
         Si la policy no deja leer ese perfil, queda en null y el panel dice
         "Sin asignar por nombre" — no se inventa uno. */
      const { data: fila } = await lectorPerfiles
        .from("perfiles")
        .select("nombre, apellido")
        .eq("id", cita.peluquero_id)
        .single();
      peluqueroNombre = fila ? nombreDePerfil(fila) : null;
    }
  }

  const recargoCobrado = cita.recargo_aceptado === true ? (cita.recargo_atraso ?? 0) : 0;
  const estimado = cita.precio_base ?? null;

  return {
    success: true,
    estado: {
      precioEstimado: estimado,
      precioCobrado: cita.precio_final ?? null,
      sugerido: estimado === null ? null : estimado + recargoCobrado,
      recargoCobrado,
      peluqueroId: cita.peluquero_id ?? null,
      peluqueroNombre,
      puedeAsignar,
      peluqueros,
    },
  };
}

/** Lee el cierre de una cita: precios, recargo aceptado y quién la atiende. */
export async function estadoCierreAction(citaId: string): Promise<ResultadoCierre> {
  const sesion = await exigirEquipoConRol();
  if ("error" in sesion) return { success: false, error: sesion.error };

  const lector = crearClienteServicio() ?? sesion.supabase;
  return leerCierre(lector, sesion.supabase, citaId, sesion.rol === "admin");
}

/**
 * Registra lo que de verdad se cobró.
 *
 * Escribe `precio_final` y NO toca `precio_base`: el estimado que se le
 * mostró al cliente al reservar tiene que seguir ahí para poder comparar.
 *
 * El monto llega escrito por una persona. Acá no se calcula ninguno: la
 * sugerencia se arma para mirarla, no para guardarla sola.
 *
 * Lo puede hacer cualquiera del equipo — quien cobra en la puerta es quien
 * está atendiendo, no necesariamente el admin.
 */
export async function registrarPrecioCobradoAction(
  citaId: string,
  monto: number
): Promise<ResultadoCierre> {
  const sesion = await exigirEquipoConRol();
  if ("error" in sesion) return { success: false, error: sesion.error };

  if (!Number.isFinite(monto) || !Number.isInteger(monto)) {
    return { success: false, error: "El monto tiene que ser un número entero de pesos, sin decimales." };
  }
  if (monto < 0) {
    return { success: false, error: "El monto no puede ser negativo." };
  }
  if (monto > MAXIMO_COBRADO) {
    return {
      success: false,
      error: `${monto.toLocaleString("es-CL")} parece un error de tipeo (el máximo es ${MAXIMO_COBRADO.toLocaleString("es-CL")}). Revise la cifra.`,
    };
  }

  const escritor = crearClienteServicio() ?? sesion.supabase;

  const { data: tocadas, error } = await escritor
    .from("sesiones")
    .update({ precio_final: monto, updated_at: new Date().toISOString() })
    .eq("id", citaId)
    /* `.select()` y contar filas, no confiar en la ausencia de error: con RLS
       un UPDATE que no encuentra la fila termina "bien" sobre cero filas y
       prometería un cobro que no quedó escrito. */
    .select("id");

  if (error) {
    return {
      success: false,
      error: explicarFalloEscritura(error.code, "No se pudo guardar el monto cobrado."),
    };
  }
  if (!tocadas || tocadas.length === 0) {
    console.error("[registrarPrecioCobrado] el UPDATE no toco ninguna fila", {
      citaId,
      rol: sesion.rol,
      conClienteDeServicio: Boolean(crearClienteServicio()),
    });
    return {
      success: false,
      error: "La base de datos rechazó el cambio y no se guardó nada. Avise al equipo técnico.",
    };
  }

  /* Estas cuatro pantallas leen `precio_final`; sin revalidar seguirían
     mostrando el ingreso viejo hasta el próximo refresco. */
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/hoy");
  revalidatePath("/perfil");

  return leerCierre(escritor, sesion.supabase, citaId, sesion.rol === "admin");
}

/**
 * Asigna la cita a un peluquero, o la deja sin asignar con `null`.
 *
 * SOLO ADMIN, con el mismo criterio exacto que `exigirAdmin` en
 * `app/dashboard/disponibilidad/actions.ts`: `perfil.rol !== 'admin'` → sin
 * permisos. Un trabajador ve a quién le tocó; repartir el día es del admin
 * (decidido por el dueño el 4-ago).
 */
export async function asignarPeluqueroAction(
  citaId: string,
  peluqueroId: string | null
): Promise<ResultadoCierre> {
  const sesion = await exigirEquipoConRol();
  if ("error" in sesion) return { success: false, error: sesion.error };
  if (sesion.rol !== "admin") {
    return { success: false, error: "Solo un administrador puede asignar la cita." };
  }

  const escritor = crearClienteServicio() ?? sesion.supabase;

  /* Se comprueba que sea peluquero ANTES de escribir. La FK solo garantiza
     que el perfil existe: sin esta comprobación se podría asignar una cita a
     un cliente cualquiera y la agenda de la persona quedaría con trabajo que
     no le corresponde. */
  if (peluqueroId) {
    /* Con la sesión del admin, no con la de servicio: `perfiles` no tiene
       GRANT para `service_role` (ver la nota de `leerCierre`), y la policy
       `admin_ve_todos_perfiles` ya le deja ver a todos. */
    const { data: perfil, error: errorPerfil } = await sesion.supabase
      .from("perfiles")
      .select("id, es_peluquero")
      .eq("id", peluqueroId)
      .single();
    if (errorPerfil || !perfil) {
      return {
        success: false,
        error:
          errorPerfil?.code === "42501"
            ? "La base de datos rechazó la lectura de perfiles por permisos (42501). Avise al equipo técnico."
            : "No se encontró a esa persona. Actualice la página.",
      };
    }
    if (!perfil.es_peluquero) {
      return {
        success: false,
        error: "Esa persona no está marcada como peluquero. Márquela en Usuarios y vuelva a intentarlo.",
      };
    }
  }

  const { data: tocadas, error } = await escritor
    .from("sesiones")
    .update({ peluquero_id: peluqueroId, updated_at: new Date().toISOString() })
    .eq("id", citaId)
    .select("id");

  if (error) {
    return {
      success: false,
      error: explicarFalloEscritura(error.code, "No se pudo asignar la cita."),
    };
  }
  if (!tocadas || tocadas.length === 0) {
    console.error("[asignarPeluquero] el UPDATE no toco ninguna fila", {
      citaId,
      conClienteDeServicio: Boolean(crearClienteServicio()),
    });
    return {
      success: false,
      error: "La base de datos rechazó el cambio y no se guardó nada. Avise al equipo técnico.",
    };
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard/hoy");
  revalidatePath("/agenda");

  return leerCierre(escritor, sesion.supabase, citaId, true);
}

/* ── Borrado de citas (pedido del señor Adley, 30-jul) ──────────

   Hasta hoy las citas nunca se borraban — solo cambiaban de estado. Eso
   protege el historial, pero dejó las citas de prueba del equipo mezcladas
   con las reales, sin forma de limpiarlas desde el panel. */

interface ResultadoBorrado {
  success: boolean;
  /** Cuántas se borraron de verdad (no cuántas se pidieron). */
  eliminadas: number;
  error?: string;
}

const MAXIMO_BORRADO_POR_TANDA = 50;

/** Borra citas definitivamente. Solo admin, y SOLO canceladas o completadas:
    una pendiente o confirmada es una promesa activa con un cliente — para
    borrarla primero hay que cancelarla, mirándola, una por una. Ese paso
    extra es el candado contra borrar una solicitud real por accidente. */
export async function eliminarCitasEnBloque(citaIds: string[]): Promise<ResultadoBorrado> {
  if (citaIds.length === 0) {
    return { success: false, eliminadas: 0, error: "No seleccionó ninguna cita." };
  }
  if (citaIds.length > MAXIMO_BORRADO_POR_TANDA) {
    return {
      success: false,
      eliminadas: 0,
      error: `Son demasiadas de una vez (máximo ${MAXIMO_BORRADO_POR_TANDA}). Hágalo por tandas.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, eliminadas: 0, error: "Sesión expirada." };

  /* Solo admin, ni siquiera trabajador: borrar es un grado más que cancelar,
     y la política `admin_maneja_sesiones` (FOR ALL) es la que respalda este
     DELETE en la base. */
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "admin") {
    return { success: false, eliminadas: 0, error: "Solo un administrador puede borrar citas." };
  }

  /* Las rutas de las fotos se leen ANTES de borrar: el CASCADE va a
     llevarse las filas de `fotos_sesion`, y sin esta lectura previa los
     archivos quedarían huérfanos en Storage para siempre. Se usa el cliente
     de servicio porque es quien puede tocar el bucket privado. */
  const servicio = crearClienteServicio();
  let fotosPorCita: { sesion_id: string; ruta: string | null; url: string | null }[] = [];
  if (servicio) {
    const { data } = await servicio
      .from("fotos_sesion")
      .select("sesion_id, ruta, url")
      .in("sesion_id", citaIds);
    fotosPorCita = data ?? [];
  }

  const { data: borradas, error } = await supabase
    .from("sesiones")
    .delete()
    .in("id", citaIds)
    .in("estado", ["cancelada", "completada"])
    .select("id");

  if (error) {
    return { success: false, eliminadas: 0, error: "No se pudo borrar." };
  }

  const eliminadas = borradas?.length ?? 0;
  const idsBorrados = new Set((borradas ?? []).map((f) => f.id));

  /* Limpieza que NUNCA bloquea: las filas ya no existen, así que un fallo
     acá se registra y se sigue — igual que el espejo del calendario. */
  if (servicio) {
    const rutas = fotosPorCita
      .filter((f) => idsBorrados.has(f.sesion_id))
      .map((f) => rutaDeFoto(f))
      .filter((r): r is string => Boolean(r));
    if (rutas.length > 0) {
      const { error: errorStorage } = await servicio.storage.from(BUCKET_FOTOS).remove(rutas);
      if (errorStorage) {
        console.warn("[eliminarCitas] fotos sin borrar en Storage:", errorStorage.message);
      }
    }
  }
  for (const fila of borradas ?? []) {
    try {
      await eliminarEventoCita(fila.id);
    } catch (e) {
      console.warn("[google-calendar] no se pudo borrar el evento:", e);
    }
  }

  revalidatePath("/dashboard/citas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/hoy");
  revalidatePath("/agenda");

  if (eliminadas < citaIds.length) {
    return {
      success: true,
      eliminadas,
      error: `Se borraron ${eliminadas} de ${citaIds.length}. Las otras siguen activas (pendiente o confirmada): cancélelas primero.`,
    };
  }
  return { success: true, eliminadas };
}
