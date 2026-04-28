export default function FormatDateTime(date) {
  const originalTime = date;
  const parsedTime = new Date(originalTime);

  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Set to false to use 24-hour time format
  timeZone: 'Asia/Kolkata'
  };

  const formattedTime = parsedTime.toLocaleString("en-IN", options);

  return formattedTime;
}

export function FormatDate(date) {
  // Parse the input date string into a Date object
  const parsedDate = new Date(date);

  // Define options for date formatting
  const options = {
    year: "numeric",
    month: "short", // Short format for month (e.g., Jan, Feb)
    day: "numeric",
    timeZone: 'Asia/Kolkata',

  };

  // Format the date part only
  const formattedDate = parsedDate.toLocaleDateString("en-IN", options);

  return formattedDate;
}
