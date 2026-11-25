"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Building2, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { loginSchema } from "../lib/contracts";
import { sessionAction } from "../lib/api";
import { Busy, ErrorNotice } from "./ui";

export function SignIn() {
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) =>
      sessionAction("POST", values),
    onSuccess: () => window.location.replace("/dashboard"),
  });
  const { errors } = form.formState;
  return (
    <main className="sign-in">
      <section className="sign-in-brand">
        <div className="sign-in-brand-name">
          <span className="brand-mark">
            <Building2 size={22} />
          </span>{" "}
          PGListings
        </div>
        <div>
          <span className="sign-in-kicker">
            <span /> OPERATIONS CONSOLE
          </span>
          <h1>
            PGListings
            <br />
            admin workspace
          </h1>
          <p>Manage property listings, accounts, and platform operations.</p>
        </div>
        <span className="sign-in-foot">PGListings administration</span>
      </section>
      <section className="sign-in-panel">
        <div className="login-box">
          <span className="tile-icon">
            <KeyRound size={21} />
          </span>
          <h2>Sign in</h2>
          <p>Use your administrator credentials to continue.</p>
          <form
            className="form-stack"
            onSubmit={form.handleSubmit((values) => {
              if (!mutation.isPending) mutation.mutate(values);
            })}
          >
            <label>
              Email or mobile number
              <input
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...form.register("email")}
              />
              {errors.email && (
                <span id="email-error" className="field-error">
                  {errors.email.message}
                </span>
              )}
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                {...form.register("password")}
              />
              {errors.password && (
                <span id="password-error" className="field-error">
                  {errors.password.message}
                </span>
              )}
            </label>
            {mutation.isError && <ErrorNotice error={mutation.error} />}
            <button
              type="submit"
              className="button primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Busy />}
              {mutation.isPending ? "Signing in" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
