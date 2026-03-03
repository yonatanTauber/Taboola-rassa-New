"use client";

import { useState } from "react";
import { CustomSelect } from "@/components/CustomSelect";

export function InquiryCreateForm({
  action,
}: {
  action: (formData: FormData) => void;
}) {
  const [gender, setGender] = useState("");

  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2">
        <input name="firstName" required placeholder="שם פרטי *" className="app-field" />
        <input name="lastName" required placeholder="שם משפחה *" className="app-field" />
        <input name="phone" required placeholder="טלפון *" className="app-field" />
        <CustomSelect
          value={gender}
          onChange={setGender}
          options={[
            { value: "", label: "מגדר (אופציונלי)" },
            { value: "MALE", label: "גבר" },
            { value: "FEMALE", label: "אישה" },
            { value: "OTHER", label: "אחר" },
          ]}
          placeholder="מגדר (אופציונלי)"
          name="gender"
        />
        <input name="referralSource" placeholder="מקור פנייה" className="app-field" />
      </div>
      <textarea name="notes" placeholder="הערות על הפנייה" className="app-textarea min-h-24" />
      <div className="flex justify-end">
        <button className="app-btn app-btn-primary">שמור</button>
      </div>
    </form>
  );
}
