import { route } from '@/lib/api';
import { socketTicket } from '@/lib/realtime';

export const GET = route(async ({ user }) => ({ ticket: socketTicket(user._id) }));
