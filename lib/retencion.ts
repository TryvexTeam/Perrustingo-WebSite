/* Retención de fotos y salud del almacenamiento (PRP-002 F5).

   El PRP promete guardar la evidencia 12 meses. Una promesa así solo vale si
   alguien la cumple: sin limpieza, el plan gratuito de 1 GB se llena y la
   siguiente foto —la que sí hacía falta— no se sube. Y sin aviso, el equipo
   se entera el día que deja de funcionar.

   Cálculo puro: entra el inventario, sale qué borrar y qué avisar. Se puede
   verificar sin tocar Storage. */

/** Lo mínimo que hace falta saber de una foto para decidir si se va. */
export interface FotoInventario {
  id: string;
  /** ISO de cuándo se subió. */
  created_at: string | null;
  /** Ruta en el bucket. Sin ruta no se puede borrar el archivo. */
  ruta: string | null;
  url: string | null;
}

export interface PlanLimpieza {
  /** Filas de `fotos_sesion` que se eliminan. */
  ids: string[];
  /** Objetos del bucket que se eliminan. */
  rutas: string[];
  /** Filas viejas sin ruta utilizable: se avisan, no se borran a ciegas. */
  sinRuta: number;
}

/* Doce meses, la promesa del PRP. En meses y no en días porque así se
   explica y así se discute con el cliente. */
export const MESES_RETENCION = 12;

/** Corte: todo lo subido antes de esta fecha ya cumplió su plazo. */
export function fechaCorte(ahora: Date, meses = MESES_RETENCION): Date {
  const corte = new Date(ahora);
  corte.setMonth(corte.getMonth() - meses);
  return corte;
}

/** Qué borrar, dado el inventario y el momento actual.

    Una foto sin fecha NO se toca: no se puede afirmar que cumplió doce
    meses, y ante la duda la evidencia se queda. Borrar por si acaso es
    justo lo contrario de para qué existe. */
export function planDeLimpieza(
  fotos: FotoInventario[],
  ahora: Date,
  meses = MESES_RETENCION
): PlanLimpieza {
  const corte = fechaCorte(ahora, meses).getTime();
  const ids: string[] = [];
  const rutas: string[] = [];
  let sinRuta = 0;

  for (const foto of fotos) {
    if (!foto.created_at) continue;
    const subida = Date.parse(foto.created_at);
    if (isNaN(subida) || subida >= corte) continue;

    if (foto.ruta) {
      rutas.push(foto.ruta);
      ids.push(foto.id);
    } else {
      /* Vencida pero sin ruta: borrar la fila dejaría el archivo huérfano
         ocupando espacio para siempre, sin nadie que sepa que está. Se
         cuenta y se informa para que un humano lo mire. */
      sinRuta++;
    }
  }

  return { ids, rutas, sinRuta };
}

/* ── Aviso de espacio ───────────────────────────────────────── */

/** 1 GB: lo que da el plan gratuito de Supabase. */
export const CUPO_BYTES = 1024 * 1024 * 1024;

export type NivelEspacio = "ok" | "atencion" | "critico";

export interface EstadoEspacio {
  usadoBytes: number;
  porcentaje: number;
  nivel: NivelEspacio;
  mensaje: string | null;
}

/* Avisar al 75 % y no al 95 %: si el aviso llega cuando ya casi no queda
   espacio, no da tiempo de hacer nada y la primera señal real es una foto
   que no sube. */
const UMBRAL_ATENCION = 0.75;
const UMBRAL_CRITICO = 0.9;

function enMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Cómo está el almacenamiento y qué decirle al equipo. */
export function estadoEspacio(usadoBytes: number, cupo = CUPO_BYTES): EstadoEspacio {
  const porcentaje = cupo > 0 ? usadoBytes / cupo : 0;

  if (porcentaje >= UMBRAL_CRITICO) {
    return {
      usadoBytes,
      porcentaje,
      nivel: "critico",
      mensaje:
        `El almacenamiento de fotos está al ${Math.round(porcentaje * 100)} % ` +
        `(${enMB(usadoBytes)} de ${enMB(cupo)}). Cuando se llene, las fotos nuevas ` +
        `dejarán de subirse. Conviene ampliar el plan o correr la limpieza.`,
    };
  }

  if (porcentaje >= UMBRAL_ATENCION) {
    return {
      usadoBytes,
      porcentaje,
      nivel: "atencion",
      mensaje:
        `El almacenamiento de fotos va en ${Math.round(porcentaje * 100)} % ` +
        `(${enMB(usadoBytes)} de ${enMB(cupo)}). Todavía hay margen, pero conviene ` +
        `mirarlo este mes.`,
    };
  }

  return { usadoBytes, porcentaje, nivel: "ok", mensaje: null };
}
