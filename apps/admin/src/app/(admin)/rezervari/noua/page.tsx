import { prisma } from "@/lib/db";
import { addDays, isoDay, parseDay, today } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ReservationForm } from "@/components/reservation-form";

export const metadata = { title: "Rezervare nouă" };

export default async function NewReservation({ searchParams }: { searchParams: { room?: string; date?: string } }) {
  const rooms = await prisma.room.findMany({ where: { active: true }, include: { roomType: true }, orderBy: { number: "asc" } });
  const start = searchParams.date ?? isoDay(today());
  return (
    <div>
      <PageHeader eyebrow="Recepție" title="Rezervare nouă" description="Prețul se calculează automat după sezon. Verificăm pe loc dacă camera e liberă." />
      <ReservationForm
        rooms={rooms.map((r) => ({ id: r.id, number: r.number, floor: r.floor, type: r.roomType.name, capacity: r.roomType.capacity, seaView: r.seaView }))}
        defaults={{ checkIn: start, checkOut: isoDay(addDays(parseDay(start), 2)), roomId: searchParams.room }}
      />
    </div>
  );
}
