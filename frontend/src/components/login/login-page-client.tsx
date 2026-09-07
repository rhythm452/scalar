"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useLogin } from "@/hooks/use-login";
import { isApiError } from "@/lib/error";
import { sanitizeNextParam } from "@/lib/safe-redirect";
import { loginFormSchema, type LoginFormValues } from "@/types/auth-forms";

export function LoginPageClient({ next }: { next: string }) {
  const router = useRouter();
  const login = useLogin();
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setLoginError(null);
    login.mutate(values, {
      onSuccess: () => router.push(sanitizeNextParam(next)),
      onError: (error) => {
        setLoginError(isApiError(error) ? error.message : "Something went wrong. Please try again.");
      },
    });
  });

  return (
    <Box padding={{ top: "xxxl", horizontal: "l" }}>
      <div style={{ maxWidth: 480, marginInline: "auto" }}>
        <Container header={<Header variant="h1">Sign in</Header>}>
          <form onSubmit={onSubmit} noValidate>
            <SpaceBetween size="l">
              <Alert type="info" header="Demo credentials">
                Username: admin / Password: password123
              </Alert>
              {loginError ? <Alert type="error">{loginError}</Alert> : null}
              <Form
                actions={
                  <Button variant="primary" formAction="submit" loading={login.isPending} loadingText="Signing in…">
                    Sign in
                  </Button>
                }
              >
                <SpaceBetween size="l">
                  <Controller
                    name="username"
                    control={control}
                    render={({ field }) => (
                      <FormField label="Username" errorText={errors.username?.message} controlId="login-username">
                        <Input
                          value={field.value}
                          onChange={({ detail }) => field.onChange(detail.value)}
                          onBlur={field.onBlur}
                          autoFocus
                        />
                      </FormField>
                    )}
                  />
                  <Controller
                    name="password"
                    control={control}
                    render={({ field }) => (
                      <FormField label="Password" errorText={errors.password?.message} controlId="login-password">
                        <Input
                          type="password"
                          value={field.value}
                          onChange={({ detail }) => field.onChange(detail.value)}
                          onBlur={field.onBlur}
                        />
                      </FormField>
                    )}
                  />
                </SpaceBetween>
              </Form>
            </SpaceBetween>
          </form>
        </Container>
      </div>
    </Box>
  );
}
