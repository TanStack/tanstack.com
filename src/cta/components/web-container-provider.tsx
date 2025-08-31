"use client";

import { WebContainer } from "@webcontainer/api";
import { createContext, useEffect, useRef, useState } from "react";

export type WebContainerState = "booting" | "ready" | "none";

export const WebContainerContext = createContext<WebContainer | null>(null);

const crossOriginIsolatedErrorMessage = `Failed to execute 'postMessage' on 'Worker': SharedArrayBuffer transfer requires self.crossOriginIsolated.`;

export default function WebContainerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const webContainerStatus = useRef<WebContainerState>("none");

  const ready = webContainerStatus.current === "ready";

  useEffect(() => {
    if (webContainerStatus.current === "none") {
      webContainerStatus.current = "booting";
      WebContainer.boot()
        .then((webContainer) => {
          setWebContainer(webContainer);
          webContainerStatus.current = "ready";
        })
        .catch((error) => {
          if (!(error instanceof Error)) return;
          if (error.message === crossOriginIsolatedErrorMessage) {
            error.message += `\n\nSee https://webcontainers.io/guides/quickstart#cross-origin-isolation for more information.
              \nTo fix this error, please set the following headers in your server:\nCross-Origin-Embedder-Policy: require-corp\nCross-Origin-Opener-Policy: same-origin`;
            throw error;
          }
        });
    }

    return () => {
      if (ready) {
        webContainer?.teardown();
        webContainerStatus.current = "none";
      }
    };
  }, [ready, webContainer]);

  return (
    <WebContainerContext.Provider value={webContainer}>
      {children}
    </WebContainerContext.Provider>
  );
}