"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("PWA_SERVICE_WORKER_REGISTRATION_FAILED", error);
      }
    };

    window.addEventListener("load", register);
    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
