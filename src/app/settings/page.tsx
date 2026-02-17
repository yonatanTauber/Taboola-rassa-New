import { SettingsEditor } from "@/components/settings/SettingsEditor";
import { getCurrentUser } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/admin";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  const canManageInvites = isAdminEmail(currentUser?.email);
  return (
    <SettingsEditor
      initialProfile={{
        therapistName: currentUser?.fullName ?? "",
        email: currentUser?.email ?? "",
      }}
      canManageInvites={canManageInvites}
    />
  );
}
