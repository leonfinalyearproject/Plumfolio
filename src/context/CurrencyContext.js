// src/context/CurrencyContext.js
// All data in Supabase is stored in BWP (base currency).
// When user selects a different display currency, we convert using live exchange rates.

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
  return CURRENCIES.find(function(c) { return c.code === code; }) || CURRENCIES[0];
};

// ---- Exchange Rate Cache ----
var ratesCache = { rates: null, timestamp: 0, base: '' };
var CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function fetchExchangeRates(baseCurrency) {
  var now = Date.now();
  // Return cached if fresh and same base
  if (ratesCache.rates && ratesCache.base === baseCurrency && (now - ratesCache.timestamp) < CACHE_DURATION) {
    return ratesCache.rates;
  }

  var base = baseCurrency.toLowerCase();
  
  // Try primary CDN
  try {
    var url = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/' + base + '.min.json';
    var response = await fetch(url);
    if (response.ok) {
      var data = await response.json();
      if (data && data[base]) {
        ratesCache = { rates: data[base], timestamp: now, base: baseCurrency };
        return data[base];
      }
    }
  } catch (e) {
    console.warn('Primary exchange rate fetch failed:', e);
  }

  // Try fallback CDN
  try {
    var fallbackUrl = 'https://latest.currency-api.pages.dev/v1/currencies/' + base + '.min.json';
    var fallbackResponse = await fetch(fallbackUrl);
    if (fallbackResponse.ok) {
      var fallbackData = await fallbackResponse.json();
      if (fallbackData && fallbackData[base]) {
        ratesCache = { rates: fallbackData[base], timestamp: now, base: baseCurrency };
        return fallbackData[base];
      }
    }
  } catch (e) {
    console.warn('Fallback exchange rate fetch failed:', e);
  }

  return null;
}

// ---- Format amount with proper locale ----
function formatWithLocale(amount, info) {
  var noDecimals = info.code === 'JPY' || info.code === 'UGX';
  try {
    var formatted = new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    }).format(amount);
    if (info.code === 'BWP') {
      return formatted.replace('BWP', 'P').replace(/\s+/g, '');
    }
    return formatted;
  } catch (err) {
    var abs = Math.abs(amount);
    var sign = amount < 0 ? '-' : '';
    if (noDecimals) return sign + info.symbol + Math.round(abs).toLocaleString();
    return sign + info.symbol + abs.toFixed(2);
  }
}

// ---- Default BWP formatter ----
var defaultFormat = function(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'P0.00';
  return formatWithLocale(parseFloat(amount), CURRENCIES[0]);
};

var CurrencyContext = createContext({
  currencyCode: 'BWP',
  currencyInfo: CURRENCIES[0],
  formatCurrency: defaultFormat,
  convertFromBWP: function(amount) { return amount; },
  symbol: 'P',
  rate: 1,
  ratesLoaded: false,
});

export var useCurrency = function() { return useContext(CurrencyContext); };

export var CurrencyProvider = function(props) {
  var auth = useAuth();
  var profile = auth.profile;
  var code = (profile && profile.currency) || 'BWP';
  var info = getCurrencyInfo(code);

  var stateArr = useState(1);
  var rate = stateArr[0];
  var setRate = stateArr[1];

  var loadedArr = useState(false);
  var ratesLoaded = loadedArr[0];
  var setRatesLoaded = loadedArr[1];

  // Fetch exchange rate when currency changes
  useEffect(function() {
    if (code === 'BWP') {
      setRate(1);
      setRatesLoaded(true);
      return;
    }

    var cancelled = false;

    fetchExchangeRates('bwp').then(function(rates) {
      if (cancelled) return;
      if (rates) {
        var targetCode = code.toLowerCase();
        if (rates[targetCode]) {
          console.log('Exchange rate BWP->' + code + ':', rates[targetCode]);
          setRate(rates[targetCode]);
          setRatesLoaded(true);
        } else {
          console.warn('No rate found for', code);
          setRate(1);
          setRatesLoaded(true);
        }
      } else {
        console.warn('Could not fetch exchange rates');
        setRate(1);
        setRatesLoaded(true);
      }
    });

    return function() { cancelled = true; };
  }, [code]);

  // Convert BWP amount to display currency
  var convertFromBWP = useCallback(function(bwpAmount) {
    if (bwpAmount === null || bwpAmount === undefined || isNaN(bwpAmount)) return 0;
    return parseFloat(bwpAmount) * rate;
  }, [rate]);

  // Format: convert from BWP then format with locale
  var formatCurrency = useCallback(function(bwpAmount) {
    if (bwpAmount === null || bwpAmount === undefined || isNaN(bwpAmount)) {
      return info.symbol + '0.00';
    }
    var converted = parseFloat(bwpAmount) * rate;
    return formatWithLocale(converted, info);
  }, [rate, info]);

  var value = {
    currencyCode: code,
    currencyInfo: info,
    formatCurrency: formatCurrency,
    convertFromBWP: convertFromBWP,
    symbol: info.symbol,
    rate: rate,
    ratesLoaded: ratesLoaded,
  };

  return React.createElement(
    CurrencyContext.Provider,
    { value: value },
    props.children
  );
};
