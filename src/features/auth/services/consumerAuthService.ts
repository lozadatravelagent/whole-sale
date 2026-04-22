import { supabase } from '@/integrations/supabase/client';

/**
 * Client-side wrappers around the B2C auth flows.
 *
 * signUpConsumer calls the consumer-signup edge function (public endpoint
 * that uses service_role internally to set account_type='consumer' and
 * role='CONSUMER'). On success the caller should follow with
 * signInConsumer to establish a session.
 *
 * signInConsumer / signOutConsumer are thin pass-throughs over the
 * standard supabase.auth methods — they exist to keep all auth calls in
 * one place and so the pages can import from a single module.
 */

export interface SignUpConsumerInput {
  name: string;
  email: string;
  password: string;
}

export interface SignUpConsumerResult {
  ok: true;
  userId: string;
}

export interface SignUpConsumerError {
  ok: false;
  message: string;
}

export async function signUpConsumer(
  input: SignUpConsumerInput
): Promise<SignUpConsumerResult | SignUpConsumerError> {
  try {
    const { data, error } = await supabase.functions.invoke('consumer-signup', {
      body: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
      },
    });

    if (error) {
      return { ok: false, message: error.message || 'No se pudo crear la cuenta.' };
    }

    if (!data?.success || !data?.user?.id) {
      return { ok: false, message: data?.error || 'No se pudo crear la cuenta.' };
    }

    return { ok: true, userId: data.user.id };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Error inesperado al crear la cuenta.',
    };
  }
}

export interface SignInConsumerResult {
  ok: true;
  userId: string;
}

export interface SignInConsumerError {
  ok: false;
  message: string;
}

export async function signInConsumer(
  email: string,
  password: string
): Promise<SignInConsumerResult | SignInConsumerError> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data?.user) {
      return {
        ok: false,
        message: error?.message || 'Email o contraseña incorrectos.',
      };
    }

    return { ok: true, userId: data.user.id };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Error inesperado al iniciar sesión.',
    };
  }
}

export async function signOutConsumer(): Promise<void> {
  await supabase.auth.signOut();
}
