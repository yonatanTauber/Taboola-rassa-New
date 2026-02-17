import { InviteCodesWorkspace } from "@/components/invites/InviteCodesWorkspace";
import { getCurrentUser } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getRegistrationMode } from "@/lib/registration";

export default async function InvitesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!isAdminEmail(user.email)) {
    return (
      <main className="space-y-3">
        <section className="app-section">
          <h1 className="text-xl font-semibold text-ink">הזמנות משתמשים</h1>
          <p className="mt-2 text-sm text-muted">אין לך הרשאה לניהול הזמנות. רק משתמש אדמין יכול ליצור הזמנות.</p>
        </section>
      </main>
    );
  }

  const invites = await prisma.inviteCode.findMany({
    where: { ownerUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      code: true,
      invitedEmail: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      createdAt: true,
      usedByUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  return (
    <InviteCodesWorkspace
      registrationMode={getRegistrationMode()}
      initialInvites={invites.map((invite) => ({
        id: invite.id,
        code: invite.code,
        invitedEmail: invite.invitedEmail,
        expiresAt: invite.expiresAt?.toISOString() ?? null,
        usedAt: invite.usedAt?.toISOString() ?? null,
        revokedAt: invite.revokedAt?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
        usedByUser: invite.usedByUser,
      }))}
    />
  );
}
