import { redirect } from "next/navigation";

// Milestone 1 replaces this with a landing page / login redirect based on auth.
export default function Home() {
  redirect("/dashboard");
}
