import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SlideshowProvider } from './context/SlideshowContext';
import Landing from './pages/Landing';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import DashboardLayout from './components/DashboardLayout';
import './styles/globals.css';

function App() {
  return (
    <Router basename="/Plumfolio">
      <AuthProvider>
        <SlideshowProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
            <Route path="/transactions" element={<DashboardLayout><Transactions /></DashboardLayout>} />
            <Route path="/budgets" element={<DashboardLayout><Budgets /></DashboardLayout>} />
            <Route path="/analytics" element={<DashboardLayout><Analytics /></DashboardLayout>} />
            <Route path="/settings" element={<DashboardLayout><Settings /></DashboardLayout>} />
          </Routes>
        </SlideshowProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
