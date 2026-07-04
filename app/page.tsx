import { AntesDespues } from "@/components/AntesDespues";
import { Advertencias } from "@/components/Advertencias";
import { Banner } from "@/components/Banner";
import { Beneficios } from "@/components/Beneficios";
import { ComoTrabajamos } from "@/components/ComoTrabajamos";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { InfoInteres } from "@/components/InfoInteres";
import { Precios } from "@/components/Precios";
import { PromoBanner } from "@/components/PromoBanner";
import { Publicidad } from "@/components/Publicidad";
import { QuickAccess } from "@/components/QuickAccess";
import { SiteMenu } from "@/components/SiteMenu";
import { Resenas } from "@/components/Resenas";
import { Servicios } from "@/components/Servicios";
import { Tamanos } from "@/components/Tamanos";

export default function Home() {
  return (
    <>
      <SiteMenu />
      <QuickAccess />
      <main className="flex-1">
        <Hero />
        <Servicios />
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
        <Publicidad />
      </main>
      <Footer />
    </>
  );
}
