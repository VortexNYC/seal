---
name: tanstack-form
description: Headless, performant, and type-safe form state management for TS/JS, React, Vue, Angular, Solid, Lit, and Svelte.
---

<<<<<<< HEAD
=======

>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
## Overview

TanStack Form is a headless form library with deep TypeScript integration. It provides field-level and form-level validation (sync/async), array fields, linked/dependent fields, fine-grained reactivity, and schema validation adapter support (Zod, Valibot, Yup).

**Package:** `@tanstack/react-form`
**Adapters:** `@tanstack/zod-form-adapter`, `@tanstack/valibot-form-adapter`
**Status:** Stable (v1)

## Installation

```bash
npm install @tanstack/react-form
# Optional schema adapters:
npm install @tanstack/zod-form-adapter zod
npm install @tanstack/valibot-form-adapter valibot
```

## Core: useForm

```tsx
<<<<<<< HEAD
import { useForm } from "@tanstack/react-form";
=======
import { useForm } from '@tanstack/react-form'
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

function MyForm() {
  const form = useForm({
    defaultValues: {
<<<<<<< HEAD
      firstName: "",
      lastName: "",
      email: "",
=======
      firstName: '',
      lastName: '',
      email: '',
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
      age: 0,
    },
    onSubmit: async ({ value }) => {
      // value is fully typed
<<<<<<< HEAD
      await submitToServer(value);
    },
    onSubmitInvalid: ({ value, formApi }) => {
      console.log("Validation failed:", formApi.state.errors);
    },
  });
=======
      await submitToServer(value)
    },
    onSubmitInvalid: ({ value, formApi }) => {
      console.log('Validation failed:', formApi.state.errors)
    },
  })
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

  return (
    <form
      onSubmit={(e) => {
<<<<<<< HEAD
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
=======
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
      }}
    >
      {/* Fields */}
      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        children={({ canSubmit, isSubmitting }) => (
          <button type="submit" disabled={!canSubmit}>
<<<<<<< HEAD
            {isSubmitting ? "Submitting..." : "Submit"}
=======
            {isSubmitting ? 'Submitting...' : 'Submit'}
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
          </button>
        )}
      />
    </form>
<<<<<<< HEAD
  );
=======
  )
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

## Fields (form.Field)

```tsx
<form.Field
  name="firstName"
  validators={{
    onChange: ({ value }) =>
      value.length < 3 ? 'Must be at least 3 characters' : undefined,
  }}
  children={(field) => (
    <div>
      <label htmlFor={field.name}>First Name</label>
      <input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
        <em>{field.state.meta.errors.join(', ')}</em>
      )}
    </div>
  )}
/>

<!-- Nested fields use dot notation -->
<form.Field name="address.city">
  {(field) => (
    <input
      value={field.state.value}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
    />
  )}
</form.Field>
```

## Validation

### Validation Timing

<<<<<<< HEAD
| Cause      | When                     |
| ---------- | ------------------------ |
| `onChange` | After every value change |
| `onBlur`   | When field loses focus   |
| `onSubmit` | During submission        |
| `onMount`  | When field mounts        |
=======
| Cause | When |
|-------|------|
| `onChange` | After every value change |
| `onBlur` | When field loses focus |
| `onSubmit` | During submission |
| `onMount` | When field mounts |
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

### Synchronous Validation

```tsx
<form.Field
  name="age"
  validators={{
    onChange: ({ value }) => {
<<<<<<< HEAD
      if (value < 18) return "Must be 18 or older";
      return undefined; // undefined = valid
    },
    onBlur: ({ value }) => {
      if (!value) return "Required";
      return undefined;
=======
      if (value < 18) return 'Must be 18 or older'
      return undefined // undefined = valid
    },
    onBlur: ({ value }) => {
      if (!value) return 'Required'
      return undefined
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
    },
  }}
/>
```

### Asynchronous Validation

```tsx
<form.Field
  name="username"
  asyncDebounceMs={500}
  validators={{
    onChangeAsync: async ({ value }) => {
<<<<<<< HEAD
      const res = await fetch(`/api/check-username?q=${value}`);
      const { available } = await res.json();
      if (!available) return "Username taken";
      return undefined;
=======
      const res = await fetch(`/api/check-username?q=${value}`)
      const { available } = await res.json()
      if (!available) return 'Username taken'
      return undefined
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
    },
  }}
>
  {(field) => (
    <>
      <input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
      {field.state.meta.isValidating && <span>Checking...</span>}
    </>
  )}
</form.Field>
```

### Schema Validation (Zod)

```tsx
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'

