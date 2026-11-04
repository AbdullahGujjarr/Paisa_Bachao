import { ActivityLog, Budget, Category, Debt, Invitation, Notification, ReceiptScan, RecurringTransaction, SavingsGoal, Settlement, Subscription, Transaction, User, Wallet, Workspace, WorkspaceMember } from '@/models';
import { dropFromRoom } from './realtime';

export async function deleteWorkspaceData(wid) {
  const models = [Transaction, Budget, Category, Wallet, SavingsGoal, RecurringTransaction, Debt, Subscription, Invitation, ReceiptScan, ActivityLog, Settlement, WorkspaceMember, Notification];
  await Promise.all(models.map((M) => M.deleteMany({ workspace: wid })));
  await Workspace.deleteOne({ _id: wid });
}

/** Deletes a user. Shared workspaces with other members pass to the longest-standing member. */
export async function deleteAccount(user) {
  const memberships = await WorkspaceMember.find({ user: user._id }).lean();
  for (const m of memberships) {
    if (m.role === 'owner') {
      const heir = await WorkspaceMember.findOne({ workspace: m.workspace, user: { $ne: user._id } }).sort({ createdAt: 1 });
      if (!heir) {
        await deleteWorkspaceData(m.workspace);
        continue;
      }
      await Promise.all([
        WorkspaceMember.updateOne({ _id: heir._id }, { role: 'owner' }),
        Workspace.updateOne({ _id: m.workspace }, { owner: heir.user }),
      ]);
    }
    await WorkspaceMember.deleteOne({ _id: m._id });
    await Workspace.updateOne({ _id: m.workspace }, { $inc: { memberCount: -1 } });
    dropFromRoom(user._id, m.workspace);
  }
  await Notification.deleteMany({ user: user._id });
  await User.deleteOne({ _id: user._id });
}
