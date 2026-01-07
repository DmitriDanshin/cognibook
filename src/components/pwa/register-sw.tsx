"use client";

import { useEffect } from "react";

export function RegisterSW() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            // Регистрируем SW и в dev, и в prod режимах
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("[PWA] Service Worker registered:", registration.scope);

                    // Проверяем обновления
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
        }
    }, []);

    return null;
}
