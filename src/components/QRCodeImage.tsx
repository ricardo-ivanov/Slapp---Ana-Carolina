import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface QRCodeImageProps {
  text: string;
  size?: number;
  className?: string;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

export function QRCodeImage({
  text,
  size = 300,
  className = '',
  margin = 1,
  darkColor = '#181445',
  lightColor = '#ffffff',
}: QRCodeImageProps) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(text, {
      margin,
      width: size,
      color: {
        dark: darkColor,
        light: lightColor,
      },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });

    return () => {
      active = false;
    };
  }, [text, size, margin, darkColor, lightColor]);

  if (!src) {
    return (
      <div 
        className={`animate-pulse bg-gray-10/50 rounded-xl flex items-center justify-center ${className}`}
        style={{ width: size ? `${size}px` : '100%', height: size ? `${size}px` : '100%' }}
      >
        <span className="text-[#777587] text-xs font-medium">Gerando...</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      className={className}
      alt={`QR Code para ${text}`}
      referrerPolicy="no-referrer"
    />
  );
}
