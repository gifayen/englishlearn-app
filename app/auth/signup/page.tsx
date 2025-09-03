'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
const [err, setErr] = useState<string|null>(null);
const router = useRouter();

async function onSubmit(e: React.FormEvent) {
e.preventDefault(); setErr(null);
const { error } = await supabase.auth.signUp({ email, password });
if (error) return setErr(error.message);

const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
if (e2) return setErr(e2.message);

await fetch('/api/init-trial', { method: 'POST' });
router.push('/essay-checker');
}

return (
<div style={{maxWidth:420, margin:'40px auto'}}>
<h1>建立帳號</h1>
<form onSubmit={onSubmit} style={{display:'grid', gap:8}}>
<input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
<input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
<button type="submit">註冊</button>
</form>
{err && <p style={{color:'crimson'}}>{err}</p>}
</div>
);
}

