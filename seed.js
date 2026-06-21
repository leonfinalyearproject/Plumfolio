const SUPABASE_URL = 'https://xcjbpexnunryepzcimoh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjamJwZXhudW5yeWVwemNpbW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTE3NDYsImV4cCI6MjA4NTM4Nzc0Nn0.N1nNgILE_sRFJbsi7cM8_cFh62kWtqis9Krwq3JlZZA';
const USER_ID = '0660d359-d946-4cda-ac14-4778332b5461';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function del(table, col, val) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
    method: 'DELETE', headers,
  });
  if (!r.ok) console.error(`DELETE ${table} failed:`, await r.text());
  else console.log(`  Cleared ${table}`);
}

async function insert(table, rows) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(rows),
  });
  if (!r.ok) {
    console.error(`INSERT ${table} failed:`, await r.text());
    return [];
  }
  const data = await r.json();
  console.log(`  Inserted ${data.length} rows into ${table}`);
  return data;
}

async function seed() {
  console.log('=== CLEARING EXISTING DATA ===');
  await del('transactions', 'user_id', USER_ID);
  await del('budgets', 'user_id', USER_ID);
  await del('savings_goals', 'user_id', USER_ID);

  console.log('\n=== INSERTING TRANSACTIONS ===');
  const tx = [
    // ---- JANUARY 2026 ----
    { type: 'income', amount: 18500, description: 'Monthly Salary', category: 'Income', date: '2026-01-02' },
    { type: 'income', amount: 3200, description: 'Freelance Web Project', category: 'Income', date: '2026-01-15' },
    { type: 'expense', amount: 5500, description: 'Rent Payment', category: 'Housing', date: '2026-01-03' },
    { type: 'expense', amount: 680, description: 'BPC Electricity', category: 'Utilities', date: '2026-01-05' },
    { type: 'expense', amount: 420, description: 'Water Utilities', category: 'Utilities', date: '2026-01-05' },
    { type: 'expense', amount: 1850, description: 'Choppies Groceries', category: 'Groceries', date: '2026-01-07' },
    { type: 'expense', amount: 350, description: 'Nandos Lunch', category: 'Food & Dining', date: '2026-01-08' },
    { type: 'expense', amount: 1200, description: 'Car Fuel - Shell', category: 'Transportation', date: '2026-01-10' },
    { type: 'expense', amount: 450, description: 'Game Stores Household', category: 'Shopping', date: '2026-01-12' },
    { type: 'expense', amount: 200, description: 'Netflix Subscription', category: 'Subscriptions', date: '2026-01-14' },
    { type: 'expense', amount: 150, description: 'Spotify Premium', category: 'Subscriptions', date: '2026-01-14' },
    { type: 'expense', amount: 280, description: 'Ocean Basket Dinner', category: 'Food & Dining', date: '2026-01-16' },
    { type: 'expense', amount: 1650, description: 'Spar Monthly Shop', category: 'Groceries', date: '2026-01-20' },
    { type: 'expense', amount: 800, description: 'Virgin Active Gym', category: 'Health & Fitness', date: '2026-01-22' },
    { type: 'expense', amount: 380, description: 'Clicks Pharmacy', category: 'Personal Care', date: '2026-01-24' },
    { type: 'expense', amount: 950, description: 'Car Service', category: 'Transportation', date: '2026-01-27' },
    { type: 'expense', amount: 500, description: 'Birthday Gift', category: 'Gifts & Donations', date: '2026-01-29' },

    // ---- FEBRUARY 2026 ----
    { type: 'income', amount: 18500, description: 'Monthly Salary', category: 'Income', date: '2026-02-02' },
    { type: 'income', amount: 1500, description: 'Side Hustle Payment', category: 'Income', date: '2026-02-18' },
    { type: 'expense', amount: 5500, description: 'Rent Payment', category: 'Housing', date: '2026-02-03' },
    { type: 'expense', amount: 720, description: 'BPC Electricity', category: 'Utilities', date: '2026-02-04' },
    { type: 'expense', amount: 420, description: 'Water Utilities', category: 'Utilities', date: '2026-02-04' },
    { type: 'expense', amount: 2100, description: 'Choppies Groceries', category: 'Groceries', date: '2026-02-06' },
    { type: 'expense', amount: 180, description: 'Wimpy Breakfast', category: 'Food & Dining', date: '2026-02-07' },
    { type: 'expense', amount: 1100, description: 'Car Fuel - Engen', category: 'Transportation', date: '2026-02-09' },
    { type: 'expense', amount: 320, description: 'Mugg & Bean Coffee', category: 'Food & Dining', date: '2026-02-11' },
    { type: 'expense', amount: 200, description: 'Netflix Subscription', category: 'Subscriptions', date: '2026-02-14' },
    { type: 'expense', amount: 150, description: 'Spotify Premium', category: 'Subscriptions', date: '2026-02-14' },
    { type: 'expense', amount: 850, description: 'Valentines Dinner', category: 'Food & Dining', date: '2026-02-14' },
    { type: 'expense', amount: 600, description: 'Valentines Gift', category: 'Gifts & Donations', date: '2026-02-14' },
    { type: 'expense', amount: 1500, description: 'Spar Monthly Shop', category: 'Groceries', date: '2026-02-19' },
    { type: 'expense', amount: 800, description: 'Virgin Active Gym', category: 'Health & Fitness', date: '2026-02-20' },
    { type: 'expense', amount: 450, description: 'Woolworths Clothing', category: 'Shopping', date: '2026-02-22' },
    { type: 'expense', amount: 1200, description: 'Online Course - Udemy', category: 'Education', date: '2026-02-25' },
    { type: 'expense', amount: 250, description: 'Clicks Toiletries', category: 'Personal Care', date: '2026-02-27' },

    // ---- MARCH 2026 ----
    { type: 'income', amount: 18500, description: 'Monthly Salary', category: 'Income', date: '2026-03-02' },
    { type: 'income', amount: 4500, description: 'Freelance Design Work', category: 'Income', date: '2026-03-20' },
    { type: 'expense', amount: 5500, description: 'Rent Payment', category: 'Housing', date: '2026-03-03' },
    { type: 'expense', amount: 650, description: 'BPC Electricity', category: 'Utilities', date: '2026-03-04' },
    { type: 'expense', amount: 420, description: 'Water Utilities', category: 'Utilities', date: '2026-03-04' },
    { type: 'expense', amount: 1900, description: 'Choppies Groceries', category: 'Groceries', date: '2026-03-06' },
    { type: 'expense', amount: 280, description: 'Debonairs Pizza', category: 'Food & Dining', date: '2026-03-08' },
    { type: 'expense', amount: 1300, description: 'Car Fuel - Shell', category: 'Transportation', date: '2026-03-10' },
    { type: 'expense', amount: 200, description: 'Netflix Subscription', category: 'Subscriptions', date: '2026-03-14' },
    { type: 'expense', amount: 150, description: 'Spotify Premium', category: 'Subscriptions', date: '2026-03-14' },
    { type: 'expense', amount: 380, description: 'Primi Piatti Dinner', category: 'Food & Dining', date: '2026-03-15' },
    { type: 'expense', amount: 1700, description: 'Spar Monthly Shop', category: 'Groceries', date: '2026-03-18' },
    { type: 'expense', amount: 800, description: 'Virgin Active Gym', category: 'Health & Fitness', date: '2026-03-20' },
    { type: 'expense', amount: 2500, description: 'Car Insurance', category: 'Transportation', date: '2026-03-21' },
    { type: 'expense', amount: 350, description: 'Clicks Personal Care', category: 'Personal Care', date: '2026-03-23' },
    { type: 'expense', amount: 1800, description: 'New Running Shoes', category: 'Shopping', date: '2026-03-25' },
    { type: 'expense', amount: 450, description: 'Spur Family Dinner', category: 'Food & Dining', date: '2026-03-28' },
    { type: 'expense', amount: 1000, description: 'Church Tithe', category: 'Gifts & Donations', date: '2026-03-30' },

    // ---- APRIL 2026 (current month) ----
    { type: 'income', amount: 18500, description: 'Monthly Salary', category: 'Income', date: '2026-04-01' },
    { type: 'income', amount: 2800, description: 'Tutoring Income', category: 'Income', date: '2026-04-14' },
    { type: 'expense', amount: 5500, description: 'Rent Payment', category: 'Housing', date: '2026-04-02' },
    { type: 'expense', amount: 700, description: 'BPC Electricity', category: 'Utilities', date: '2026-04-03' },
    { type: 'expense', amount: 420, description: 'Water Utilities', category: 'Utilities', date: '2026-04-03' },
    { type: 'expense', amount: 2200, description: 'Choppies Groceries', category: 'Groceries', date: '2026-04-05' },
    { type: 'expense', amount: 320, description: 'KFC Lunch', category: 'Food & Dining', date: '2026-04-07' },
    { type: 'expense', amount: 1150, description: 'Car Fuel - Engen', category: 'Transportation', date: '2026-04-09' },
    { type: 'expense', amount: 200, description: 'Netflix Subscription', category: 'Subscriptions', date: '2026-04-14' },
    { type: 'expense', amount: 150, description: 'Spotify Premium', category: 'Subscriptions', date: '2026-04-14' },
    { type: 'expense', amount: 260, description: 'Steers Takeaway', category: 'Food & Dining', date: '2026-04-16' },
    { type: 'expense', amount: 1600, description: 'Spar Monthly Shop', category: 'Groceries', date: '2026-04-18' },
    { type: 'expense', amount: 800, description: 'Virgin Active Gym', category: 'Health & Fitness', date: '2026-04-20' },
    { type: 'expense', amount: 550, description: 'Mr Price Clothing', category: 'Shopping', date: '2026-04-22' },
    { type: 'expense', amount: 180, description: 'Clicks Pharmacy', category: 'Personal Care', date: '2026-04-24' },
    { type: 'expense', amount: 400, description: 'Moyo Restaurant', category: 'Food & Dining', date: '2026-04-26' },
    { type: 'expense', amount: 350, description: 'Uber Rides', category: 'Transportation', date: '2026-04-28' },
  ].map(t => ({ ...t, user_id: USER_ID }));

  await insert('transactions', tx);

  // ---- April expenses/income summary ----
  const aprIncome = tx.filter(t => t.date.startsWith('2026-04') && t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const aprExpense = tx.filter(t => t.date.startsWith('2026-04') && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  console.log(`  April income: P${aprIncome}, expenses: P${aprExpense}, balance: P${aprIncome - aprExpense}`);

  console.log('\n=== INSERTING BUDGETS (April 2026) ===');
  const budgets = [
    { category: 'Housing', allocated: 5500, month_year: '2026-04' },
    { category: 'Groceries', allocated: 4000, month_year: '2026-04' },
    { category: 'Food & Dining', allocated: 1500, month_year: '2026-04' },
    { category: 'Transportation', allocated: 2000, month_year: '2026-04' },
    { category: 'Utilities', allocated: 1200, month_year: '2026-04' },
    { category: 'Subscriptions', allocated: 400, month_year: '2026-04' },
    { category: 'Health & Fitness', allocated: 900, month_year: '2026-04' },
    { category: 'Shopping', allocated: 800, month_year: '2026-04' },
    { category: 'Personal Care', allocated: 400, month_year: '2026-04' },
  ].map(b => ({ ...b, user_id: USER_ID }));

  await insert('budgets', budgets);
  const totalBudgeted = budgets.reduce((s, b) => s + b.allocated, 0);
  console.log(`  Total budgeted: P${totalBudgeted} (under balance of P${aprIncome - aprExpense})`);

  console.log('\n=== INSERTING SAVINGS GOALS ===');
  const goals = [
    { name: 'Emergency Fund', target: 50000, saved: 18500, deadline: '2026-12-31', icon: 'wallet' },
    { name: 'New Laptop', target: 15000, saved: 9200, deadline: '2026-08-15', icon: 'laptop' },
    { name: 'Holiday Trip', target: 25000, saved: 4000, deadline: '2026-12-20', icon: 'plane' },
  ].map(g => ({ ...g, user_id: USER_ID }));

  await insert('savings_goals', goals);

  console.log('\n=== SEED COMPLETE ===');
  console.log('Refresh your app — all pages should have data now!');
}

seed().catch(console.error);
