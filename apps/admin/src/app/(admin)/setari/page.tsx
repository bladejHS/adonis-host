import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PropertyForm } from "@/components/property-form";

export const metadata = { title: "Setări" };

export default async function Settings() {
  const p = await prisma.property.findFirstOrThrow();
  const { createdAt, updatedAt, ...plain } = p;
  void createdAt;
  void updatedAt;
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Administrare" title="Setări" description="Datele care apar pe facturi, în mesajele către oaspeți și în calculul taxelor." />
      <PropertyForm p={plain} />
    </div>
  );
}
