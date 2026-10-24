import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, EyeOff, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { readableError } from '../lib/api';
import { AuthLayout } from '../components/forms/AuthLayout';
import { Button, Field } from '../components/ui/Controls';

const schema = z.object({ name: z.string().trim().min(2, 'Enter your full name.').max(80, 'Name must be 80 characters or fewer.'), email: z.string().trim().email('Enter a valid university email.').max(254), password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Password must be 72 characters or fewer.').regex(/[a-z]/, 'Add a lowercase letter.').regex(/[A-Z]/, 'Add an uppercase letter.').regex(/[0-9]/, 'Add a number.'), confirmPassword: z.string(), termsAccepted: z.boolean().refine((value) => value, 'Accept the terms to continue.') }).refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
type Values = z.infer<typeof schema>;
export function SignupPage() {
  const { signUp } = useAuth(); const navigate = useNavigate();
  const [passwordVisible, setPasswordVisible] = useState(false); const [confirmVisible, setConfirmVisible] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', password: '', confirmPassword: '', termsAccepted: false } });
  const password = form.watch('password');
  async function onSubmit(values: Values) {
    try { await signUp({ name: values.name.trim(), email: values.email.trim(), password: values.password }); toast.success('Account created. Let’s set up your campus profile.'); navigate('/onboarding', { replace: true }); }
    catch (error) { form.setError('root', { type: 'server', message: readableError(error) }); }
  }
  return <AuthLayout eyebrow="CREATE YOUR ACCOUNT" title="A clearer campus starts here." description="Create your account, then tell UniRadar how you plan your week." alternate={<>Already have an account? <Link to="/login">Sign in</Link></>}>
    <form className="auth-form signup-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Field label="Full name" type="text" autoComplete="name" placeholder="Your name" {...form.register('name')} error={form.formState.errors.name?.message} trailing={<UserRound size={16} />} />
      <Field label="University email" type="email" autoComplete="email" placeholder="name@gmail.com" {...form.register('email')} error={form.formState.errors.email?.message} />
      <Field label="Password" type={passwordVisible ? 'text' : 'password'} autoComplete="new-password" placeholder="Create a password" {...form.register('password')} error={form.formState.errors.password?.message} trailing={<button type="button" className="password-toggle" onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button>} />
      <div className="password-checklist"><span className={password.length >= 8 ? 'complete' : ''}><Check size={12} /> 8+ characters</span><span className={/[A-Z]/.test(password) && /[0-9]/.test(password) ? 'complete' : ''}><Check size={12} /> Uppercase + number</span></div>
      <Field label="Confirm password" type={confirmVisible ? 'text' : 'password'} autoComplete="new-password" placeholder="Type it again" {...form.register('confirmPassword')} error={form.formState.errors.confirmPassword?.message} trailing={<button type="button" className="password-toggle" onClick={() => setConfirmVisible((value) => !value)} aria-label={confirmVisible ? 'Hide confirmation' : 'Show confirmation'}>{confirmVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button>} />
      <label className="check-row terms-row"><input type="checkbox" {...form.register('termsAccepted')} /><span>I agree to the <a href="/terms" onClick={(event) => { event.preventDefault(); toast.info('Terms are not published yet. Use this demo under your university team’s guidance.'); }}>terms of use</a> and understand that demo campus data is unverified.</span></label>
      {form.formState.errors.termsAccepted && <p className="field-error">{form.formState.errors.termsAccepted.message}</p>}{form.formState.errors.root?.message && <div className="form-alert" role="alert">{form.formState.errors.root.message}</div>}
      <Button type="submit" variant="primary" size="lg" className="auth-submit" loading={form.formState.isSubmitting}>Create account <span>→</span></Button>
      <p className="auth-security"><span className="security-dot" /> Passwords are securely hashed. Sessions use HTTP-only cookies.</p>
    </form>
  </AuthLayout>;
}
