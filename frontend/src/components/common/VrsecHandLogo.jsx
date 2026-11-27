import React from 'react';

/**
 * VRSEC Hand Symbol Emblem
 * Exact official emblem provided by VRSEC:
 * "Velagapudi Ramakrishna Siddhartha Engineering College Vijayawada"
 * Featuring the iconic hand gesture with lotus flower and "ఆత్మదీపోభవ" inscription.
 */
export default function VrsecHandLogo({ size = 36, className = '', style = {} }) {
  return (
    <img
      src="/vrsec_logo.png"
      alt="VRSEC Official Emblem"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        borderRadius: '50%',
        background: '#ffffff',
        padding: '1px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        ...style,
      }}
    />
  );
}
