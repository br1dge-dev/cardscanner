import { useAuth } from './hooks/useAuth';
import { Auth } from './components/Auth';
import { MainApp } from './components/MainApp';
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

  // Show loading state while checking auth
  if (!isInitialized || isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
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
