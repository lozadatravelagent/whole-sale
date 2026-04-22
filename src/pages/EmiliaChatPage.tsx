import ChatFeature from '@/features/chat/ChatFeature';
import { useAuth } from '@/contexts/AuthContext';

export default function EmiliaChatPage() {
  const { user } = useAuth();
  // ProtectedRoute already shows a spinner while auth resolves; render nothing
  // here during the brief tick where user could be null.
  if (!user) return null;
  const mode = user.accountType === 'agent' ? 'standard' : 'companion';
  return <ChatFeature mode={mode} />;
}
