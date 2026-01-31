# Plumfolio - Personal Finance Tracker

A secure, web-based personal finance tracker built with React.js and Supabase.

**Student:** Leon Maunge (202103579)  
**Supervisor:** Dr. Shree Om  
**University of Botswana - Final Year Project 2026**

## Tech Stack

- **Frontend:** React.js 18
- **Backend:** Supabase (PostgreSQL + Auth)
- **Charts:** Chart.js + react-chartjs-2
- **Icons:** Lucide React
- **Routing:** React Router v6
- **Hosting:** GitHub Pages

## Features

- User authentication (signup, signin, logout)
- Dashboard with financial overview
- Transaction management (CRUD operations)
- Budget creation and tracking
- Visual analytics with charts
- Responsive design for mobile and desktop

## Project Structure

```
plumfolio/
├── public/
│   ├── index.html
│   └── logo.png
├── src/
│   ├── components/
│   │   ├── DashboardLayout.js
│   │   ├── Header.js
│   │   └── Sidebar.js
│   ├── context/
│   │   └── AuthContext.js
│   ├── lib/
│   │   └── supabase.js
│   ├── pages/
│   │   ├── Landing.js
│   │   ├── SignUp.js
│   │   ├── SignIn.js
│   │   ├── Dashboard.js
│   │   ├── Transactions.js
│   │   ├── Budgets.js
│   │   ├── Analytics.js
│   │   └── Settings.js
│   ├── styles/
│   │   └── globals.css
│   ├── App.js
│   └── index.js
└── package.json
```

## Deployment to GitHub Pages

### Option 1: Deploy the Build Folder

1. Create a GitHub repository named `Plumfolio` under the `leonfinalyearproject` account
2. Upload the contents of the `build` folder (index.html, static/, logo.png, etc.)
3. Go to Settings → Pages
4. Set Source to "Deploy from a branch" and select "main" branch
5. Your site will be live at: https://leonfinalyearproject.github.io/Plumfolio/

### Option 2: Deploy from Source

1. Clone/create the repository
2. Copy all files from the `src` folder to your local project
3. Run:
   ```bash
   npm install
   npm run build
   ```
4. Push the `build` folder contents to GitHub
5. Enable GitHub Pages

## Supabase Setup

### Database Tables

Run these SQL commands in Supabase SQL Editor:

```sql
-- Transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budgets table
CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  allocated DECIMAL(12,2) NOT NULL,
  month_year VARCHAR(7) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for budgets
CREATE POLICY "Users can view their own budgets"
  ON budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets"
  ON budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets"
  ON budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets"
  ON budgets FOR DELETE
  USING (auth.uid() = user_id);
```

## Environment Variables

The Supabase credentials are already configured in `src/lib/supabase.js`:

- URL: `https://xcjbpexnunryepzcimoh.supabase.co`
- Anon Key: Configured in the file

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Color Scheme

- **Plum:** #4A1D6B (dark), #7B2D8E (medium), #9D4EDD (light), #C77DFF (glow)
- **Green:** #1B5E20 (dark), #2E7D32 (medium), #4CAF50 (light)
- **Gold:** #FFB300 (accent)
- **Background:** #0A0A0F (primary), #12121A (secondary)

## Typography

- **Headings:** Fraunces (serif)
- **Body:** DM Sans (sans-serif)

## License

Academic project - University of Botswana, 2026
