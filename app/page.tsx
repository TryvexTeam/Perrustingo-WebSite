import { AntesDespues } from "@/components/AntesDespues";
import { Advertencias } from "@/components/Advertencias";
import { Banner } from "@/components/Banner";
import { Beneficios } from "@/components/Beneficios";
import { ComoTrabajamos } from "@/components/ComoTrabajamos";
import { BotonWhatsApp } from "@/components/BotonWhatsApp";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HeroParallax } from "@/components/HeroParallax";
import { HuellitasScroll } from "@/components/HuellitasScroll";
import { LoaderHuellita } from "@/components/LoaderHuellita";
import { TiltCards } from "@/components/TiltCards";
import { InfoInteres } from "@/components/InfoInteres";
import { Precios } from "@/components/Precios";
import { Proximamente } from "@/components/Proximamente";
import { Publicidad } from "@/components/Publicidad";
import { QuickAccess } from "@/components/QuickAccess";
import { SiteMenu } from "@/components/SiteMenu";
import { StatsBar } from "@/components/StatsBar";
import { FAQ } from "@/components/FAQ";
import { Resenas } from "@/components/Resenas";
import { Servicios } from "@/components/Servicios";
import { Tamanos } from "@/components/Tamanos";

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
        <AntesDespues />
        <Banner />
        <ComoTrabajamos />
        <Resenas />
        <StatsBar />
        <Advertencias />
        <Tamanos />
        <Precios />
        <InfoInteres />
        <Beneficios />
        <Proximamente />
        <FAQ />
        <Publicidad />
      </main>
      <Footer />
    </>
  );
}
