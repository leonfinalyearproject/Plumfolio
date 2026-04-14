import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

// Exchange rate cache
let ratesCache = { rates: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const fetchRates = async () => {
  const now = Date.now();
  if (ratesCache.rates && (now - ratesCache.timestamp) < CACHE_TTL) {
    return ratesCache.rates;
  }
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/bwp.min.json');
    if (res.ok) {
      const data = await res.json();
      if (data && data.bwp) {
        ratesCache = { rates: data.bwp, timestamp: now };
        return data.bwp;
      }
    }
  } catch (e) {
    // silent fail
  }
  try {
    const res2 = await fetch('https://latest.currency-api.pages.dev/v1/currencies/bwp.min.json');
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && data2.bwp) {
        ratesCache = { rates: data2.bwp, timestamp: now };
        return data2.bwp;
      }
    }
  } catch (e2) {
    // silent fail
  }
  return null;
};

const formatNum = (amount, info) => {
  const noDecimals = info.code === 'JPY' || info.code === 'UGX';
  try {
    const formatted = new Intl.NumberFormat(info.locale, {
      style: 'currency', currency: info.code,
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    }).format(amount);
    if (info.code === 'BWP') return formatted.replace('BWP', 'P').replace(/\s+/g, '');
    return formatted;
  } catch (e) {
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);
    return sign + info.symbol + (noDecimals ? Math.round(abs).toLocaleString() : abs.toFixed(2));
  }
};

const defaultFmt = (amt) => {
  if (amt === null || amt === undefined || isNaN(amt)) return 'P0.00';
  return formatNum(parseFloat(amt), CURRENCIES[0]);
};

const CurrencyContext = createContext({
  currencyCode: 'BWP',
  currencyInfo: CURRENCIES[0],
  formatCurrency: defaultFmt,
  symbol: 'P',
  rate: 1,
  ratesLoaded: false,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
  const { profile } = useAuth();
  const code = (profile && profile.currency) || 'BWP';
  const info = getCurrencyInfo(code);
  const [rate, setRate] = useState(1);
  const [ratesLoaded, setRatesLoaded] = useState(code === 'BWP');
  const [allRates, setAllRates] = useState(null); // full BWP → X rate table

  useEffect(() => {
    let cancelled = false;

    // Always load rates (even if display is BWP) so imports can convert
    fetchRates().then((rates) => {
      if (cancelled) return;
      if (rates) setAllRates(rates);
      if (code === 'BWP') {
        setRate(1);
        setRatesLoaded(true);
      } else {
        if (rates && rates[code.toLowerCase()]) {
          setRate(rates[code.toLowerCase()]);
        } else {
          setRate(1);
        }
        setRatesLoaded(true);
      }
    });

    return () => { cancelled = true; };
  }, [code]);

  const formatCurrency = useCallback((bwpAmount) => {
    if (bwpAmount === null || bwpAmount === undefined || isNaN(bwpAmount)) {
      return info.symbol + '0.00';
    }
    const converted = parseFloat(bwpAmount) * rate;
    return formatNum(converted, info);
  }, [rate, info]);

  /** Convert an amount from `fromCode` (ISO) to BWP (what we store). */
  const convertToBwp = useCallback((amount, fromCode) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 0;
    const n = parseFloat(amount);
    if (!fromCode || fromCode.toUpperCase() === 'BWP') return n;
    if (!allRates) return n; // no rates loaded; fail open (store as-is)
    const r = allRates[fromCode.toLowerCase()];
    if (!r || r === 0) return n;
    return n / r;
  }, [allRates]);

  /** Convenience: get a specific BWP → X rate */
  const getRate = useCallback((toCode) => {
    if (!toCode || toCode.toUpperCase() === 'BWP') return 1;
    if (!allRates) return null;
    return allRates[toCode.toLowerCase()] || null;
  }, [allRates]);

  return (
    <CurrencyContext.Provider value={{
      currencyCode: code,
      currencyInfo: info,
      formatCurrency,
      symbol: info.symbol,
      rate,
      ratesLoaded,
      convertToBwp,
      getRate,
      allRates,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};
