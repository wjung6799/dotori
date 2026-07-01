import dbConnect from '@/lib/db';
import TutorSchedule from '@/lib/models/TutorSchedule';
import ScheduleException from '@/lib/models/ScheduleException';
import Booking from '@/lib/models/Booking';
import SessionCredit from '@/lib/models/SessionCredit';
import { slotTimesForDate } from '@/lib/slots';

// Cancel a set of scheduled bookings and refund each one's session credit.
async function cancelAndRefund(filter) {
  const affected = await Booking.find({ ...filter, status: 'scheduled' });
  for (const b of affected) {
    b.status = 'cancelled';
    await b.save();
    if (b.creditId) {
      await SessionCredit.findByIdAndUpdate(b.creditId, { $inc: { remainingSessions: 1 } });
    }
  }
  return affected.length;
}

// Remove a single occurrence of a (recurring) schedule: record an exception so
// the slot stops appearing, and cancel+refund any bookings already made for it.
export async function cancelOccurrence({ schedule, dateKey, reason = '' }) {
  await dbConnect();
  await ScheduleException.updateOne(
    { scheduleId: schedule._id, date: dateKey },
    { $setOnInsert: { scheduleId: schedule._id, tutorId: schedule.tutorId, date: dateKey, reason } },
    { upsert: true },
  );
  const { start } = slotTimesForDate(schedule, dateKey);
  const cancelled = await cancelAndRefund({ scheduleId: schedule._id, startAt: start });
  return { cancelledBookings: cancelled };
}

// Delete an entire schedule (series): remove it + its exceptions, and
// cancel+refund any future bookings tied to it. Past bookings are left intact.
export async function deleteSeries({ schedule }) {
  await dbConnect();
  const cancelled = await cancelAndRefund({
    scheduleId: schedule._id,
    startAt: { $gte: new Date() },
  });
  await ScheduleException.deleteMany({ scheduleId: schedule._id });
  await TutorSchedule.findByIdAndDelete(schedule._id);
  return { cancelledBookings: cancelled };
}
