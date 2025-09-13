import React, { useState } from 'react';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';

const AuthWrapper = () => {
  const [isLogin, setIsLogin] = useState(true);

  const switchToSignup = () => setIsLogin(false);
  const switchToLogin = () => setIsLogin(true);

  return (
    <>
      {isLogin ? (
        <LoginPage onSwitchToSignup={switchToSignup} />
      ) : (
        <SignupPage onSwitchToLogin={switchToLogin} />
      )}
    </>
  );
};

export default AuthWrapper;
