"use client";

import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useRef } from "react";

export default function Html5BarcodeScanner({
  onDetected,
}: {
  onDetected: (text: string) => void;
}) {
  const cb = useRef(onDetected);
  cb.current = onDetected;

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "cacss-qr-reader",
      { fps: 8, qrbox: { width: 240, height: 240 } },
      false,
    );
    scanner.render(
      (decodedText) => {
        cb.current(decodedText);
        scanner.clear().catch(() => undefined);
      },
      () => undefined,
    );
    return () => {
      scanner.clear().catch(() => undefined);
    };
  }, []);

  return (
    <div id="cacss-qr-reader" className="w-full max-w-md rounded-xl border bg-muted/40 p-2" />
  );
}
