import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import About from './components/About';
import Contact from './components/Contact';
import Login from './components/Login';
import Register from './components/Register';
import GoogleAuthCallback from './components/GoogleAuthCallback';
import Dashboard from './components/Dashboard';
import ProductManagement from './components/ProductManagement';
import ProductDisplay from './components/ProductDisplay';
import ProductDetails from './components/ProductDetails';
import RoomFitPreview from './components/RoomFitPreview';
import Enquiries from './components/Enquiries';
import AdminDataTools from './components/AdminDataTools';
import AdminOrders from './components/AdminOrders';
import AdminBilling from './components/AdminBilling';
import AdminAnalytics from './components/AdminAnalytics';
import UserDashboard from './components/UserDashboard';
import UserProfile from './components/UserProfile';
import Wishlist from './components/Wishlist';
import Orders from './components/Orders';
import { getSession } from './utils/auth';
import './App.css';

function ProtectedRoute({ allowRoles, children }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (allowRoles && !allowRoles.includes(session.role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/user" element={<UserDashboard />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowRoles={["user"]}>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <ProtectedRoute allowRoles={["user"]}>
              <Wishlist />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute allowRoles={["user"]}>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute allowRoles={["user"]}>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/products" element={<ProductManagement />} />
        <Route path="/admin/billing" element={<AdminBilling />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/enquiries" element={<Enquiries />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/data-management" element={<AdminDataTools />} />
        <Route path="/admin/import-export" element={<AdminDataTools />} />
        <Route path="/products" element={<ProductDisplay />} />
        <Route path="/products/:id" element={<ProductDetails />} />
        <Route path="/fit-check" element={<RoomFitPreview />} />
        <Route path="/fit-check/:id" element={<RoomFitPreview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
