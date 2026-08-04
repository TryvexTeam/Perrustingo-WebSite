import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/* Rate limit compartido entre instancias (PRP-004 F1).

   El anterior era un `Map` en memoria del proceso. En Vercel cada petición
   puede caer en una instancia distinta, así que el límite real era
   "N × instancias" y se reiniciaba en cada despliegue: en la auditoría del
   26-jul, 8 reservas falsas entraron sin problema y con eso alcanza para
   llenar un día entero de agenda.

   Ahora el contador vive en Postgres (migración 016), que es el único lugar
   que todas las instancias comparten. */

/* eslint-disable @typescript-eslint/no-explicit-any -- el cliente llega
   genérico desde el servidor; acá solo se usa `.rpc()`. */
type Cliente = SupabaseClient<any, any, any>;

export interface Limite {
  /** Cuántas peticiones se permiten en la ventana. */
  max: number;
  /** Largo de la ventana, en segundos. */
  ventanaSeg: number;
}

/* Los límites son generosos con una persona y estrechos con un robot.

   El de IP es deliberadamente holgado: en Chile las operadoras móviles
   comparten una misma IP pública entre muchísimos clientes (CGNAT), y el
   wifi de un centro comercial o una oficina también. Un límite estrecho por
   IP frena a personas reales que no tienen nada que ver entre sí — y cada
   falso positivo es una reserva perdida.

   El que de verdad protege es el de teléfono, porque ata la reserva a una
   persona: 5 solicitudes en una hora ya es más de lo que hace cualquiera. */
export const LIMITE_RESERVA_IP: Limite = { max: 30, ventanaSeg: 10 * 60 };
export const LIMITE_RESERVA_TELEFONO: Limite = { max: 5, ventanaSeg: 60 * 60 };

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  /** Segundos hasta que se libere. */
  reiniciaEn: number;
}

/** Convierte lo que se limita (IP, teléfono) en una clave opaca.

    Dos motivos, los dos importan:
    1. **Privacidad**: la tabla de contadores no guarda IPs ni teléfonos en
       claro, así que no se convierte en un registro de quién visitó el
       sitio.
    2. **Que no se pueda quemar el límite ajeno**: la función es ejecutable
       con la clave pública (el endpoint corre con ella), así que cualquiera
       podría llamarla. Sin el secreto del servidor no puede *fabricar* la
       clave de otra persona, y quemarse el propio contador no le sirve de
       nada. */
function clave(tipo: string, valor: string): string {
  const secreto = process.env.RATE_LIMIT_SALT;
  if (!secreto) {
    // Sin secreto no hay protección real, y fingir que sí la hay es peor
    // que no tenerla: quien opere el sistema creería estar cubierto.
    throw new Error("RATE_LIMIT_SALT no está configurada");
  }
  return createHmac("sha256", secreto).update(`${tipo}:${valor}`).digest("hex");
}

/** ¿Se permite esta petición? Consume una unidad del contador.

    Ante un fallo de la base **se permite** la petición. Es deliberado: el
    rate limit protege de un abuso, no es el guardián del negocio. Si la
    base tiene un hipo, la peluquería debe poder seguir recibiendo
    reservas; el costo de un falso rechazo es un cliente perdido. */
export async function consumir(
  supabase: Cliente,
  tipo: string,
  valor: string,
  limite: Limite
): Promise<ResultadoLimite> {
  try {
    const { data, error } = await supabase.rpc("consumir_rate_limit", {
      p_clave: clave(tipo, valor),
      p_max: limite.max,
      p_ventana_seg: limite.ventanaSeg,
    });

    if (error) {
      console.warn("[rate-limit] no se pudo consultar:", error.message);
      return { permitido: true, restantes: limite.max, reiniciaEn: 0 };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila) return { permitido: true, restantes: limite.max, reiniciaEn: 0 };

    return {
      permitido: Boolean(fila.permitido),
      restantes: Number(fila.restantes ?? 0),
      reiniciaEn: Number(fila.reinicia_en ?? 0),
    };
  } catch (e) {
    console.warn("[rate-limit] error:", e);
    return { permitido: true, restantes: limite.max, reiniciaEn: 0 };
  }
}

/** IP de quien llama, según las cabeceras del proxy.

    Es un dato que el cliente puede falsear, así que NO se usa como
    identidad: es una señal barata para frenar el ruido, y va siempre
    acompañada de un límite por teléfono, que es lo que de verdad ata la
    reserva a una persona. */
export function ipDe(headers: Headers): string {
  const fw = headers.get("x-forwarded-for");
  if (fw) return fw.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "desconocida";
}

/** Cuántos segundos decirle al cliente que espere, en formato legible. */
export function textoEspera(segundos: number): string {
  if (segundos <= 60) return "un minuto";
  const minutos = Math.ceil(segundos / 60);
  return `${minutos} minutos`;
}
