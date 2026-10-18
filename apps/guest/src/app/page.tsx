import { Footer, Hero, Panel } from "@/components/shell";

export default function Home() {
  return (
    <main>
      <Hero photo="/photos/sea-balcony.webp" eyebrow="Costinești · Marea Neagră" title={<>Răsăritul, <em className="font-normal text-gold-300">din pat</em></>}>
        <p>24 de camere la 35 de metri de mare.</p>
      </Hero>
      <div className="mx-auto max-w-xl px-5 py-8">
        <Panel className="space-y-2 text-sm">
          <p>Pentru check-in online și informațiile sejurului, folosiți linkul primit pe WhatsApp sau pe e-mail după rezervare.</p>
          <p className="text-subtle">
            Rezervări: 0742 100 480 · <a className="text-gold-text underline underline-offset-4" href="https://www.casaadonis.ro">www.casaadonis.ro</a>
          </p>
        </Panel>
      </div>
      <Footer />
    </main>
  );
}
