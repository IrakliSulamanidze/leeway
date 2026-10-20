import { AuthForm } from "../auth-form";
import { signUp } from "../auth-actions";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return <AuthForm kind="signup" action={signUp} />;
}
