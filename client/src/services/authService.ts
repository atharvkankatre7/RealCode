// client/src/services/authService.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

// Verify Google ID token with the backend
export const verifyGoogleToken = async (idToken: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/google`, { idToken });

    // If verification was successful and we have a token and user, store them
    if (response.data.success && response.data.token && response.data.user) {
      setToken(response.data.token);
      setUser(response.data.user);
    }

    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to verify Google authentication');
  }
};

// Store token in localStorage
export const setToken = (token: string) => {
  localStorage.setItem('token', token);
};

// Get token from localStorage
export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

// Remove token from localStorage
export const removeToken = () => {
  localStorage.removeItem('token');
};

// Store user in localStorage
export const setUser = (user: any) => {
  localStorage.setItem('user', JSON.stringify(user));
};

// Get user from localStorage
export const getUser = () => {
  if (typeof window !== 'undefined') {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
  return null;
};

// Remove user from localStorage
export const removeUser = () => {
  localStorage.removeItem('user');
};

// Logout
export const logout = () => {
  removeToken();
  removeUser();
};

// Auth service placeholder. All Clerk logic removed.
export const authService = {
  // Placeholder methods
  login: async () => ({}),
  signup: async () => ({}),
  verifyEmail: async () => ({}),
  logout: async () => ({}),
}