const form = useForm({
  defaultValues: { email: '', age: 0 },
  validatorAdapter: zodValidator(),
  onSubmit: async ({ value }) => { /* ... */ },
})

<form.Field
  name="email"
  validators={{
    onChange: z.string().email('Invalid email'),
    onBlur: z.string().min(1, 'Required'),
  }}
/>

<form.Field
  name="age"
  validators={{
    onChange: z.number().min(18, 'Must be 18+'),
  }}
/>
```

### Form-Level Validation

```tsx
const form = useForm({
<<<<<<< HEAD
  defaultValues: { password: "", confirmPassword: "" },
  validators: {
    onChange: ({ value }) => {
      if (value.password !== value.confirmPassword) {
        return "Passwords do not match";
      }
      return undefined;
    },
  },
});
=======
  defaultValues: { password: '', confirmPassword: '' },
  validators: {
    onChange: ({ value }) => {
      if (value.password !== value.confirmPassword) {
        return 'Passwords do not match'
      }
      return undefined
    },
  },
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

### Linked/Dependent Fields

```tsx
<form.Field
  name="confirmPassword"
  validators={{
<<<<<<< HEAD
    onChangeListenTo: ["password"], // Re-validate when password changes
    onChange: ({ value, fieldApi }) => {
      const password = fieldApi.form.getFieldValue("password");
      if (value !== password) return "Passwords do not match";
      return undefined;
=======
    onChangeListenTo: ['password'], // Re-validate when password changes
    onChange: ({ value, fieldApi }) => {
      const password = fieldApi.form.getFieldValue('password')
      if (value !== password) return 'Passwords do not match'
      return undefined
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
    },
  }}
/>
```

## Array Fields

```tsx
<form.Field name="people" mode="array">
  {(field) => (
    <div>
      {field.state.value.map((_, index) => (
        <div key={index}>
          <form.Field name={`people[${index}].name`}>
            {(subField) => (
              <input
                value={subField.state.value}
                onChange={(e) => subField.handleChange(e.target.value)}
              />
            )}
          </form.Field>
          <button type="button" onClick={() => field.removeValue(index)}>
            Remove
          </button>
        </div>
      ))}
<<<<<<< HEAD
      <button type="button" onClick={() => field.pushValue({ name: "", age: 0 })}>
=======
      <button type="button" onClick={() => field.pushValue({ name: '', age: 0 })}>
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
        Add Person
      </button>
    </div>
  )}
</form.Field>
```

### Array Methods

```typescript
<<<<<<< HEAD
field.pushValue(item); // Add to end
field.insertValue(index, item); // Insert at index
field.replaceValue(index, item); // Replace at index
field.removeValue(index); // Remove at index
field.swapValues(indexA, indexB); // Swap positions
field.moveValue(from, to); // Move position
=======
field.pushValue(item)              // Add to end
field.insertValue(index, item)     // Insert at index
field.replaceValue(index, item)    // Replace at index
field.removeValue(index)           // Remove at index
field.swapValues(indexA, indexB)    // Swap positions
field.moveValue(from, to)          // Move position
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Listeners (Side Effects)

```tsx
<form.Field
  name="country"
  listeners={{
    onChange: ({ value }) => {
      // Side effect: reset dependent fields
<<<<<<< HEAD
      form.setFieldValue("state", "");
      form.setFieldValue("postalCode", "");
=======
      form.setFieldValue('state', '')
      form.setFieldValue('postalCode', '')
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
    },
  }}
/>
```

## Reactivity (form.Subscribe & useStore)

```tsx
// Render-prop subscription (fine-grained)
<form.Subscribe
  selector={(state) => ({ canSubmit: state.canSubmit, isDirty: state.isDirty })}
  children={({ canSubmit, isDirty }) => (
    <div>
      {isDirty && <span>Unsaved changes</span>}
      <button disabled={!canSubmit}>Save</button>
    </div>
  )}
<<<<<<< HEAD
/>;

