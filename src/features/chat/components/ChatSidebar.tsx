import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Archive, Phone, Globe } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ConversationRow = Database['public']['Tables']['conversations']['Row'];

interface ChatSidebarProps {
  conversations: ConversationRow[];
  selectedConversation: string | null;
  activeTab: string;
  sidebarLimit: number;
  onSelectConversation: (id: string) => void;
  onCreateNewChat: () => void;
  onTabChange: (tab: string) => void;
}

// Conversations sidebar component
const ChatSidebar = React.memo(({
  conversations,
  selectedConversation,
  activeTab,
  sidebarLimit,
  onSelectConversation,
  onCreateNewChat,
  onTabChange
}: ChatSidebarProps) => (
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
                        <div className="flex items-center mt-1 text-[10px] md:text-xs text-muted-foreground">
                          {conversation.channel === 'wa' ? (
                            <Phone className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1" />
                          ) : (
                            <Globe className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1" />
                          )}
                          <span>{new Date(conversation.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-2 text-[10px] md:text-xs px-1.5 md:px-2">
                        {conversation.channel}
                      </Badge>
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
                        <div className="flex items-center mt-1 text-[10px] md:text-xs text-muted-foreground">
                          <Archive className="h-2.5 md:h-3 w-2.5 md:w-3 mr-1" />
                          <span>{new Date(conversation.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2 text-[10px] md:text-xs px-1.5 md:px-2">
                        archivada
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  </div>
));

ChatSidebar.displayName = 'ChatSidebar';

export default ChatSidebar;