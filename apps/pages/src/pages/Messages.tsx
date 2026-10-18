import { PageHeader } from "@/components/ui";
import { TemplateBuilder } from "@/components/template-builder";
import { useDb } from "../data/store";
import { deleteTemplate, saveTemplate } from "../data/actions";

export function Messages() {
  const db = useDb();
  return (
    <div>
      <PageHeader eyebrow="Casă" title="Mesaje WhatsApp" description="Șabloane calde, în tonul Adonis. Variabilele se completează singure din rezervare." />
      <TemplateBuilder
        save={async (t) => saveTemplate(t)}
        remove={async (id) => deleteTemplate(id)}
        initial={[...db.templates].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, name: t.name, trigger: t.trigger, tone: t.tone, body: t.body, active: t.active }))}
      />
    </div>
  );
}