// Hook-based subscription
function FormStatus() {
  const isValid = form.useStore((s) => s.isValid);
  return isValid ? null : <p>Fix errors</p>;
=======
/>

// Hook-based subscription
function FormStatus() {
  const isValid = form.useStore((s) => s.isValid)
  return isValid ? null : <p>Fix errors</p>
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

## Form State

```typescript
interface FormState {
<<<<<<< HEAD
  values: TFormData;
  errors: ValidationError[];
  errorMap: Record<string, ValidationError>;
  isFormValid: boolean;
  isFieldsValid: boolean;
  isValid: boolean; // isFormValid && isFieldsValid
  isTouched: boolean;
  isPristine: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  isSubmitted: boolean;
  isSubmitSuccessful: boolean;
  submissionAttempts: number;
  canSubmit: boolean; // isValid && !isSubmitting
=======
  values: TFormData
  errors: ValidationError[]
  errorMap: Record<string, ValidationError>
  isFormValid: boolean
  isFieldsValid: boolean
  isValid: boolean               // isFormValid && isFieldsValid
  isTouched: boolean
  isPristine: boolean
  isDirty: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  isSubmitSuccessful: boolean
  submissionAttempts: number
  canSubmit: boolean             // isValid && !isSubmitting
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

## Field State

```typescript
interface FieldState<TData> {
<<<<<<< HEAD
  value: TData;
  meta: {
    isTouched: boolean;
    isDirty: boolean;
    isPristine: boolean;
    isValidating: boolean;
    errors: ValidationError[];
    errorMap: Record<ValidationCause, ValidationError>;
  };
=======
  value: TData
  meta: {
    isTouched: boolean
    isDirty: boolean
    isPristine: boolean
    isValidating: boolean
    errors: ValidationError[]
    errorMap: Record<ValidationCause, ValidationError>
  }
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
}
```

## FormApi Methods

```typescript
<<<<<<< HEAD
form.handleSubmit();
form.reset();
form.getFieldValue(field);
form.setFieldValue(field, value);
form.getFieldMeta(field);
form.setFieldMeta(field, updater);
form.validateAllFields(cause);
form.validateField(field, cause);
form.deleteField(field);
=======
form.handleSubmit()
form.reset()
form.getFieldValue(field)
form.setFieldValue(field, value)
form.getFieldMeta(field)
form.setFieldMeta(field, updater)
form.validateAllFields(cause)
form.validateField(field, cause)
form.deleteField(field)
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Shared Form Options (formOptions)

```tsx
<<<<<<< HEAD
import { formOptions } from "@tanstack/react-form";

const sharedOpts = formOptions({
  defaultValues: { firstName: "", lastName: "" },
});
=======
import { formOptions } from '@tanstack/react-form'

const sharedOpts = formOptions({
  defaultValues: { firstName: '', lastName: '' },
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

// Reuse across components
const form = useForm({
  ...sharedOpts,
<<<<<<< HEAD
  onSubmit: async ({ value }) => {
    /* ... */
  },
});
=======
  onSubmit: async ({ value }) => { /* ... */ },
})
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
```

## Server-Side Validation

```tsx
// TanStack Start / Next.js server action
<<<<<<< HEAD
import { ServerValidateError } from "@tanstack/react-form/nextjs";

export async function validateForm(data: FormData) {
  const email = data.get("email") as string;
  if (await checkEmailExists(email)) {
    throw new ServerValidateError({
      form: "Submission failed",
      fields: { email: "Email already registered" },
    });
=======
import { ServerValidateError } from '@tanstack/react-form/nextjs'

export async function validateForm(data: FormData) {
  const email = data.get('email') as string
  if (await checkEmailExists(email)) {
    throw new ServerValidateError({
      form: 'Submission failed',
      fields: { email: 'Email already registered' },
    })
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
  }
}
```

## TypeScript Integration

```tsx
// Type-safe field paths with DeepKeys
interface UserForm {
  name: string
  address: { street: string; city: string }
  tags: string[]
  contacts: Array<{ name: string; phone: string }>
}

// TypeScript auto-completes all valid paths:
// 'name', 'address', 'address.street', 'address.city', 'tags', 'contacts'
<form.Field name="address.city" />     // OK
<form.Field name="nonexistent" />       // Type Error!
```

## Best Practices

1. **Always call `e.preventDefault()` and `e.stopPropagation()`** on form submit
2. **Always attach `onBlur={field.handleBlur}`** for blur validation and isTouched tracking
3. **Use `mode="array"`** for array fields to get array methods
4. **Return `undefined`** (not null/false) for valid validators
5. **Use `asyncDebounceMs`** for async validators to prevent API spam
6. **Check `isTouched` before showing errors** for better UX
7. **Use `form.Subscribe` with selectors** to minimize re-renders
8. **Use `formOptions`** for shared configuration across components
9. **Use schema validators** (Zod/Valibot) for complex validation rules
10. **Use `onChangeListenTo`** for cross-field validation dependencies

## Common Pitfalls

- Forgetting `e.preventDefault()` on form submit (causes page reload)
- Not attaching `onBlur` to inputs (breaks blur validation and isTouched)
- Returning `null` or `false` instead of `undefined` for valid fields
- Using `mode="array"` incorrectly (only needed on the array field itself, not sub-fields)
- Subscribing to entire form state instead of using selectors (unnecessary re-renders)
- Not using `asyncDebounceMs` with async validators (fires on every keystroke)
