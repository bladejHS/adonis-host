import { notFound } from "next/navigation";
import { findByToken, offersForReservation, trackUpsell } from "@adonis/core";
import { Footer, Hero } from "@/components/shell";
import { OfferPicker } from "@/components/offer-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Oferte pentru sejur" };

export default async function Offers({ params }: { params: { token: string } }) {
  const r = await findByToken(params.token);
  if (!r) notFound();
  const offers = await offersForReservation(r.id);
  await trackUpsell(offers.filter((o) => !o.bought).map((o) => o.id), r.id, "view");

  return (
    <main>
      <Hero photo="/photos/sea-balcony.webp" eyebrow="Pentru sejurul dumneavoastră" title={<>Mici bucurii <em className="font-normal text-gold-300">la malul mării</em></>}>
        <p>Alese pentru perioada și camera dumneavoastră. Plătiți online acum sau le confirmăm la recepție.</p>
      </Hero>
      <div className="mx-auto max-w-xl px-5 py-8">
        {offers.length ? (
          <OfferPicker token={params.token} offers={offers.map((o) => ({ id: o.id, title: o.title, description: o.description, category: o.category, price: o.price, unit: o.unit, total: o.total, quantity: o.quantity, imagePath: o.imagePath, bought: o.bought }))} />
        ) : (
          <p className="text-center text-subtle">Pentru perioada sejurului nu avem oferte extra. Vă așteptăm cu drag!</p>
        )}
      </div>
      <Footer />
    </main>
  );
}
