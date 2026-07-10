import { AntesDespues } from "@/components/landing/AntesDespues";
import { Advertencias } from "@/components/landing/Advertencias";
import { Banner } from "@/components/landing/Banner";
import { Beneficios } from "@/components/landing/Beneficios";
import { ComoTrabajamos } from "@/components/landing/ComoTrabajamos";
import { BotonWhatsApp } from "@/components/layout/BotonWhatsApp";
import { Footer } from "@/components/layout/Footer";
import { EnVivoLanding } from "@/components/landing/EnVivoLanding";
import { Hero } from "@/components/landing/Hero";
import { HeroParallax } from "@/components/landing/HeroParallax";
import { HuellitasScroll } from "@/components/landing/HuellitasScroll";
import { LoaderHuellita } from "@/components/layout/LoaderHuellita";
import { TiltCards } from "@/components/landing/TiltCards";
import { InfoInteres } from "@/components/landing/InfoInteres";
import { Precios } from "@/components/landing/Precios";
import { PromoBanner } from "@/components/landing/PromoBanner";
import { Publicidad } from "@/components/landing/Publicidad";
import { QuickAccess } from "@/components/landing/QuickAccess";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { FAQ } from "@/components/landing/FAQ";
import { Resenas } from "@/components/landing/Resenas";
import { Servicios } from "@/components/landing/Servicios";
import { Tamanos } from "@/components/landing/Tamanos";

export default function Home() {
  return (
    <>
      <SiteMenu />
      <QuickAccess />
      <LoaderHuellita />
      <HuellitasScroll />
      <TiltCards />
      <HeroParallax />
      <BotonWhatsApp />
      <main className="flex-1">
        <Hero />
        <Servicios />
        <EnVivoLanding />
        <PromoBanner slot="tras-servicios" id="proximamente" />
        <AntesDespues />
        <Banner />
        <ComoTrabajamos />
        <Resenas />
        <PromoBanner slot="tras-resenas" />
        <Advertencias />
        <Tamanos />
        <PromoBanner slot="tras-tamanos" />
        <Precios />
        <InfoInteres />
        <Beneficios />
        <PromoBanner slot="pre-footer" />
        <FAQ />
        <Publicidad />
      </main>
      <Footer />
    </>
  );
}
