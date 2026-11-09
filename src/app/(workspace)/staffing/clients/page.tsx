import { redirect } from "next/navigation";

/** Staffing clients and Sales accounts are the same Tessiant account entities. */
export default function StaffingClientsRedirectPage() {
  redirect("/sales/accounts");
}
