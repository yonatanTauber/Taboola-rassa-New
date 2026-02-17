import { InviteCodesWorkspace } from "@/components/invites/InviteCodesWorkspace";
import { requireCurrentUserId } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { getRegistrationMode } from "@/lib/registration";

export default async function InvitesPage() {
  const userId = await requireCurrentUserId();
  if (!userId) return null;

  const invites = await prisma.inviteCode.findMany({
    where: { ownerUserId: userId },
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
