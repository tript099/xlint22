/**
 * Session selector component - extracted from EmployeeUploadTwoStep
 * Handles selection of upload sessions for role assignment
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Brain, Calendar, FileText } from 'lucide-react';
import { UploadSession } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface SessionSelectorProps {
  sessions: UploadSession[];
  selectedSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onAssignRoles: () => void;
  isAssigning: boolean;
  disabled?: boolean;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  sessions,
  selectedSessionId,
  onSessionSelect,
  onAssignRoles,
  isAssigning,
  disabled = false
}) => {
  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
          <Brain className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-xl">AI Role Assignment</CardTitle>
        <p className="text-muted-foreground text-sm">
          Select an uploaded session to analyze and assign standardized roles
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Upload Session</Label>
          <Select
            value={selectedSessionId || ''}
            onValueChange={onSessionSelect}
            disabled={disabled || isAssigning}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a completed upload session..." />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <div className="font-medium">{session.session_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {session.total_rows} employees • {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {session.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {selectedSession && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{selectedSession.session_name}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Records:</span>
                <div className="font-semibold">{selectedSession.total_rows}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <div className="font-semibold">
                  {formatDistanceToNow(new Date(selectedSession.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
            
            {selectedSession.file_names && (
              <div>
                <span className="text-muted-foreground text-sm">Source Files:</span>
                <div className="text-sm font-medium">
                  {selectedSession.file_names.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}
        
        <Button
          onClick={onAssignRoles}
          disabled={!selectedSessionId || isAssigning || disabled}
          className="w-full"
        >
          <Brain className="mr-2 h-4 w-4" />
          {isAssigning ? 'Analyzing & Assigning...' : 'Start AI Role Assignment'}
        </Button>
        
        {sessions.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-4">
            No completed upload sessions found. Please upload employee data first.
          </div>
        )}
      </CardContent>
    </Card>
  );
};