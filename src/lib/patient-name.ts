export function formatPatientName(firstName: string, lastName: string | null | undefined) {
  const lastInitial = (lastName ?? "").trim().charAt(0);
  return `${firstName}${lastInitial ? ` ${lastInitial}.` : ""}`;
}
