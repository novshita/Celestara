"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * `useActionState` for a form that should keep what the visitor typed.
 *
 * React 19 empties a form once the function in its `action` prop finishes. For
 * a one-field form that is tidy; for a birth-data form it means retyping the
 * date, time and coordinates to ask a second question or try the other system.
 * Submitting through `onSubmit` instead runs the same server action without
 * the automatic reset. The browser's own validation (`required`, `min`, `max`)
 * still runs first, since `submit` only fires when the form is valid.
 *
 * The trade-off: without JavaScript the form no longer submits on its own, as
 * an `action` form would. These forms already need JavaScript for everything
 * around them (the results, the toggles), so that costs nothing in practice.
 */
export function useKeptFormAction<State>(
  action: (previous: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
) {
  const [state, run, isPending] = useActionState(action, initialState);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(
      event.currentTarget,
      (event.nativeEvent as SubmitEvent).submitter,
    );
    startTransition(() => run(formData));
  };

  return [state, onSubmit, isPending] as const;
}
