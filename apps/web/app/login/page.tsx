import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import "./auth.css";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
