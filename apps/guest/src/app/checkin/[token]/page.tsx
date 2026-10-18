import { notFound, redirect } from "next/navigation";
import { CONTRACT_TEXT, findByToken, tokenState } from "@adonis/core";
import { nightsBetween } from "@adonis/database";
import { CheckinFlow } from "@/components/checkin-flow";
import { Footer, Hero, Panel } from "@/components/shell";
import { fmtDay } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in online" };

export default async function Checkin({ params }: { params: { token: string } }) {
  const r = await findByToken(params.token);
  if (!r) notFound();
  const state = tokenState(r);
  if (state === "done") redirect(`/bun-venit/${params.token}`);

  return (
    <main>
      <Hero photo="/photos/courtyard-vine.webp" eyebrow={`Rezervarea ${r.code}`} title={<>Bine ați venit, <em className="font-normal text-gold-300">{r.guest.firstName}</em></>}>
        <p>
          Camera {r.room.number} · {fmtDay(r.checkIn)} – {fmtDay(r.checkOut)} · {nightsBetween(r.checkIn, r.checkOut)} nopți
        </p>
      </Hero>
      <div className="mx-auto max-w-xl px-5 py-8">
        {state === "open" ? (
          <Panel>
            <p className="mb-6 text-sm text-subtle">Trei pași scurți, ca la sosire să primiți direct cheia. Durează cam două minute.</p>
            <CheckinFlow
              token={params.token}
              firstName={r.guest.firstName === "Oaspete" ? "" : r.guest.firstName}
              lastName={r.guest.firstName === "Oaspete" ? "" : r.guest.lastName}
              email={r.guest.email ?? ""}
              phone={r.guest.phone ?? ""}
              contract={CONTRACT_TEXT}
              adults={r.adults}
              children={r.children}
            />
          </Panel>
        ) : (
          <Panel>
            <h2 className="text-2xl">{state === "expired" ? "Linkul a expirat" : "Rezervarea a fost anulată"}</h2>
            <p className="mt-2 text-subtle">Pentru orice întrebare, sunați-ne oricând la 0742 100 480.</p>
          </Panel>
        )}
      </div>
      <Footer />
    </main>
  );
}
