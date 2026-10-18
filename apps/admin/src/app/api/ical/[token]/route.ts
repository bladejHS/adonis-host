import { exportRoomCalendar } from "@/lib/ical";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const cal = await exportRoomCalendar(params.token.replace(/\.ics$/, ""));
  if (!cal) return new Response("Calendar inexistent", { status: 404 });
  return new Response(cal.body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="adonis-camera-${cal.room.number}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
