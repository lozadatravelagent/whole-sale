import React from 'react';
import {
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Trash2 } from 'lucide-react';
import { TrelloCard } from './TrelloCard';
import { Lead, Section } from '@/types';

interface TrelloColumnProps {
    section: Section;
    leads: Lead[];
    onEdit: (lead: Lead) => void;
    onAddCard: () => void;
    onDeleteSection: (section: Section) => void;
    isOver?: boolean;
}

export function TrelloColumn({
    section,
    leads,
    onEdit,
    onAddCard,
    onDeleteSection,
    isOver
}: TrelloColumnProps) {
    const { setNodeRef } = useDroppable({
        id: section.id,
        data: {
            type: 'section',
            section
        }
    });

    return (
        <div className="w-72 md:w-80 flex-shrink-0">
            <Card
                ref={setNodeRef}
                className={`h-full flex flex-col transition-colors ${isOver ? 'bg-primary/5 border-primary/30' : 'bg-muted'
                    }`}
            >
                {/* Header */}
                <CardHeader className="flex-shrink-0 p-0">
                    <div className="flex items-center justify-between p-2 md:p-3 pb-0">
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <CardTitle className="text-xs md:text-sm font-medium text-foreground truncate">
                                {section.name}
                            </CardTitle>
                            <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5">
                                {leads.length}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-0.5 md:gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onAddCard}
                                className="h-5 w-5 md:h-6 md:w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                                <Plus className="h-2.5 md:h-3 w-2.5 md:w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeleteSection(section)}
                                className="h-5 w-5 md:h-6 md:w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="h-2.5 md:h-3 w-2.5 md:w-3" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                {/* Content */}
                <CardContent className="flex-1 overflow-hidden p-2 md:p-3 pt-3 md:pt-4">
                    <SortableContext
                        items={leads.map(lead => lead.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-1.5 md:space-y-2 h-full overflow-y-auto pr-0.5 md:pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                            {leads.map((lead) => (
                                <TrelloCard
                                    key={lead.id}
                                    lead={lead}
                                    onClick={onEdit}
                                />
                            ))}

                            {leads.length === 0 && (
                                <div className="text-center text-muted-foreground py-6 md:py-8">
                                    <div className="text-xl md:text-2xl mb-2">📋</div>
                                    <p className="text-[10px] md:text-xs">No hay tarjetas</p>
                                    <p className="text-[10px] md:text-xs mt-1">Arrastra aquí o</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onAddCard}
                                        className="mt-2 text-[10px] md:text-xs h-5 md:h-6"
                                    >
                                        Agregar tarjeta
                                    </Button>
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </CardContent>
            </Card>
        </div>
    );
}
