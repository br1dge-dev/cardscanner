import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { MainApp } from './components/MainApp';
import { SplashScreen } from './components/SplashScreen';
import './App.css';

function App() {
  const { 
    user, 
    isLoading, 
    error, 
    isAuthenticated, 
    isInitialized,
    login, 
    register, 
    logout,
    clearError 
  } = useAuth();

  const [showSplash, setShowSplash] = useState(true);
  const [splashReady, setSplashReady] = useState(false);

  // Splash stays until both: auth is initialized AND minimum display time passed
  useEffect(() => {
    const timer = setTimeout(() => setSplashReady(true), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (splashReady && isInitialized && !isLoading) {
      // Small fade-out delay
      setTimeout(() => setShowSplash(false), 300);
    }
  }, [splashReady, isInitialized, isLoading]);

  if (showSplash) {
    return <SplashScreen />;
  }

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return (
      <Auth
        onLogin={login}
        onRegister={register}
        isLoading={isLoading}
        error={error}
        onClearError={clearError}
      />
    );
  }

  // Show main app
  return (
    <MainApp 
      user={user!}
      onLogout={logout}
    />
  );
}

export default App;
