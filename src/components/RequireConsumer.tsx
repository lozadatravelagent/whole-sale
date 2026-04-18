import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { decideRequireConsumerAction } from './requireConsumerLogic';

interface RequireConsumerProps {
  children: React.ReactNode;
}

const RequireConsumer: React.FC<RequireConsumerProps> = ({ children }) => {
  const { user, loading, isConsumer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const action = decideRequireConsumerAction({
    loading,
    userPresent: Boolean(user),
    isConsumer,
  });

  useEffect(() => {
    if (action === 'redirect-login') {
      navigate('/login', {
        replace: true,
        state: { from: location },
      });
    } else if (action === 'redirect-home') {
      navigate('/', { replace: true });
    }
  }, [action, navigate, location]);

  if (action === 'wait') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (action !== 'render') {
    return null;
  }

  return <>{children}</>;
};

export default RequireConsumer;
