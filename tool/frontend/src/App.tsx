import { ProtectedRoute } from '@asgardeo/react-router';

import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { Layout } from './components/Layout';
import { LoginRedirect } from './components/LoginRedirect';
import { PreLoader } from './components/PreLoader';

import { Templates } from './pages/Templates';
import { Receivers } from './pages/Receivers';
import { useAsgardeo } from '@asgardeo/react';

export function App() {
  const { isLoading, isSignedIn } = useAsgardeo();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          isLoading && isSignedIn ? (
            <PreLoader message="Authentication in progress..." />
          ) : (
            <ProtectedRoute redirectTo="/signin">
              <Layout />
            </ProtectedRoute>
          )
        }>
          <Route path="templates" element={<Templates />} />
          <Route path="receivers" element={<Receivers />} />
        </Route>
        <Route path="/signin" element={<LoginRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}