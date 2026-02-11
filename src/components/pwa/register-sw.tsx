"use client";

import { useEffect } from "react";

export function RegisterSW() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }

        if (process.env.NODE_ENV !== "production") {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => {
                    registration.unregister();
                });
            });

            if ("caches" in window) {
                caches.keys().then((keys) => {
                    keys
                        .filter((key) => key.startsWith("cognibook-"))
                        .forEach((key) => {
                            caches.delete(key);
                        });
                });
            }

            return;
        }

        navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
                console.log("[PWA] Service Worker registered:", registration.scope);

                registration.addEventListener("updatefound", () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener("statechange", () => {
                            if (
                                newWorker.state === "installed" &&
                                navigator.serviceWorker.controller
                            ) {
                                console.log("[PWA] New content available, refresh to update.");
                            }
                        });
                    }
                });
            })
            .catch((error) => {
                console.error("[PWA] Service Worker registration failed:", error);
            });
    }, []);

    return null;
}
