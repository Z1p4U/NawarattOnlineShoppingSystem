"use client";

import { Download, Monitor, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<"windows" | "android" | "ios" | "other">("other");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => undefined);
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setInstalled(standalone);
    const userAgent = navigator.userAgent.toLowerCase();
    const appleMobile = /iphone|ipad|ipod/.test(userAgent) || (userAgent.includes("macintosh") && navigator.maxTouchPoints > 1);
    setPlatform(userAgent.includes("windows") ? "windows" : userAgent.includes("android") ? "android" : appleMobile ? "ios" : "other");
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => { setInstalled(true); setInstallPrompt(null); setShowHelp(false); };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) { setShowHelp(true); return; }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  if (installed) return null;
  const isWindows = platform === "windows";
  const isIos = platform === "ios";
  const buttonLabel = isWindows ? "Windows App Install" : platform === "android" ? "Android App Install" : isIos ? "iPhone App Install" : "Nawaratt App Install";
  return <>
    <button className="install-app-button" onClick={() => void install()} aria-label={buttonLabel}><Download size={18} /><span>{buttonLabel}</span></button>
    {showHelp && <div className="install-help-backdrop" onMouseDown={() => setShowHelp(false)}><section className="install-help" onMouseDown={(event) => event.stopPropagation()}>
      <button className="install-help-close" onClick={() => setShowHelp(false)} aria-label="Close"><X /></button>
      <span className="install-help-icon">{isWindows ? <Monitor /> : <Smartphone />}</span>
      {isWindows ? <>
        <h2>Windows Computer မှာ Install လုပ်ရန်</h2>
        <ol>
          <li>ဒီ Link ကို <b>Microsoft Edge</b> သို့မဟုတ် <b>Google Chrome</b> ဖြင့်ဖွင့်ပါ</li>
          <li>Address Bar ညာဘက်ရှိ <b>Install App</b> icon ကိုနှိပ်ပါ</li>
          <li>Icon မတွေ့ပါက Edge မှာ <b>… → Apps → Install Nawaratt</b> ကိုရွေးပါ</li>
          <li><b>Install</b> ကိုနှိပ်ပြီး Desktop / Start Menu မှာ အသုံးပြုပါ</li>
        </ol>
        <p>Install ပြီးလျှင် Nawaratt ကို Windows App တစ်ခုလို သီးခြား Window ဖြင့် ဖွင့်နိုင်ပါမယ်။ ဖုန်းနဲ့တူညီတဲ့ Login နဲ့ Data ကို အသုံးပြုနိုင်ပါတယ်။</p>
      </> : isIos ? <>
        <h2>iPhone / iPad မှာ Install လုပ်ရန်</h2>
        <ol><li>ဒီ Link ကို <b>Safari</b> ဖြင့်ဖွင့်ပါ</li><li>အောက်ဘက်ရှိ <b>Share</b> icon ကိုနှိပ်ပါ</li><li><b>Add to Home Screen</b> ကိုရွေးပါ</li><li><b>Add</b> ကိုနှိပ်ပါ</li></ol>
        <p>Install ပြီးလျှင် ဖုန်း Home Screen မှာ Nawaratt App Icon ပေါ်လာပြီး App တစ်ခုလို ဖွင့်နိုင်ပါမယ်။</p>
      </> : <>
        <h2>Android ဖုန်းမှာ Install လုပ်ရန်</h2>
        <ol><li>ဒီ Link ကို <b>Google Chrome</b> ဖြင့်ဖွင့်ပါ</li><li>ညာဘက်အပေါ်ထောင့်က <b>⋮ Menu</b> ကိုနှိပ်ပါ</li><li><b>Install app</b> သို့မဟုတ် <b>Add to Home screen</b> ကိုရွေးပါ</li><li><b>Install</b> ကိုနှိပ်ပါ</li></ol>
        <p>Install ပြီးလျှင် ဖုန်း Home Screen မှာ Nawaratt App Icon ပေါ်လာပါမယ်။</p>
      </>}
    </section></div>}
  </>;
}
