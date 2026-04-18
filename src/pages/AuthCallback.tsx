import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isSafeReturnUrl } from '@/lib/host';

const AuthCallback = () => {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const raw = params.get('next');
    if (user) {
      const next = isSafeReturnUrl(raw) ? raw : '/dashboard';
      window.location.replace(next);
    } else {
      window.location.replace('/login');
    }
  }, [user, loading, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default AuthCallback;
