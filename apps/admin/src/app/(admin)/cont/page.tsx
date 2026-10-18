import { ROLE_LABEL } from "@adonis/core/auth";
import { getSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { PasswordForm } from "@/components/account-forms";

export const metadata = { title: "Contul meu" };

export default async function Account() {
  const s = await getSession();
  return (
    <div className="max-w-xl">
      <PageHeader eyebrow={s ? ROLE_LABEL[s.role] : ""} title={s?.name ?? "Contul meu"} />
      <Card title="Schimbă parola">
        <PasswordForm />
      </Card>
    </div>
  );
}
