// src/context/CurrencyContext.js
import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const CurrencyContext = createContext({});

export const useCurrency = () => useContext(CurrencyContext);

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

export const CurrencyProvider = ({ children }) => {
  const { profile } = useAuth();
  const currencyCode = profile?.currency || 'BWP';
  const currencyInfo = useMemo(() => getCurrencyInfo(currencyCode), [currencyCode]);

  const formatCurrency = useMemo(() => {
    return (amount) => {
      if (amount === null || amount === undefined || isNaN(amount)) return `${currencyInfo.symbol}0.00`;
      const num = parseFloat(amount);
      const noDecimals = ['JPY', 'UGX'].includes(currencyInfo.code);
      try {
        const formatted = new Intl.NumberFormat(currencyInfo.locale, {
          style: 'currency',
          currency: currencyInfo.code,
          minimumFractionDigits: noDecimals ? 0 : 2,
          maximumFractionDigits: noDecimals ? 0 : 2,
        }).format(num);
        if (currencyInfo.code === 'BWP') {
          return formatted.replace('BWP', 'P').replace(/\s+/g, '');
        }
        return formatted;
      } catch {
        const abs = Math.abs(num);
        const sign = num < 0 ? '-' : '';
        const f = noDecimals ? abs.toLocaleString() : abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${sign}${currencyInfo.symbol}${f}`;
      }
    };
  }, [currencyInfo]);

  const value = {
    currencyCode,
    currencyInfo,
    formatCurrency,
    symbol: currencyInfo.symbol,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};
