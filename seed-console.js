// =============================================================
// SEED SCRIPT — paste into browser console while logged into
// leonfinalyearproject.github.io/Plumfolio
// Covers: Jan 2024 – Apr 2026 (28 months of data)
// =============================================================
(async () => {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const supabase = createClient(
    'https://xcjbpexnunryepzcimoh.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjamJwZXhudW5yeWVwemNpbW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTE3NDYsImV4cCI6MjA4NTM4Nzc0Nn0.N1nNgILE_sRFJbsi7cM8_cFh62kWtqis9Krwq3JlZZA'
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.error('NOT LOGGED IN — log in first'); return; }
  const UID = session.user.id;
  console.log('Seeding for user:', UID);

  console.log('Clearing old data...');
  await supabase.from('transactions').delete().eq('user_id', UID);
  await supabase.from('budgets').delete().eq('user_id', UID);
  await supabase.from('savings_goals').delete().eq('user_id', UID);
  console.log('Cleared.');

  // ============================================================
  // HELPER — build one month of transactions
  // ============================================================
  const u = (t) => ({ ...t, user_id: UID });

  const tx = [

    // ================================================================
    // 2024
    // ================================================================

    // JAN 2024
    u({ type:'income', amount:17500, description:'Monthly Salary', category:'Income', date:'2024-01-02' }),
    u({ type:'expense', amount:5000, description:'Rent Payment', category:'Housing', date:'2024-01-03' }),
    u({ type:'expense', amount:620, description:'BPC Electricity', category:'Utilities', date:'2024-01-04' }),
    u({ type:'expense', amount:380, description:'Water Utilities', category:'Utilities', date:'2024-01-04' }),
    u({ type:'expense', amount:1700, description:'Choppies Groceries', category:'Groceries', date:'2024-01-06' }),
    u({ type:'expense', amount:320, description:'Nandos Lunch', category:'Food & Dining', date:'2024-01-08' }),
    u({ type:'expense', amount:980, description:'Car Fuel - Shell', category:'Transportation', date:'2024-01-09' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-01-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-01-14' }),
    u({ type:'expense', amount:1400, description:'Spar Monthly Shop', category:'Groceries', date:'2024-01-19' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-01-21' }),
    u({ type:'expense', amount:280, description:'Clicks Pharmacy', category:'Personal Care', date:'2024-01-23' }),
    u({ type:'expense', amount:480, description:'Woolworths Clothing', category:'Shopping', date:'2024-01-27' }),
    u({ type:'expense', amount:220, description:'Wimpy Breakfast', category:'Food & Dining', date:'2024-01-29' }),

    // FEB 2024
    u({ type:'income', amount:17500, description:'Monthly Salary', category:'Income', date:'2024-02-02' }),
    u({ type:'income', amount:2200, description:'Freelance Project', category:'Income', date:'2024-02-20' }),
    u({ type:'expense', amount:5000, description:'Rent Payment', category:'Housing', date:'2024-02-03' }),
    u({ type:'expense', amount:590, description:'BPC Electricity', category:'Utilities', date:'2024-02-04' }),
    u({ type:'expense', amount:380, description:'Water Utilities', category:'Utilities', date:'2024-02-04' }),
    u({ type:'expense', amount:1800, description:'Choppies Groceries', category:'Groceries', date:'2024-02-06' }),
    u({ type:'expense', amount:980, description:'Car Fuel - Engen', category:'Transportation', date:'2024-02-08' }),
    u({ type:'expense', amount:750, description:'Valentines Dinner', category:'Food & Dining', date:'2024-02-14' }),
    u({ type:'expense', amount:500, description:'Valentines Gift', category:'Gifts & Donations', date:'2024-02-14' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-02-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-02-14' }),
    u({ type:'expense', amount:1350, description:'Spar Monthly Shop', category:'Groceries', date:'2024-02-18' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-02-21' }),
    u({ type:'expense', amount:310, description:'Clicks Toiletries', category:'Personal Care', date:'2024-02-25' }),

    // MAR 2024
    u({ type:'income', amount:17500, description:'Monthly Salary', category:'Income', date:'2024-03-02' }),
    u({ type:'expense', amount:5000, description:'Rent Payment', category:'Housing', date:'2024-03-03' }),
    u({ type:'expense', amount:640, description:'BPC Electricity', category:'Utilities', date:'2024-03-04' }),
    u({ type:'expense', amount:380, description:'Water Utilities', category:'Utilities', date:'2024-03-04' }),
    u({ type:'expense', amount:1750, description:'Choppies Groceries', category:'Groceries', date:'2024-03-06' }),
    u({ type:'expense', amount:240, description:'Debonairs Pizza', category:'Food & Dining', date:'2024-03-08' }),
    u({ type:'expense', amount:1050, description:'Car Fuel - Shell', category:'Transportation', date:'2024-03-11' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-03-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-03-14' }),
    u({ type:'expense', amount:1400, description:'Spar Monthly Shop', category:'Groceries', date:'2024-03-17' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-03-20' }),
    u({ type:'expense', amount:2200, description:'Car Insurance Annual', category:'Transportation', date:'2024-03-22' }),
    u({ type:'expense', amount:800, description:'Game Electronics', category:'Shopping', date:'2024-03-25' }),
    u({ type:'expense', amount:350, description:'Primi Piatti Dinner', category:'Food & Dining', date:'2024-03-29' }),

    // APR 2024
    u({ type:'income', amount:17500, description:'Monthly Salary', category:'Income', date:'2024-04-02' }),
    u({ type:'income', amount:1800, description:'Side Hustle Payment', category:'Income', date:'2024-04-15' }),
    u({ type:'expense', amount:5000, description:'Rent Payment', category:'Housing', date:'2024-04-03' }),
    u({ type:'expense', amount:600, description:'BPC Electricity', category:'Utilities', date:'2024-04-04' }),
    u({ type:'expense', amount:380, description:'Water Utilities', category:'Utilities', date:'2024-04-04' }),
    u({ type:'expense', amount:1850, description:'Choppies Groceries', category:'Groceries', date:'2024-04-06' }),
    u({ type:'expense', amount:280, description:'KFC Lunch', category:'Food & Dining', date:'2024-04-09' }),
    u({ type:'expense', amount:1000, description:'Car Fuel - Engen', category:'Transportation', date:'2024-04-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-04-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-04-14' }),
    u({ type:'expense', amount:1450, description:'Spar Monthly Shop', category:'Groceries', date:'2024-04-19' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-04-22' }),
    u({ type:'expense', amount:650, description:'Edgars Clothing', category:'Shopping', date:'2024-04-25' }),
    u({ type:'expense', amount:290, description:'Clicks Pharmacy', category:'Personal Care', date:'2024-04-27' }),

    // MAY 2024
    u({ type:'income', amount:17500, description:'Monthly Salary', category:'Income', date:'2024-05-02' }),
    u({ type:'expense', amount:5000, description:'Rent Payment', category:'Housing', date:'2024-05-03' }),
    u({ type:'expense', amount:580, description:'BPC Electricity', category:'Utilities', date:'2024-05-04' }),
    u({ type:'expense', amount:380, description:'Water Utilities', category:'Utilities', date:'2024-05-04' }),
    u({ type:'expense', amount:1900, description:'Choppies Groceries', category:'Groceries', date:'2024-05-06' }),
    u({ type:'expense', amount:180, description:'Mugg & Bean Coffee', category:'Food & Dining', date:'2024-05-08' }),
    u({ type:'expense', amount:1100, description:'Car Fuel - Shell', category:'Transportation', date:'2024-05-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-05-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-05-14' }),
    u({ type:'expense', amount:1500, description:'Spar Monthly Shop', category:'Groceries', date:'2024-05-19' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-05-22' }),
    u({ type:'expense', amount:420, description:'Mothers Day Gift', category:'Gifts & Donations', date:'2024-05-12' }),
    u({ type:'expense', amount:340, description:'Ocean Basket Dinner', category:'Food & Dining', date:'2024-05-24' }),
    u({ type:'expense', amount:290, description:'Clicks Toiletries', category:'Personal Care', date:'2024-05-28' }),

    // JUN 2024
    u({ type:'income', amount:17500, description:'Monthly Salary', category:'Income', date:'2024-06-02' }),
    u({ type:'income', amount:3500, description:'Freelance Design', category:'Income', date:'2024-06-18' }),
    u({ type:'expense', amount:5000, description:'Rent Payment', category:'Housing', date:'2024-06-03' }),
    u({ type:'expense', amount:700, description:'BPC Electricity', category:'Utilities', date:'2024-06-04' }),
    u({ type:'expense', amount:380, description:'Water Utilities', category:'Utilities', date:'2024-06-04' }),
    u({ type:'expense', amount:1800, description:'Choppies Groceries', category:'Groceries', date:'2024-06-06' }),
    u({ type:'expense', amount:1050, description:'Car Fuel - Engen', category:'Transportation', date:'2024-06-09' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-06-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-06-14' }),
    u({ type:'expense', amount:1600, description:'Spar Monthly Shop', category:'Groceries', date:'2024-06-17' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-06-20' }),
    u({ type:'expense', amount:900, description:'Woolworths Winter Clothes', category:'Shopping', date:'2024-06-22' }),
    u({ type:'expense', amount:380, description:'Spur Family Dinner', category:'Food & Dining', date:'2024-06-28' }),
    u({ type:'expense', amount:1200, description:'Online Course', category:'Education', date:'2024-06-25' }),

    // JUL 2024
    u({ type:'income', amount:17500, description:'Monthly Salary', category:'Income', date:'2024-07-02' }),
    u({ type:'expense', amount:5000, description:'Rent Payment', category:'Housing', date:'2024-07-03' }),
    u({ type:'expense', amount:720, description:'BPC Electricity', category:'Utilities', date:'2024-07-04' }),
    u({ type:'expense', amount:380, description:'Water Utilities', category:'Utilities', date:'2024-07-04' }),
    u({ type:'expense', amount:1750, description:'Choppies Groceries', category:'Groceries', date:'2024-07-06' }),
    u({ type:'expense', amount:300, description:'Nandos Lunch', category:'Food & Dining', date:'2024-07-08' }),
    u({ type:'expense', amount:1100, description:'Car Fuel - Shell', category:'Transportation', date:'2024-07-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-07-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-07-14' }),
    u({ type:'expense', amount:1450, description:'Spar Monthly Shop', category:'Groceries', date:'2024-07-18' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-07-21' }),
    u({ type:'expense', amount:550, description:'Mr Price Clothing', category:'Shopping', date:'2024-07-24' }),
    u({ type:'expense', amount:300, description:'Clicks Pharmacy', category:'Personal Care', date:'2024-07-27' }),

    // AUG 2024
    u({ type:'income', amount:17500, description:'Monthly Salary', category:'Income', date:'2024-08-02' }),
    u({ type:'income', amount:2800, description:'Tutoring Income', category:'Income', date:'2024-08-16' }),
    u({ type:'expense', amount:5000, description:'Rent Payment', category:'Housing', date:'2024-08-03' }),
    u({ type:'expense', amount:660, description:'BPC Electricity', category:'Utilities', date:'2024-08-04' }),
    u({ type:'expense', amount:380, description:'Water Utilities', category:'Utilities', date:'2024-08-04' }),
    u({ type:'expense', amount:1850, description:'Choppies Groceries', category:'Groceries', date:'2024-08-06' }),
    u({ type:'expense', amount:1080, description:'Car Fuel - Engen', category:'Transportation', date:'2024-08-08' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-08-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-08-14' }),
    u({ type:'expense', amount:1500, description:'Spar Monthly Shop', category:'Groceries', date:'2024-08-19' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-08-21' }),
    u({ type:'expense', amount:420, description:'Steers Family Meal', category:'Food & Dining', date:'2024-08-23' }),
    u({ type:'expense', amount:1600, description:'New Phone Accessories', category:'Shopping', date:'2024-08-26' }),
    u({ type:'expense', amount:280, description:'Clicks Toiletries', category:'Personal Care', date:'2024-08-29' }),

    // SEP 2024
    u({ type:'income', amount:18000, description:'Monthly Salary', category:'Income', date:'2024-09-02' }),
    u({ type:'expense', amount:5200, description:'Rent Payment', category:'Housing', date:'2024-09-03' }),
    u({ type:'expense', amount:610, description:'BPC Electricity', category:'Utilities', date:'2024-09-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2024-09-04' }),
    u({ type:'expense', amount:1900, description:'Choppies Groceries', category:'Groceries', date:'2024-09-06' }),
    u({ type:'expense', amount:260, description:'Ocean Basket Lunch', category:'Food & Dining', date:'2024-09-09' }),
    u({ type:'expense', amount:1100, description:'Car Fuel - Shell', category:'Transportation', date:'2024-09-11' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-09-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-09-14' }),
    u({ type:'expense', amount:1550, description:'Spar Monthly Shop', category:'Groceries', date:'2024-09-18' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-09-20' }),
    u({ type:'expense', amount:880, description:'Edgars Spring Clothes', category:'Shopping', date:'2024-09-23' }),
    u({ type:'expense', amount:320, description:'Clicks Pharmacy', category:'Personal Care', date:'2024-09-26' }),
    u({ type:'expense', amount:800, description:'Church Tithe', category:'Gifts & Donations', date:'2024-09-29' }),

    // OCT 2024
    u({ type:'income', amount:18000, description:'Monthly Salary', category:'Income', date:'2024-10-02' }),
    u({ type:'income', amount:4000, description:'Freelance Web Project', category:'Income', date:'2024-10-22' }),
    u({ type:'expense', amount:5200, description:'Rent Payment', category:'Housing', date:'2024-10-03' }),
    u({ type:'expense', amount:630, description:'BPC Electricity', category:'Utilities', date:'2024-10-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2024-10-04' }),
    u({ type:'expense', amount:1950, description:'Choppies Groceries', category:'Groceries', date:'2024-10-06' }),
    u({ type:'expense', amount:350, description:'Wimpy Family Breakfast', category:'Food & Dining', date:'2024-10-08' }),
    u({ type:'expense', amount:1150, description:'Car Fuel - Engen', category:'Transportation', date:'2024-10-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-10-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-10-14' }),
    u({ type:'expense', amount:1600, description:'Spar Monthly Shop', category:'Groceries', date:'2024-10-18' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-10-21' }),
    u({ type:'expense', amount:600, description:'Mr Price Clothing', category:'Shopping', date:'2024-10-24' }),
    u({ type:'expense', amount:350, description:'Clicks Toiletries', category:'Personal Care', date:'2024-10-27' }),

    // NOV 2024
    u({ type:'income', amount:18000, description:'Monthly Salary', category:'Income', date:'2024-11-02' }),
    u({ type:'expense', amount:5200, description:'Rent Payment', category:'Housing', date:'2024-11-03' }),
    u({ type:'expense', amount:650, description:'BPC Electricity', category:'Utilities', date:'2024-11-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2024-11-04' }),
    u({ type:'expense', amount:2000, description:'Choppies Groceries', category:'Groceries', date:'2024-11-06' }),
    u({ type:'expense', amount:300, description:'Debonairs Pizza', category:'Food & Dining', date:'2024-11-08' }),
    u({ type:'expense', amount:1200, description:'Car Fuel - Shell', category:'Transportation', date:'2024-11-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-11-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-11-14' }),
    u({ type:'expense', amount:1700, description:'Spar Monthly Shop', category:'Groceries', date:'2024-11-18' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-11-21' }),
    u({ type:'expense', amount:1200, description:'Black Friday Shopping', category:'Shopping', date:'2024-11-29' }),
    u({ type:'expense', amount:700, description:'Christmas Gifts', category:'Gifts & Donations', date:'2024-11-28' }),
    u({ type:'expense', amount:310, description:'Clicks Pharmacy', category:'Personal Care', date:'2024-11-25' }),

    // DEC 2024
    u({ type:'income', amount:18000, description:'Monthly Salary', category:'Income', date:'2024-12-02' }),
    u({ type:'income', amount:3000, description:'Year End Bonus', category:'Income', date:'2024-12-15' }),
    u({ type:'expense', amount:5200, description:'Rent Payment', category:'Housing', date:'2024-12-03' }),
    u({ type:'expense', amount:680, description:'BPC Electricity', category:'Utilities', date:'2024-12-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2024-12-04' }),
    u({ type:'expense', amount:2200, description:'Choppies Christmas Shop', category:'Groceries', date:'2024-12-06' }),
    u({ type:'expense', amount:580, description:'Christmas Dinner Out', category:'Food & Dining', date:'2024-12-25' }),
    u({ type:'expense', amount:1300, description:'Car Fuel - Engen', category:'Transportation', date:'2024-12-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2024-12-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2024-12-14' }),
    u({ type:'expense', amount:1900, description:'Spar Festive Shop', category:'Groceries', date:'2024-12-20' }),
    u({ type:'expense', amount:750, description:'Virgin Active Gym', category:'Health & Fitness', date:'2024-12-05' }),
    u({ type:'expense', amount:1800, description:'Christmas Gifts Family', category:'Gifts & Donations', date:'2024-12-20' }),
    u({ type:'expense', amount:1400, description:'Woolworths Festive Clothes', category:'Shopping', date:'2024-12-18' }),
    u({ type:'expense', amount:350, description:'Clicks Pharmacy', category:'Personal Care', date:'2024-12-12' }),

    // ================================================================
    // 2025
    // ================================================================

    // JAN 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-01-02' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-01-03' }),
    u({ type:'expense', amount:640, description:'BPC Electricity', category:'Utilities', date:'2025-01-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-01-04' }),
    u({ type:'expense', amount:1900, description:'Choppies Groceries', category:'Groceries', date:'2025-01-06' }),
    u({ type:'expense', amount:280, description:'Nandos Lunch', category:'Food & Dining', date:'2025-01-08' }),
    u({ type:'expense', amount:1100, description:'Car Fuel - Shell', category:'Transportation', date:'2025-01-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-01-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-01-14' }),
    u({ type:'expense', amount:1600, description:'Spar Monthly Shop', category:'Groceries', date:'2025-01-19' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-01-21' }),
    u({ type:'expense', amount:350, description:'Clicks Pharmacy', category:'Personal Care', date:'2025-01-24' }),
    u({ type:'expense', amount:600, description:'New Year Celebration', category:'Entertainment', date:'2025-01-01' }),
    u({ type:'expense', amount:500, description:'Edgars Clothing', category:'Shopping', date:'2025-01-27' }),

    // FEB 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-02-02' }),
    u({ type:'income', amount:2500, description:'Freelance Project', category:'Income', date:'2025-02-19' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-02-03' }),
    u({ type:'expense', amount:600, description:'BPC Electricity', category:'Utilities', date:'2025-02-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-02-04' }),
    u({ type:'expense', amount:1950, description:'Choppies Groceries', category:'Groceries', date:'2025-02-06' }),
    u({ type:'expense', amount:1100, description:'Car Fuel - Engen', category:'Transportation', date:'2025-02-08' }),
    u({ type:'expense', amount:900, description:'Valentines Dinner', category:'Food & Dining', date:'2025-02-14' }),
    u({ type:'expense', amount:650, description:'Valentines Gift', category:'Gifts & Donations', date:'2025-02-14' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-02-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-02-14' }),
    u({ type:'expense', amount:1550, description:'Spar Monthly Shop', category:'Groceries', date:'2025-02-19' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-02-21' }),
    u({ type:'expense', amount:320, description:'Clicks Toiletries', category:'Personal Care', date:'2025-02-26' }),

    // MAR 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-03-02' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-03-03' }),
    u({ type:'expense', amount:660, description:'BPC Electricity', category:'Utilities', date:'2025-03-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-03-04' }),
    u({ type:'expense', amount:2000, description:'Choppies Groceries', category:'Groceries', date:'2025-03-06' }),
    u({ type:'expense', amount:300, description:'Wimpy Breakfast', category:'Food & Dining', date:'2025-03-07' }),
    u({ type:'expense', amount:1150, description:'Car Fuel - Shell', category:'Transportation', date:'2025-03-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-03-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-03-14' }),
    u({ type:'expense', amount:1600, description:'Spar Monthly Shop', category:'Groceries', date:'2025-03-18' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-03-20' }),
    u({ type:'expense', amount:2500, description:'Car Insurance', category:'Transportation', date:'2025-03-21' }),
    u({ type:'expense', amount:900, description:'Mr Price Spring Clothes', category:'Shopping', date:'2025-03-25' }),
    u({ type:'expense', amount:380, description:'Spur Dinner', category:'Food & Dining', date:'2025-03-28' }),

    // APR 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-04-02' }),
    u({ type:'income', amount:3200, description:'Freelance Design', category:'Income', date:'2025-04-17' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-04-03' }),
    u({ type:'expense', amount:620, description:'BPC Electricity', category:'Utilities', date:'2025-04-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-04-04' }),
    u({ type:'expense', amount:2050, description:'Choppies Groceries', category:'Groceries', date:'2025-04-06' }),
    u({ type:'expense', amount:320, description:'KFC Lunch', category:'Food & Dining', date:'2025-04-09' }),
    u({ type:'expense', amount:1150, description:'Car Fuel - Engen', category:'Transportation', date:'2025-04-11' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-04-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-04-14' }),
    u({ type:'expense', amount:1650, description:'Spar Monthly Shop', category:'Groceries', date:'2025-04-18' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-04-21' }),
    u({ type:'expense', amount:560, description:'Woolworths Clothing', category:'Shopping', date:'2025-04-24' }),
    u({ type:'expense', amount:300, description:'Clicks Pharmacy', category:'Personal Care', date:'2025-04-27' }),

    // MAY 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-05-02' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-05-03' }),
    u({ type:'expense', amount:590, description:'BPC Electricity', category:'Utilities', date:'2025-05-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-05-04' }),
    u({ type:'expense', amount:2100, description:'Choppies Groceries', category:'Groceries', date:'2025-05-06' }),
    u({ type:'expense', amount:1200, description:'Car Fuel - Shell', category:'Transportation', date:'2025-05-09' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-05-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-05-14' }),
    u({ type:'expense', amount:480, description:'Mothers Day Dinner', category:'Food & Dining', date:'2025-05-11' }),
    u({ type:'expense', amount:400, description:'Mothers Day Gift', category:'Gifts & Donations', date:'2025-05-11' }),
    u({ type:'expense', amount:1700, description:'Spar Monthly Shop', category:'Groceries', date:'2025-05-19' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-05-22' }),
    u({ type:'expense', amount:350, description:'Clicks Toiletries', category:'Personal Care', date:'2025-05-27' }),

    // JUN 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-06-02' }),
    u({ type:'income', amount:4000, description:'Freelance App Project', category:'Income', date:'2025-06-20' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-06-03' }),
    u({ type:'expense', amount:710, description:'BPC Electricity', category:'Utilities', date:'2025-06-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-06-04' }),
    u({ type:'expense', amount:2050, description:'Choppies Groceries', category:'Groceries', date:'2025-06-06' }),
    u({ type:'expense', amount:1150, description:'Car Fuel - Engen', category:'Transportation', date:'2025-06-09' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-06-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-06-14' }),
    u({ type:'expense', amount:1650, description:'Spar Monthly Shop', category:'Groceries', date:'2025-06-18' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-06-20' }),
    u({ type:'expense', amount:1100, description:'Woolworths Winter Wardrobe', category:'Shopping', date:'2025-06-23' }),
    u({ type:'expense', amount:420, description:'Moyo Restaurant', category:'Food & Dining', date:'2025-06-27' }),
    u({ type:'expense', amount:1500, description:'Udemy Courses Bundle', category:'Education', date:'2025-06-25' }),

    // JUL 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-07-02' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-07-03' }),
    u({ type:'expense', amount:730, description:'BPC Electricity', category:'Utilities', date:'2025-07-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-07-04' }),
    u({ type:'expense', amount:2000, description:'Choppies Groceries', category:'Groceries', date:'2025-07-06' }),
    u({ type:'expense', amount:290, description:'Debonairs Pizza', category:'Food & Dining', date:'2025-07-08' }),
    u({ type:'expense', amount:1200, description:'Car Fuel - Shell', category:'Transportation', date:'2025-07-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-07-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-07-14' }),
    u({ type:'expense', amount:1700, description:'Spar Monthly Shop', category:'Groceries', date:'2025-07-19' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-07-21' }),
    u({ type:'expense', amount:680, description:'Game Stores Electronics', category:'Shopping', date:'2025-07-25' }),
    u({ type:'expense', amount:310, description:'Clicks Pharmacy', category:'Personal Care', date:'2025-07-28' }),

    // AUG 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-08-02' }),
    u({ type:'income', amount:2000, description:'Side Hustle Payment', category:'Income', date:'2025-08-14' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-08-03' }),
    u({ type:'expense', amount:670, description:'BPC Electricity', category:'Utilities', date:'2025-08-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-08-04' }),
    u({ type:'expense', amount:2100, description:'Choppies Groceries', category:'Groceries', date:'2025-08-06' }),
    u({ type:'expense', amount:1150, description:'Car Fuel - Engen', category:'Transportation', date:'2025-08-08' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-08-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-08-14' }),
    u({ type:'expense', amount:1750, description:'Spar Monthly Shop', category:'Groceries', date:'2025-08-19' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-08-21' }),
    u({ type:'expense', amount:480, description:'Wimpy Family Outing', category:'Food & Dining', date:'2025-08-23' }),
    u({ type:'expense', amount:350, description:'Clicks Toiletries', category:'Personal Care', date:'2025-08-28' }),

    // SEP 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-09-02' }),
    u({ type:'income', amount:5000, description:'Freelance Web Project', category:'Income', date:'2025-09-22' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-09-03' }),
    u({ type:'expense', amount:640, description:'BPC Electricity', category:'Utilities', date:'2025-09-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-09-04' }),
    u({ type:'expense', amount:2050, description:'Choppies Groceries', category:'Groceries', date:'2025-09-06' }),
    u({ type:'expense', amount:310, description:'Nandos Dinner', category:'Food & Dining', date:'2025-09-09' }),
    u({ type:'expense', amount:1200, description:'Car Fuel - Shell', category:'Transportation', date:'2025-09-11' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-09-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-09-14' }),
    u({ type:'expense', amount:1700, description:'Spar Monthly Shop', category:'Groceries', date:'2025-09-18' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-09-20' }),
    u({ type:'expense', amount:1200, description:'Spring Wardrobe', category:'Shopping', date:'2025-09-24' }),
    u({ type:'expense', amount:340, description:'Clicks Pharmacy', category:'Personal Care', date:'2025-09-27' }),
    u({ type:'expense', amount:900, description:'Church Tithe', category:'Gifts & Donations', date:'2025-09-28' }),

    // OCT 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-10-02' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-10-03' }),
    u({ type:'expense', amount:650, description:'BPC Electricity', category:'Utilities', date:'2025-10-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-10-04' }),
    u({ type:'expense', amount:2150, description:'Choppies Groceries', category:'Groceries', date:'2025-10-06' }),
    u({ type:'expense', amount:360, description:'Ocean Basket Lunch', category:'Food & Dining', date:'2025-10-09' }),
    u({ type:'expense', amount:1250, description:'Car Fuel - Engen', category:'Transportation', date:'2025-10-11' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-10-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-10-14' }),
    u({ type:'expense', amount:1750, description:'Spar Monthly Shop', category:'Groceries', date:'2025-10-19' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-10-21' }),
    u({ type:'expense', amount:750, description:'Mr Price Clothing', category:'Shopping', date:'2025-10-24' }),
    u({ type:'expense', amount:320, description:'Clicks Toiletries', category:'Personal Care', date:'2025-10-27' }),

    // NOV 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-11-02' }),
    u({ type:'income', amount:3500, description:'Tutoring Income', category:'Income', date:'2025-11-17' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-11-03' }),
    u({ type:'expense', amount:680, description:'BPC Electricity', category:'Utilities', date:'2025-11-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-11-04' }),
    u({ type:'expense', amount:2200, description:'Choppies Groceries', category:'Groceries', date:'2025-11-06' }),
    u({ type:'expense', amount:1300, description:'Car Fuel - Shell', category:'Transportation', date:'2025-11-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-11-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-11-14' }),
    u({ type:'expense', amount:1800, description:'Spar Monthly Shop', category:'Groceries', date:'2025-11-18' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-11-20' }),
    u({ type:'expense', amount:1800, description:'Black Friday Haul', category:'Shopping', date:'2025-11-28' }),
    u({ type:'expense', amount:1000, description:'Christmas Gifts', category:'Gifts & Donations', date:'2025-11-25' }),
    u({ type:'expense', amount:380, description:'Spur Dinner', category:'Food & Dining', date:'2025-11-22' }),
    u({ type:'expense', amount:350, description:'Clicks Pharmacy', category:'Personal Care', date:'2025-11-26' }),

    // DEC 2025
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2025-12-02' }),
    u({ type:'income', amount:4000, description:'Year End Bonus', category:'Income', date:'2025-12-15' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2025-12-03' }),
    u({ type:'expense', amount:700, description:'BPC Electricity', category:'Utilities', date:'2025-12-04' }),
    u({ type:'expense', amount:400, description:'Water Utilities', category:'Utilities', date:'2025-12-04' }),
    u({ type:'expense', amount:2500, description:'Choppies Christmas Groceries', category:'Groceries', date:'2025-12-06' }),
    u({ type:'expense', amount:620, description:'Christmas Eve Dinner', category:'Food & Dining', date:'2025-12-24' }),
    u({ type:'expense', amount:1350, description:'Car Fuel - Engen', category:'Transportation', date:'2025-12-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2025-12-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2025-12-14' }),
    u({ type:'expense', amount:2100, description:'Spar Festive Shop', category:'Groceries', date:'2025-12-20' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2025-12-05' }),
    u({ type:'expense', amount:2200, description:'Christmas Gifts Family', category:'Gifts & Donations', date:'2025-12-20' }),
    u({ type:'expense', amount:1600, description:'Woolworths Festive Clothes', category:'Shopping', date:'2025-12-17' }),
    u({ type:'expense', amount:380, description:'Clicks Pharmacy', category:'Personal Care', date:'2025-12-12' }),

    // ================================================================
    // 2026 (Jan–Apr)
    // ================================================================

    // JAN 2026
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2026-01-02' }),
    u({ type:'income', amount:3200, description:'Freelance Web Project', category:'Income', date:'2026-01-15' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2026-01-03' }),
    u({ type:'expense', amount:680, description:'BPC Electricity', category:'Utilities', date:'2026-01-05' }),
    u({ type:'expense', amount:420, description:'Water Utilities', category:'Utilities', date:'2026-01-05' }),
    u({ type:'expense', amount:1850, description:'Choppies Groceries', category:'Groceries', date:'2026-01-07' }),
    u({ type:'expense', amount:350, description:'Nandos Lunch', category:'Food & Dining', date:'2026-01-08' }),
    u({ type:'expense', amount:1200, description:'Car Fuel - Shell', category:'Transportation', date:'2026-01-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2026-01-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2026-01-14' }),
    u({ type:'expense', amount:1650, description:'Spar Monthly Shop', category:'Groceries', date:'2026-01-20' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2026-01-22' }),
    u({ type:'expense', amount:380, description:'Clicks Pharmacy', category:'Personal Care', date:'2026-01-24' }),
    u({ type:'expense', amount:950, description:'Car Service', category:'Transportation', date:'2026-01-27' }),
    u({ type:'expense', amount:500, description:'Birthday Gift', category:'Gifts & Donations', date:'2026-01-29' }),

    // FEB 2026
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2026-02-02' }),
    u({ type:'income', amount:1500, description:'Side Hustle Payment', category:'Income', date:'2026-02-18' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2026-02-03' }),
    u({ type:'expense', amount:720, description:'BPC Electricity', category:'Utilities', date:'2026-02-04' }),
    u({ type:'expense', amount:420, description:'Water Utilities', category:'Utilities', date:'2026-02-04' }),
    u({ type:'expense', amount:2100, description:'Choppies Groceries', category:'Groceries', date:'2026-02-06' }),
    u({ type:'expense', amount:180, description:'Wimpy Breakfast', category:'Food & Dining', date:'2026-02-07' }),
    u({ type:'expense', amount:1100, description:'Car Fuel - Engen', category:'Transportation', date:'2026-02-09' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2026-02-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2026-02-14' }),
    u({ type:'expense', amount:850, description:'Valentines Dinner', category:'Food & Dining', date:'2026-02-14' }),
    u({ type:'expense', amount:600, description:'Valentines Gift', category:'Gifts & Donations', date:'2026-02-14' }),
    u({ type:'expense', amount:1500, description:'Spar Monthly Shop', category:'Groceries', date:'2026-02-19' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2026-02-20' }),
    u({ type:'expense', amount:450, description:'Woolworths Clothing', category:'Shopping', date:'2026-02-22' }),
    u({ type:'expense', amount:1200, description:'Online Course - Udemy', category:'Education', date:'2026-02-25' }),
    u({ type:'expense', amount:250, description:'Clicks Toiletries', category:'Personal Care', date:'2026-02-27' }),

    // MAR 2026
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2026-03-02' }),
    u({ type:'income', amount:4500, description:'Freelance Design Work', category:'Income', date:'2026-03-20' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2026-03-03' }),
    u({ type:'expense', amount:650, description:'BPC Electricity', category:'Utilities', date:'2026-03-04' }),
    u({ type:'expense', amount:420, description:'Water Utilities', category:'Utilities', date:'2026-03-04' }),
    u({ type:'expense', amount:1900, description:'Choppies Groceries', category:'Groceries', date:'2026-03-06' }),
    u({ type:'expense', amount:280, description:'Debonairs Pizza', category:'Food & Dining', date:'2026-03-08' }),
    u({ type:'expense', amount:1300, description:'Car Fuel - Shell', category:'Transportation', date:'2026-03-10' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2026-03-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2026-03-14' }),
    u({ type:'expense', amount:380, description:'Primi Piatti Dinner', category:'Food & Dining', date:'2026-03-15' }),
    u({ type:'expense', amount:1700, description:'Spar Monthly Shop', category:'Groceries', date:'2026-03-18' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2026-03-20' }),
    u({ type:'expense', amount:2500, description:'Car Insurance', category:'Transportation', date:'2026-03-21' }),
    u({ type:'expense', amount:350, description:'Clicks Personal Care', category:'Personal Care', date:'2026-03-23' }),
    u({ type:'expense', amount:1800, description:'New Running Shoes', category:'Shopping', date:'2026-03-25' }),
    u({ type:'expense', amount:450, description:'Spur Family Dinner', category:'Food & Dining', date:'2026-03-28' }),
    u({ type:'expense', amount:1000, description:'Church Tithe', category:'Gifts & Donations', date:'2026-03-30' }),

    // APR 2026
    // Income: salary + big freelance project + tutoring = P36,300
    // Expenses: ~P14,780 → Balance: ~P21,520 (covers total budgets of P16,700)
    u({ type:'income', amount:18500, description:'Monthly Salary', category:'Income', date:'2026-04-01' }),
    u({ type:'income', amount:15000, description:'Freelance Client Project', category:'Income', date:'2026-04-10' }),
    u({ type:'income', amount:2800, description:'Tutoring Income', category:'Income', date:'2026-04-14' }),
    u({ type:'expense', amount:5500, description:'Rent Payment', category:'Housing', date:'2026-04-02' }),
    u({ type:'expense', amount:700, description:'BPC Electricity', category:'Utilities', date:'2026-04-03' }),
    u({ type:'expense', amount:420, description:'Water Utilities', category:'Utilities', date:'2026-04-03' }),
    u({ type:'expense', amount:2200, description:'Choppies Groceries', category:'Groceries', date:'2026-04-05' }),
    u({ type:'expense', amount:320, description:'KFC Lunch', category:'Food & Dining', date:'2026-04-07' }),
    u({ type:'expense', amount:1150, description:'Car Fuel - Engen', category:'Transportation', date:'2026-04-09' }),
    u({ type:'expense', amount:200, description:'Netflix Subscription', category:'Subscriptions', date:'2026-04-14' }),
    u({ type:'expense', amount:150, description:'Spotify Premium', category:'Subscriptions', date:'2026-04-14' }),
    u({ type:'expense', amount:260, description:'Steers Takeaway', category:'Food & Dining', date:'2026-04-16' }),
    u({ type:'expense', amount:1600, description:'Spar Monthly Shop', category:'Groceries', date:'2026-04-18' }),
    u({ type:'expense', amount:800, description:'Virgin Active Gym', category:'Health & Fitness', date:'2026-04-20' }),
    u({ type:'expense', amount:550, description:'Mr Price Clothing', category:'Shopping', date:'2026-04-22' }),
    u({ type:'expense', amount:180, description:'Clicks Pharmacy', category:'Personal Care', date:'2026-04-24' }),
    u({ type:'expense', amount:400, description:'Moyo Restaurant', category:'Food & Dining', date:'2026-04-26' }),
    u({ type:'expense', amount:350, description:'Uber Rides', category:'Transportation', date:'2026-04-28' }),
  ];

  console.log(`Inserting ${tx.length} transactions...`);
  const { data: txd, error: txe } = await supabase.from('transactions').insert(tx).select();
  if (txe) { console.error('TX ERROR:', txe.message); return; }
  console.log(`✓ ${txd.length} transactions inserted`);

  // ---- BUDGETS — Apr 2026 only (current month) ----
  const budgets = [
    { category:'Housing',        allocated:5800, month_year:'2026-04' },
    { category:'Groceries',      allocated:4000, month_year:'2026-04' },
    { category:'Food & Dining',  allocated:1500, month_year:'2026-04' },
    { category:'Transportation', allocated:2000, month_year:'2026-04' },
    { category:'Utilities',      allocated:1200, month_year:'2026-04' },
    { category:'Subscriptions',  allocated:400,  month_year:'2026-04' },
    { category:'Health & Fitness', allocated:900, month_year:'2026-04' },
    { category:'Shopping',       allocated:800,  month_year:'2026-04' },
    { category:'Personal Care',  allocated:400,  month_year:'2026-04' },
  ].map(b => ({ ...b, user_id: UID }));

  console.log(`Inserting ${budgets.length} budgets...`);
  const { data: bd, error: be } = await supabase.from('budgets').insert(budgets).select();
  if (be) { console.error('BUDGET ERROR:', be.message); return; }
  console.log(`✓ ${bd.length} budgets inserted`);

  // ---- SAVINGS GOALS ----
  const goals = [
    { name:'Emergency Fund', target:50000, saved:18500, deadline:'2026-12-31', icon:'wallet' },
    { name:'New Laptop',     target:15000, saved:9200,  deadline:'2026-08-15', icon:'laptop' },
    { name:'Holiday Trip',   target:25000, saved:4000,  deadline:'2026-12-20', icon:'plane'  },
  ].map(g => ({ ...g, user_id: UID }));

  console.log(`Inserting ${goals.length} savings goals...`);
  const { data: gd, error: ge } = await supabase.from('savings_goals').insert(goals).select();
  if (ge) { console.error('GOAL ERROR:', ge.message); return; }
  console.log(`✓ ${gd.length} savings goals inserted`);

  console.log('\n%c=== ALL DONE! Press F5 to refresh! ===', 'color:#22C55E;font-size:18px;font-weight:bold');
  console.log(`${txd.length} transactions | ${bd.length} budgets | ${gd.length} goals`);
  console.log('Coverage: Jan 2024 – Apr 2026 (28 months)');
})();
