"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { signIn, useSession } from "@/lib/crm-store";
import Icon from "@/components/ui/Icon";
import styles from "./login.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


type View = "signin" | "forgot" | "sent";

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && next !== "/login" ? next : "/";
}

export default function LoginView() {
  const router = useRouter();
  const session = useSession();
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [capsLock, setCapsLock] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (session) router.replace(nextPath());
  }, [session, router]);

  const fail = (next: typeof errors) => {
    setErrors(next);
    setShake((value) => value + 1);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL.test(email.trim())) next.email = "Enter a valid work email address.";
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    if (Object.keys(next).length) return fail(next);
    setErrors({});
    setLoading(true);
    window.setTimeout(() => {
      signIn(email.trim().toLowerCase(), remember);
      router.replace(nextPath());
    }, 750);
  };

  const sendReset = (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) return fail({ email: "Enter the email you sign in with." });
    setErrors({});
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setView("sent");
    }, 700);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  return (
    <main className={styles.page}>
      <section className={styles.brandSide} aria-hidden="true">
        <div className={styles.mesh} />
        <div className={styles.brandTop}>
          <Image src="/brand/qiko-logo.png" alt="" width={80} height={32} priority className={styles.logo} />
          <span className={styles.product}>Core</span>
        </div>

        <div className={styles.brandCopy}>
          <span className={styles.eyebrow}>
            <Icon name="sparkles" size={12} /> AI-powered business workspace
          </span>
          <h1>
            Every customer signal,
            <br />
            <span className={styles.gradientText}>turned into your next move.</span>
          </h1>
          <p>Sign-ups, scans and enquiries flow into one CRM — and Qiko tells you who deserves attention today, with the evidence to act on it.</p>
        </div>

        <div className={styles.preview}>
          <div className={`${styles.previewCard} ${styles.previewMain}`}>
            <div className={styles.previewHead}>
              <span className={styles.previewKicker}>Your top priorities</span>
              <span className={styles.live}>
                <i /> Live
              </span>
            </div>
            {[
              ["Review 5 new Signal leads", "Registered in the last 48h", "high"],
              ["Check 3 completed free scans", "2 scored below 60/100", "high"],
              ["Follow up with 2 engaged prospects", "Pricing viewed 3× this week", "medium"],
            ].map(([title, detail, tone], index) => (
              <div className={styles.previewRow} key={title} style={{ animationDelay: `${0.5 + index * 0.18}s` }}>
                <span className={styles.previewNum}>{index + 1}</span>
                <span>
                  <b>{title}</b>
                  <small>{detail}</small>
                </span>
                <span className={`${styles.previewChip} ${tone === "high" ? styles.high : ""}`}>{tone === "high" ? "High" : "Medium"}</span>
              </div>
            ))}
          </div>
          <div className={`${styles.previewCard} ${styles.previewAsk}`}>
            <span className={styles.askOrb}>
              <Icon name="sparkles" size={13} />
            </span>
            <span>
              <b>Ask Qiko</b>
              <small>“Which leads should I follow up with first?”</small>
            </span>
          </div>
          <svg className={styles.flow} viewBox="0 0 300 80" fill="none">
            <path d="M4 60 C 80 60, 90 18, 160 22 S 250 50, 296 12" />
          </svg>
        </div>

        <div className={styles.sources}>
          {["Qiko Signal", "Website", "Free audits", "CRM"].map((source) => (
            <span key={source}>{source}</span>
          ))}
        </div>
      </section>

      <section className={styles.formSide}>
        <div className={styles.cardWrap}>
          <div className={styles.mobileBrand}>
            <Image src="/brand/qiko-logo.png" alt="Qiko" width={70} height={28} priority className={styles.logo} />
            <span className={styles.product}>Core</span>
          </div>

          <div key={`${view}-${shake}`} className={`${styles.card} ${shake && Object.keys(errors).length ? styles.shake : ""}`}>
            {view === "signin" && (
              <form onSubmit={submit} noValidate className={styles.form}>
                <header className={styles.heading}>
                  <h2>Welcome back</h2>
                  <p>Sign in to your Qiko Core workspace.</p>
                </header>

                <label className={styles.field}>
                  <span>Work email</span>
                  <div className={`${styles.control} ${errors.email ? styles.invalid : ""}`}>
                    <Icon name="mail" size={16} />
                    <input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })); }} placeholder="name@company.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} autoFocus />
                  </div>
                  {errors.email && <small id="email-error" className={styles.error}><Icon name="alert" size={12} /> {errors.email}</small>}
                </label>

                <div className={styles.field}>
                  <span className={styles.labelRow}>
                    <label htmlFor="login-password">Password</label>
                    <button type="button" className={styles.link} onClick={() => { setView("forgot"); setErrors({}); }}>Forgot password?</button>
                  </span>
                  <div className={`${styles.control} ${errors.password ? styles.invalid : ""}`}>
                    <Icon name="lock" size={16} />
                    <input type={showPassword ? "text" : "password"} id="login-password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })); }} onKeyUp={onKey} onKeyDown={onKey} placeholder="Enter your password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} />
                    <button type="button" className={styles.reveal} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                    </button>
                  </div>
                  {errors.password && <small id="password-error" className={styles.error}><Icon name="alert" size={12} /> {errors.password}</small>}
                  {capsLock && !errors.password && <small className={styles.hint}><Icon name="info" size={12} /> Caps Lock is on</small>}
                </div>

                <label className={styles.checkbox}>
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  <span className={styles.box}><Icon name="check" size={11} strokeWidth={3} /></span>
                  Keep me signed in on this device
                </label>

                <button type="submit" className={styles.submit} disabled={loading}>
                  {loading ? <><span className={styles.spinner} /> Signing in…</> : <>Sign in <Icon name="arrowRight" size={16} /></>}
                </button>

                <p className={styles.demo}>
                  <Icon name="database" size={13} />
                  <span><b>Demo workspace.</b> Sign in with any work email and a password of 8+ characters. All data is sample data.</span>
                </p>
              </form>
            )}

            {view === "forgot" && (
              <form onSubmit={sendReset} noValidate className={styles.form}>
                <button type="button" className={styles.back} onClick={() => { setView("signin"); setErrors({}); }}>
                  <Icon name="arrowLeft" size={14} /> Back to sign in
                </button>
                <header className={styles.heading}>
                  <h2>Reset your password</h2>
                  <p>Enter your work email and we&apos;ll send you a link to choose a new password.</p>
                </header>
                <label className={styles.field}>
                  <span>Work email</span>
                  <div className={`${styles.control} ${errors.email ? styles.invalid : ""}`}>
                    <Icon name="mail" size={16} />
                    <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" aria-invalid={Boolean(errors.email)} autoFocus />
                  </div>
                  {errors.email && <small className={styles.error}><Icon name="alert" size={12} /> {errors.email}</small>}
                </label>
                <button type="submit" className={styles.submit} disabled={loading}>
                  {loading ? <><span className={styles.spinner} /> Sending…</> : "Send reset link"}
                </button>
              </form>
            )}

            {view === "sent" && (
              <div className={`${styles.form} ${styles.sent}`}>
                <span className={styles.sentIcon}><Icon name="mail" size={22} /></span>
                <header className={styles.heading}>
                  <h2>Check your inbox</h2>
                  <p>If an account exists for <b>{email.trim()}</b>, a reset link is on its way. It expires in 30 minutes.</p>
                </header>
                <p className={styles.demo}>
                  <Icon name="info" size={13} />
                  <span>Demo mode: no email is actually sent.</span>
                </p>
                <button type="button" className={styles.submit} onClick={() => setView("signin")}>Back to sign in</button>
              </div>
            )}
          </div>

          <footer className={styles.footer}>
            <span>© Qiko</span>
            <a href="https://qiko.ai" target="_blank" rel="noreferrer">qiko.ai</a>
            <a href="https://pulse.qiko.ai/privacy" target="_blank" rel="noreferrer">Privacy</a>
            <a href="https://pulse.qiko.ai/terms" target="_blank" rel="noreferrer">Terms</a>
          </footer>
        </div>
      </section>
    </main>
  );
}
