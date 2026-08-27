import { ActionItem, Meeting } from '@/types';

/**
 * Stage 10: Historical Meeting Memory Engine
 * Detects carried-over tasks across meeting history.
 */
export function processHistoricalTaskMemory(
  newActionItems: ActionItem[],
  historicalMeetings: Meeting[]
): ActionItem[] {
  // Collect all uncompleted past tasks across historical meetings
  const pastUncompletedTasks: { task: ActionItem; meetingTitle: string; meetingDate: string }[] = [];

  historicalMeetings.forEach((mtg) => {
    mtg.actionItems.forEach((task) => {
      if (task.status !== 'completed') {
        pastUncompletedTasks.push({
          task,
          meetingTitle: mtg.title,
          meetingDate: mtg.date,
        });
      }
    });
  });

  // Evaluate new tasks against past pending tasks
  return newActionItems.map((item) => {
    const matchedPast = pastUncompletedTasks.find((past) => {
      const sameAssignee = past.task.assignee.toLowerCase() === item.assignee.toLowerCase();
      // Check keyword similarity in title
      const newKeywords = item.title.toLowerCase().split(' ').filter((w) => w.length > 3);
      const pastKeywords = past.task.title.toLowerCase().split(' ').filter((w) => w.length > 3);

      const overlap = newKeywords.filter((kw) => pastKeywords.includes(kw));
      return sameAssignee && overlap.length >= 1;
    });

    if (matchedPast) {
      return {
        ...item,
        isCarriedOver: true,
      };
    }

    return item;
  });
}
