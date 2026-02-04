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
