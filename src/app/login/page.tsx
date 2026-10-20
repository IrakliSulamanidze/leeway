import { AuthForm } from "../auth-form";
import { logIn } from "../auth-actions";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return <AuthForm kind="login" action={logIn} />;
}
