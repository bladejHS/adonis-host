import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Autentificare" };

export default function Login({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-navy-900 lg:block">
        <img src="/photos/sea-balcony.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-900/50 to-navy-900/20" />
        <div className="absolute bottom-12 left-12 right-12 space-y-3 text-ivory-50">
          <p className="label text-gold-300">Costinești · Marea Neagră</p>
          <p className="max-w-md font-display text-4xl leading-tight">Fiecare oaspete pleacă cu răsăritul în suflet.</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-10">
          <img src="/brand/adonis-logo-stacked.svg" alt="Hostel Adonis Costinești" className="mx-auto h-40" />
          <LoginForm next={searchParams.next ?? ""} />
        </div>
      </section>
    </main>
  );
}
