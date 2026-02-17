import { SettingsEditor } from "@/components/settings/SettingsEditor";
import { getCurrentUser } from "@/lib/auth-server";

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  return (
    <SettingsEditor
      initialProfile={{
        therapistName: currentUser?.fullName ?? "",
        email: currentUser?.email ?? "",
      }}
    />
  );
}
