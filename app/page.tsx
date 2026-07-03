import { AntesDespues } from "@/components/AntesDespues";
import { Advertencias } from "@/components/Advertencias";
import { Banner } from "@/components/Banner";
import { Beneficios } from "@/components/Beneficios";
import { ComoTrabajamos } from "@/components/ComoTrabajamos";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { InfoInteres } from "@/components/InfoInteres";
import { Precios } from "@/components/Precios";
import { Proximamente } from "@/components/Proximamente";
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
        <AntesDespues />
        <Banner />
        <ComoTrabajamos />
        <Resenas />
        <Advertencias />
        <Tamanos />
        <Precios />
        <InfoInteres />
        <Beneficios />
        <Proximamente />
        <Publicidad />
      </main>
      <Footer />
    </>
  );
}
