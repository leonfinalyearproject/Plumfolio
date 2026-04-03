// src/context/CurrencyContext.js
import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

export const CURRENCIES = [
  { code: 'BWP', symbol: 'P', name: 'Botswana Pula', locale: 'en-BW', flag: '🇧🇼' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA', flag: '🇿🇦' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', flag: '🇺🇸' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', flag: '🇬🇧' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', flag: '🇪🇺' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG', flag: '🇳🇬' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE', flag: '🇰🇪' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', locale: 'en-GH', flag: '🇬🇭' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', locale: 'en-TZ', flag: '🇹🇿' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', locale: 'en-UG', flag: '🇺🇬' },
  { code: 'ZMW', symbol: 'ZK', name: 'Zambian Kwacha', locale: 'en-ZM', flag: '🇿🇲' },
  { code: 'NAD', symbol: 'N$', name: 'Namibian Dollar', locale: 'en-NA', flag: '🇳🇦' },
  { code: 'MWK', symbol: 'MK', name: 'Malawian Kwacha', locale: 'en-MW', flag: '🇲🇼' },
  { code: 'LSL', symbol: 'L', name: 'Lesotho Loti', locale: 'en-LS', flag: '🇱🇸' },
  { code: 'SZL', symbol: 'E', name: 'Eswatini Lilangeni', locale: 'en-SZ', flag: '🇸🇿' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', flag: '🇦🇺' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', flag: '🇮🇳' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', flag: '🇨🇳' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', flag: '🇯🇵' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR', flag: '🇧🇷' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', locale: 'ar-AE', flag: '🇦🇪' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', locale: 'en-EG', flag: '🇪🇬' },
];

export const getCurrencyInfo = (code) => {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
};

// Standalone format function — no hooks, no closures
export const formatAmount = (amount, currencyCode) => {
  const info = getCurrencyInfo(currencyCode);
  if (amount === null || amount === undefined || isNaN(amount)) {
    return info.symbol + '0.00';
  }
  const num = parseFloat(amount);
  const noDecimals = currencyCode === 'JPY' || currencyCode === 'UGX';
  try {
    const formatted = new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    }).format(num);
    if (info.code === 'BWP') {
      return formatted.replace('BWP', 'P').replace(/\s+/g, '');
    }
    return formatted;
  } catch (err) {
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (noDecimals) {
      return sign + info.symbol + Math.round(abs).toLocaleString();
    }
    return sign + info.symbol + abs.toFixed(2);
  }
};

// Default format for BWP
const defaultFormat = (amount) => formatAmount(amount, 'BWP');

const CurrencyContext = createContext({
  currencyCode: 'BWP',
  currencyInfo: CURRENCIES[0],
  formatCurrency: defaultFormat,
  symbol: 'P',
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
  const { profile } = useAuth();
  
  // Read currency from profile — this updates when profile state changes
  const code = (profile && profile.currency) || 'BWP';
  const info = getCurrencyInfo(code);
  
  // Build formatter for current currency — new function each render is fine
  // because it ensures we always use the latest currency code
  const formatCurrency = (amount) => formatAmount(amount, code);

  return (
    <CurrencyContext.Provider value={{
      currencyCode: code,
      currencyInfo: info,
      formatCurrency: formatCurrency,
      symbol: info.symbol,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};
