import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { TemplateBuilder } from "@/components/template-builder";
import { deleteTemplate, saveTemplate } from "@/lib/actions";

export const metadata = { title: "Mesaje WhatsApp" };

export default async function Messages() {
  const templates = await prisma.messageTemplate.findMany({ orderBy: { name: "asc" } });
  return (
    <div>
      <PageHeader eyebrow="Casă" title="Mesaje WhatsApp" description="Șabloane calde, în tonul Adonis. Variabilele se completează singure din rezervare." />
      <TemplateBuilder save={saveTemplate} remove={deleteTemplate} initial={templates.map((t) => ({ id: t.id, name: t.name, trigger: t.trigger, tone: t.tone, body: t.body, active: t.active }))} />
    </div>
  );
}
