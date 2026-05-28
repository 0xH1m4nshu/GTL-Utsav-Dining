import { Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Layout from './components/Layout';

// User Panel Pages
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import EventsPage from './pages/EventsPage';
import LoginPage from './pages/LoginPage';
import MFASetupPage from './pages/MFASetupPage';
import MFAVerifyPage from './pages/MFAVerifyPage';
import BookTablePage from './pages/BookTablePage';
import OrderOnlinePage from './pages/OrderOnlinePage';
import CheckoutPage from './pages/CheckoutPage';
import OrderTrackerPage from './pages/OrderTrackerPage';
import ProfilePage from './pages/ProfilePage';

// Admin Panel Pages (from Restaurant Software Application-2 — UI unchanged)
import AdminLayout from './pages/AdminLayout';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminMenuPage from './pages/AdminMenuPage';
import AdminTablePage from './pages/AdminTablePage';
import AdminOrderPage from './pages/AdminOrderPage';
import AdminBillingPaymentPage from './pages/AdminBillingPaymentPage';
import AdminUserPage from './pages/AdminUserPage';
import AdminInventoryPage from './pages/AdminInventoryPage';
import AdminReportsAnalyticsPage from './pages/AdminReportsAnalyticsPage';
import AdminAiRecommendationPage from './pages/AdminAiRecommendationPage';
import AdminKitchenDisplayPage from './pages/AdminKitchenDisplayPage';
import AdminRolesPermissionsPage from './pages/AdminRolesPermissionsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';

function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route element={<Layout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup-mfa" element={<MFASetupPage />} />
          <Route path="/verify-mfa" element={<MFAVerifyPage />} />
          <Route path="/book-table" element={<BookTablePage />} />
          <Route path="/order-online" element={<OrderOnlinePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-tracker" element={<OrderTrackerPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="menu" element={<AdminMenuPage />} />
          <Route path="table" element={<AdminTablePage />} />
          <Route path="order" element={<AdminOrderPage />} />
          <Route path="billing-payment" element={<AdminBillingPaymentPage />} />
          <Route path="user" element={<AdminUserPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="reports-analytics" element={<AdminReportsAnalyticsPage />} />
          <Route path="ai-recommendation" element={<AdminAiRecommendationPage />} />
          <Route path="kitchen-display" element={<AdminKitchenDisplayPage />} />
          <Route path="roles-permissions" element={<AdminRolesPermissionsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
        <Route path="*" element={<HomePage />} />
      </Routes>
    </UserProvider>
  );
}

export default App;
