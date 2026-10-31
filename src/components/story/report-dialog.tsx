import { useState, type ReactNode } from 'react';
import { FlagIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Textarea } from '~/components/ui/textarea';
import { reportContent } from '~/functions/community.functions';
import { limits } from '~/lib/limits';

const REASONS = [
  'Spam or advertising',
  'Harassment or hate',
  'Sexual content',
  'Violence or threats',
  'Stolen or plagiarized writing',
  'Something else'
];

/** Reports are stored for moderators; see /dashboard/reports. */
export function ReportDialog({
  targetType,
  targetId,
  label = 'Report',
  trigger
}: {
  targetType: 'story' | 'response' | 'user';
  targetId: string;
  label?: string;
  trigger?: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]!);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await reportContent({ data: { targetType, targetId, reason, details } });
      toast.success('Thanks. Your report was sent to the moderators.');
      setOpen(false);
      setDetails('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send your report.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='rounded-full text-muted-foreground'
          onClick={() => setOpen(true)}
        >
          <FlagIcon className='size-4' />
          {label}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>What’s wrong with it?</DialogTitle>
            <DialogDescription>
              Reports are private. The person you report won’t know it was you.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className='gap-2.5'>
            {REASONS.map((item) => (
              <div key={item} className='flex items-center gap-2.5'>
                <RadioGroupItem value={item} id={`reason-${item}`} />
                <Label htmlFor={`reason-${item}`} className='font-normal'>{item}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className='space-y-1.5'>
            <Label htmlFor='report-details'>Anything else? (optional)</Label>
            <Textarea
              id='report-details'
              value={details}
              maxLength={limits.reportDetailsMax}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant='ghost' className='rounded-full' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className='rounded-full' disabled={busy} onClick={submit}>
              {busy ? 'Sending…' : 'Send report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
