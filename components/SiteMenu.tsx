import { BOOKING_URL, SITE } from "@/lib/site";
import { StaggeredMenu, type StaggeredMenuItem, type StaggeredMenuSocialItem } from "./StaggeredMenu";

const ITEMS: StaggeredMenuItem[] = [
  { label: "Inicio", ariaLabel: "Ir al inicio", link: "/#inicio" },
  { label: "Servicios", ariaLabel: "Ver nuestros servicios", link: "/#servicios" },
  { label: "Tarifas", ariaLabel: "Ver precios y tarifas", link: "/#precios" },
  { label: "Antes / Después", ariaLabel: "Ver transformaciones", link: "/#antes-despues" },
  { label: "Opiniones", ariaLabel: "Leer opiniones de clientes", link: "/#opiniones" },
  { label: "Próximamente", ariaLabel: "Ver lo que viene", link: "/#proximamente" },
  { label: "Visítanos", ariaLabel: "Cómo llegar y contacto", link: "/#visita" },
  { label: "Agenda tu cita", ariaLabel: "Agendar cita — formulario inteligente", link: "/reserva" },
  { label: "Mi cuenta", ariaLabel: "Ver mi perfil y mis citas", link: "/perfil" },
];

const SOCIALS: StaggeredMenuSocialItem[] = [
  { label: "Instagram", link: SITE.instagram },
  { label: "Facebook", link: SITE.facebook },
  { label: "WhatsApp", link: BOOKING_URL },
];

export function SiteMenu() {
  return (
    <StaggeredMenu
      position="right"
      items={ITEMS}
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
