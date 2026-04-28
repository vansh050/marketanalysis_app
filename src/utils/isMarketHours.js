import moment from "moment";

export default function IsMarketHours() {
  const currentTimeIST = moment()
    .utcOffset("+05:30")
    .format("DD-MM-YYYY HH:mm:ss");
  const endTimeIST = moment()
    .utcOffset("+05:30")
    .set({ hour: 15, minute: 30, second: 0, millisecond: 0 })
    .format("DD-MM-YYYY HH:mm:ss");
  const startTimeIST = moment()
    .utcOffset("+05:30")
    .set({ hour: 9, minute: 15, second: 0, millisecond: 0 })
    .format("DD-MM-YYYY HH:mm:ss");
  if (
    moment(currentTimeIST, "DD-MM-YYYY HH:mm:ss").isAfter(
      moment(startTimeIST, "DD-MM-YYYY HH:mm:ss")
    ) &&
    moment(currentTimeIST, "DD-MM-YYYY HH:mm:ss").isBefore(
      moment(endTimeIST, "DD-MM-YYYY HH:mm:ss")
    )
  ) {
    return true;
  }

  return false;
}
