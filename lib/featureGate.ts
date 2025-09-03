// lib/featureGate.ts
import { getFeature, type FeatureKey } from '@/config/features';

type Profile = {
plan: 'free' | 'pro';
trial_start: string | null;
trial_end: string | null;
verified: boolean;
};

function isTrialActive(p?: Profile | null) {
if (!p?.trial_end) return false;
return Date.now() < new Date(p.trial_end).getTime();
}

export function canUseFeature(p: Profile | null, featureKey: FeatureKey) {
if (!p) return { ok: false, reason: 'login-required' as const };
if (isTrialActive(p)) return { ok: true, trial: true as const };

const spec = getFeature(featureKey);
if (spec.requiresPro && p.plan !== 'pro')
return { ok: false, reason: 'upgrade-required' as const };

return { ok: true as const };
}

