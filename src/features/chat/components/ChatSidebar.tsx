import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Archive, Phone, Globe, ArchiveRestore } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ConversationRow = Database['public']['Tables']['conversations']['Row'];

// Extended type to include agency data from the view
interface ConversationWithAgency extends ConversationRow {
  agency_name?: string;
  tenant_name?: string;
  creator_email?: string;
  creator_role?: string;
}

interface ChatSidebarProps {
  conversations: ConversationWithAgency[];
  selectedConversation: string | null;
  activeTab: string;
  sidebarLimit: number;
  onSelectConversation: (id: string) => void;
  onCreateNewChat: () => void;
  onTabChange: (tab: string) => void;
  onArchiveConversation?: (conversationId: string, currentState: 'active' | 'closed') => void;
}

// Conversations sidebar component
const ChatSidebar = React.memo(({
  conversations,
  selectedConversation,
  activeTab,
  sidebarLimit,
  onSelectConversation,
  onCreateNewChat,
  onTabChange,
  onArchiveConversation
}: ChatSidebarProps) => {

  const handleArchiveClick = (e: React.MouseEvent, conversationId: string, currentState: 'active' | 'closed' | 'pending') => {
    e.stopPropagation(); // Prevent selecting the conversation
    if (onArchiveConversation) {
      onArchiveConversation(conversationId, currentState === 'active' ? 'active' : 'closed');
    }
  };

  return (
    <div className="w-full md:w-80 border-r bg-background flex flex-col">
      <div className="p-3 md:p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base md:text-lg font-semibold">Conversaciones</h3>
          <Button
            onClick={onCreateNewChat}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Nuevo Chat</span>
          </Button>
        </div>
        <p className="text-xs md:text-sm text-muted-foreground">Chats de viajes</p>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 md:p-4 pb-2">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active" className="text-xs md:text-sm">Chats Activos</TabsTrigger>
              <TabsTrigger value="archived" className="text-xs md:text-sm">
                <Archive className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Archivadas</span>
                <span className="sm:hidden">Arch.</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto px-3 md:px-4 pb-4">
          {activeTab === 'active' && (
            <div className="space-y-2">
              {conversations
                .filter(conv => conv.state === 'active')
                .slice(0, sidebarLimit)
                .map((conversation) => (
                  <Card
                    key={conversation.id}
                    className={`mb-2 cursor-pointer transition-colors ${selectedConversation === conversation.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                      }`}
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <CardContent className="p-2 md:p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-xs md:text-sm truncate">
                            {conversation.external_key || `Chat ${new Date(conversation.created_at).toLocaleDateString()}`}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] md:text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {conversation.channel === 'wa' ? (
                                <Phone className="h-2.5 md:h-3 w-2.5 md:w-3" />
                              ) : (
                                <Globe className="h-2.5 md:h-3 w-2.5 md:w-3" />
                              )}
                              <span>{new Date(conversation.created_at).toLocaleDateString()}</span>
                            </div>
                            {conversation.agency_name && (
                              <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 py-0.5">
                                {conversation.agency_name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 ml-2">
                          <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5 md:px-2">
                            {conversation.channel}
                          </Badge>
                          {onArchiveConversation && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted"
                              onClick={(e) => handleArchiveClick(e, conversation.id, conversation.state)}
                              title="Archivar conversación"
                            >
                              <Archive className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {activeTab === 'archived' && (
            <div className="space-y-2">
              {conversations
                .filter(conv => conv.state === 'closed')
                .slice(0, sidebarLimit)
                .map((conversation) => (
                  <Card
                    key={conversation.id}
                    className={`mb-2 cursor-pointer transition-colors ${selectedConversation === conversation.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                      }`}
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <CardContent className="p-2 md:p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-xs md:text-sm truncate">
                            {conversation.external_key || `Chat ${new Date(conversation.created_at).toLocaleDateString()}`}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-[10px] md:text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Archive className="h-2.5 md:h-3 w-2.5 md:w-3" />
                              <span>{new Date(conversation.created_at).toLocaleDateString()}</span>
                            </div>
                            {conversation.agency_name && (
                              <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 py-0.5">
                                {conversation.agency_name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 ml-2">
                          <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 md:px-2">
                            archivada
                          </Badge>
                          {onArchiveConversation && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted"
                              onClick={(e) => handleArchiveClick(e, conversation.id, conversation.state)}
                              title="Restaurar conversación"
                            >
                              <ArchiveRestore className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ChatSidebar.displayName = 'ChatSidebar';

export default ChatSidebar;