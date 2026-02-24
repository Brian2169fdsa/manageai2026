/**
 * Email template functions — spec-named wrappers over notifications.ts.
 * Import from here for clean, short function names:
 *   import { ticketSubmitted, buildComplete } from '@/lib/email/templates';
 */
export {
  ticketSubmittedHtml as ticketSubmitted,
  analysisCompleteHtml as analysisComplete,
  buildCompleteHtml as buildComplete,
  statusChangedHtml as statusChanged,
  approvalRequiredHtml as approvalRequired,
  deploymentCompleteHtml as deploymentComplete,
} from './notifications';
