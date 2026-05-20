"use client";

import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
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
      {
        fps: 10,
        qrbox: { width: 280, height: 160 },
        rememberLastUsedCamera: true,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      },
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
    <div
      id="cacss-qr-reader"
      className="w-full max-w-lg rounded-xl border bg-muted/40 p-2"
    />
  );
}
