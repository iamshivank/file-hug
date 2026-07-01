'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { PLAN_LIST, type Plan, type PlanId } from '@/features/billing/plans';

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface OrderResponse {
  success: boolean;
  error?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  plan?: PlanId;
}

/** Load the Razorpay checkout script once. Resolves false if it can't load. */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    // Already available.
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function UpgradeOptions({
  currentPlan,
  userName,
  userEmail,
}: {
  currentPlan: PlanId;
  userName: string;
  userEmail: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPlan = searchParams.get('plan');

  const configured = Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);

  const [status, setStatus] = useState<Status>('idle');
  const [activePlan, setActivePlan] = useState<PlanId | null>(null);
  const [notice, setNotice] = useState<string>('');

  const requestedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the plan requested via ?plan= on the landing CTA.
  useEffect(() => {
    if (requestedPlan && requestedRef.current) {
      requestedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [requestedPlan]);

  const currentIndex = PLAN_LIST.findIndex((p) => p.id === currentPlan);
  // Plans strictly "above" the current one are upgrade targets.
  const upgradePlans = PLAN_LIST.filter((_, i) => i > currentIndex);

  async function startCheckout(plan: Plan) {
    setNotice('');
    setActivePlan(plan.id);

    if (!configured) {
      setStatus('error');
      setNotice(
        "Payments aren't configured yet — add your Razorpay keys to enable checkout."
      );
      return;
    }

    setStatus('loading');

    try {
      const orderRes = await fetch('/api/billing/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id }),
      });
      const order = (await orderRes.json()) as OrderResponse;

      if (!order.success || !order.orderId || !order.keyId) {
        setStatus('error');
        setNotice(order.error || 'Could not start checkout. Please try again.');
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setStatus('error');
        setNotice('Could not load the payment window. Check your connection and retry.');
        return;
      }

      const RazorpayCtor = (
        window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }
      ).Razorpay;

      const rzp = new RazorpayCtor({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'File Hug',
        description: `Upgrade to ${plan.name}`,
        prefill: { name: userName, email: userEmail },
        theme: { color: '#fb8b3d' },
        handler: async (response: RazorpayHandlerResponse) => {
          try {
            const verifyRes = await fetch('/api/billing/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                plan: plan.id,
              }),
            });
            const verify = (await verifyRes.json()) as { success: boolean; error?: string };
            if (verify.success) {
              setStatus('success');
              setNotice(`You're now on ${plan.name}! Refreshing…`);
              router.refresh();
            } else {
              setStatus('error');
              setNotice(verify.error || 'We could not confirm your payment. Contact support.');
            }
          } catch {
            setStatus('error');
            setNotice('We could not confirm your payment. Contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            setStatus('idle');
            setActivePlan(null);
          },
        },
      });

      rzp.open();
    } catch {
      setStatus('error');
      setNotice('Something went wrong starting checkout. Please try again.');
    }
  }

  if (upgradePlans.length === 0) {
    return (
      <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3.5">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        <p className="text-sm text-muted-light">
          You&apos;re on the top plan. Thanks for supporting File Hug.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <h3 className="font-display text-lg text-foreground">Upgrade options</h3>

      {!configured && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-light">
          <AlertCircle className="w-4 h-4 mt-0.5 text-primary-light shrink-0" />
          <span>
            Payments aren&apos;t configured yet — add your Razorpay keys to enable checkout.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {upgradePlans.map((plan) => {
          const isRequested = requestedPlan === plan.id;
          const isBusy = status === 'loading' && activePlan === plan.id;
          const highlighted = Boolean(plan.highlight) || isRequested;

          return (
            <div
              key={plan.id}
              ref={isRequested ? requestedRef : undefined}
              className={`flex flex-col rounded-2xl p-6 transition-all ${
                highlighted
                  ? 'gradient-border'
                  : 'card'
              } ${isRequested ? 'ring-1 ring-primary/40' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="font-display text-xl text-foreground">{plan.name}</h4>
                {plan.highlight && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary-light text-[11px] font-medium border border-border-strong">
                    <Sparkles className="w-3 h-3" />
                    Popular
                  </span>
                )}
              </div>

              <p className="text-muted-light text-sm mb-3">{plan.tagline}</p>

              <p className="flex items-baseline gap-1.5 mb-5">
                <span className="font-display text-2xl text-foreground">₹{plan.priceInr}</span>
                <span className="text-muted text-sm">/{plan.period}</span>
              </p>

              <button
                type="button"
                onClick={() => startCheckout(plan)}
                disabled={isBusy || status === 'success'}
                className="group mt-auto inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-light text-background font-semibold transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/35 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    Upgrade to {plan.name} (₹{plan.priceInr}/mo)
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {notice && (
        <div
          className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm animate-slide-up ${
            status === 'success'
              ? 'border border-border bg-surface text-success'
              : 'border border-border bg-surface text-danger'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
