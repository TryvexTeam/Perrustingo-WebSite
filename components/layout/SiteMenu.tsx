"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";
import { StaggeredMenu, type StaggeredMenuItem, type StaggeredMenuSocialItem } from "./StaggeredMenu";

/* El menú se adapta a quién está mirando (pedido del señor Ignacio, 27-jul).

   Antes listaba doce opciones fijas, entre ellas "Mi cuenta", "Iniciar
   sesión" y "Crear cuenta" — las tres a la vez y del mismo tamaño. A un
   cliente que ya entró se le ofrecía crear la cuenta que acaba de crear, y
   a uno que no tiene cuenta se le ofrecía "Mi cuenta". En un menú de
   pantalla completa, donde cada opción ocupa una línea enorme, eso no es un
   detalle: es la mitad de lo que se ve.

   Ahora las opciones de cuenta dependen de la sesión, y el equipo ve además
   su panel. La navegación del sitio no cambia: es el contenido del salón. */

const NAVEGACION: StaggeredMenuItem[] = [
  { label: "Inicio", ariaLabel: "Ir al inicio", link: "/#inicio" },
  { label: "Servicios", ariaLabel: "Ver nuestros servicios", link: "/#servicios" },
  { label: "Tarifas", ariaLabel: "Ver precios y tarifas", link: "/#precios" },
  { label: "Antes / Después", ariaLabel: "Ver transformaciones", link: "/#antes-despues" },
  { label: "Opiniones", ariaLabel: "Leer opiniones de clientes", link: "/#opiniones" },
  { label: "Próximamente", ariaLabel: "Ver lo que viene", link: "/#proximamente" },
  { label: "Visítanos", ariaLabel: "Cómo llegar y contacto", link: "/#visita" },
  { label: "Agenda tu cita", ariaLabel: "Agendar cita — formulario inteligente", link: "/reserva" },
  { label: "Calendario", ariaLabel: "Ver disponibilidad semanal", link: "/agenda" },
];

/* Mientras no se sabe si hay sesión no se muestra NINGUNA opción de cuenta.

   La alternativa —asumir "no hay sesión" y mostrar "Iniciar sesión"— hace
   que a quien sí entró le parpadee un botón de login por medio segundo cada
   vez que abre el menú. Es preferible que aparezcan un instante después a
   que aparezca lo que no corresponde. */
const SOCIALS: StaggeredMenuSocialItem[] = [
  { label: "Instagram", link: SITE.instagram },
  { label: "Facebook", link: SITE.facebook },
];

type Estado = "cargando" | "visitante" | "cliente" | "equipo";

export function SiteMenu() {
  const [estado, setEstado] = useState<Estado>("cargando");

  useEffect(() => {
    let vigente = true;
    const supabase = createClient();

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!vigente) return;
      if (!user) {
        setEstado("visitante");
        return;
      }

      const { data: perfil } = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .single();

      if (!vigente) return;
      setEstado(
        perfil?.rol === "admin" || perfil?.rol === "trabajador" ? "equipo" : "cliente"
      );
    })();

    return () => {
      // Evita escribir estado sobre un menú que ya se desmontó.
      vigente = false;
    };
  }, []);

  const items: StaggeredMenuItem[] = [...NAVEGACION];

  if (estado === "equipo") {
    items.push(
      { label: "Panel del equipo", ariaLabel: "Ir al panel del equipo", link: "/dashboard" },
      { label: "Mi cuenta", ariaLabel: "Ver mi perfil", link: "/perfil" }
    );
  } else if (estado === "cliente") {
    items.push({
      label: "Mi cuenta",
      ariaLabel: "Ver mi perfil y mis citas",
      link: "/perfil",
    });
  } else if (estado === "visitante") {
    items.push(
      { label: "Iniciar sesión", ariaLabel: "Entrar a tu cuenta", link: "/login" },
      { label: "Crear cuenta", ariaLabel: "Crear una cuenta gratis", link: "/registro" }
    );
  }

  return (
    <StaggeredMenu
      position="right"
      items={items}
      socialItems={SOCIALS}
      displaySocials
      displayItemNumbering
      logoUrl="/logo.jpeg"
      logoLabel="Perrustingo"
      colors={["#b6dfea", "#00c6c8"]}
      accentColor="#00a6a8"
      menuButtonColor="#063a40"
      openMenuButtonColor="#063a40"
    />
  );
}
