export const calculateNewExpiryDate = (currentExpiry, plan) => {
  const newExpiry = new Date(currentExpiry);

  if (plan.frequency) {
    // For recurring subscriptions
    switch (plan.frequency) {
      case "monthly":
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        break;
      case "quarterly":
        newExpiry.setMonth(newExpiry.getMonth() + 3);
        break;
      case "yearly":
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        break;
      default:
        newExpiry.setMonth(newExpiry.getMonth() + 1); // Default to monthly
    }
  } else {
    // For one-time payments
    // Add the plan duration (assuming it's in days)
    newExpiry.setDate(newExpiry.getDate() + (plan.duration || 30)); // Default to 30 days if not specified
  }

  return newExpiry;
};

export const addISTOffset = (dateString) => {
  if (!dateString) return dateString;
  const date = new Date(dateString);
  date.setTime(date.getTime() + 5.5 * 60 * 60 * 1000); // 5.5 hours in milliseconds
  return date.toISOString();
};
