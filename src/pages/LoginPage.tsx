import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { readableError } from '../lib/api';
import { AuthLayout } from '../components/forms/AuthLayout';
import { Button, Field } from '../components/ui/Controls';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.'), rememberMe: z.boolean().default(false) });
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', rememberMe: false } });

  async function onSubmit(values: Values) {
    try { await signIn(values); toast.success('You’re signed in.'); navigate('/app', { replace: true }); }
    catch (error) { form.setError('root', { type: 'server', message: readableError(error) }); }
  }

  return <AuthLayout eyebrow="WELCOME BACK" title="Good to have you back." description="Sign in to pick up where your campus day left off." alternate={<>New to UniRadar? <Link to="/signup">Create an account</Link></>}>
    <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Field label="University email" type="email" autoComplete="email" placeholder="name@gmail.com" {...form.register('email')} error={form.formState.errors.email?.message} />
      <Field label="Password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" {...form.register('password')} error={form.formState.errors.password?.message} trailing={<button type="button" className="password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>} />
      <div className="login-options"><label className="check-row"><input type="checkbox" {...form.register('rememberMe')} /><span>Remember me</span></label><button type="button" className="text-link" onClick={() => setForgotOpen((value) => !value)}>Forgot password?</button></div>
      {forgotOpen && <div className="inline-note"><KeyRound size={16} /><p>Password reset email isn’t configured yet. Contact your UniRadar administrator or connect the team’s email delivery service.</p></div>}
      {form.formState.errors.root?.message && <div className="form-alert" role="alert">{form.formState.errors.root.message}</div>}
      <Button type="submit" variant="primary" size="lg" className="auth-submit" loading={form.formState.isSubmitting}>Sign in <span>→</span></Button>
      <p className="auth-security"><span className="security-dot" /> Your session is encrypted and protected by an HTTP-only cookie.</p>
    </form>
  </AuthLayout>;
}
