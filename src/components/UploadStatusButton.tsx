import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UploadDebugger } from './UploadDebugger';
import { Search } from 'lucide-react';

export const UploadStatusButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Check Upload Status
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Status & Debug Info</DialogTitle>
        </DialogHeader>
        <UploadDebugger />
      </DialogContent>
    </Dialog>
  );
};
