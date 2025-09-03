'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
const [err, setErr] = useState<string|null>(null);
const router = useRouter();

async function onSubmit(e: React.FormEvent) {
e.preventDefault(); setErr(null);
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) return setErr(error.message);
await fetch('/api/init-trial', { method: 'POST' });
router.push('/essay-checker');
}

return (
<div style={{maxWidth:420, margin:'40px auto'}}>
<h1>登入</h1>
<form onSubmit={onSubmit} style={{display:'grid', gap:8}}>
<input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
<input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
<button type="submit">登入</button>
</form>
{err && <p style={{color:'crimson'}}>{err}</p>}
</div>
);
}

