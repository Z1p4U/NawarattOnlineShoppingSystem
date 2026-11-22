"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

export default function ConnectionStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <aside className="connection-banner" role="alert">
      <WifiOff size={17} />
      <span><strong>Internet ပြတ်တောက်နေပါသည်</strong><small>အချက်အလက်အသစ်များကို သိမ်း၍မရသေးပါ</small></span>
      <button onClick={() => window.location.reload()}><RefreshCw size={15} />ပြန်စမ်းရန်</button>
    </aside>
  );
}
