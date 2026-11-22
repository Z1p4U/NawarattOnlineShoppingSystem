"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Nawaratt application error", error);
  }, [error]);

  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <span className="recovery-icon"><AlertTriangle /></span>
        <h1>Application ဖွင့်၍မရသေးပါ</h1>
        <p>Internet သို့မဟုတ် Server ချိတ်ဆက်မှု ခဏပြတ်တောက်နိုင်ပါသည်။ ဖြည့်ထားသောအချက်အလက်ကို မဖျက်ဘဲ အရင် ပြန်စမ်းနိုင်ပါသည်။</p>
        <div>
          <button onClick={reset}><RefreshCw size={17} />ပြန်စမ်းရန်</button>
          <button className="secondary" onClick={() => window.location.reload()}>App ပြန်ဖွင့်ရန်</button>
        </div>
        {error.digest && <small>Error ID: {error.digest}</small>}
      </section>
    </main>
  );
}
