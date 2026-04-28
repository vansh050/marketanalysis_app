export default function formatCurrency(amount) {
    // Check if the amount is negative and get the absolute value
    const isNegative = amount < 0;
    let absoluteAmount = Math.abs(amount);
  
    // Convert the absolute value to a string and split it at the decimal point
    let [integerPart, decimalPart] = absoluteAmount.toString().split(".");
  
    // Handle the last three digits separately (they won't have a comma)
    let lastThreeDigits = integerPart.slice(-3);
    let restDigits = integerPart.slice(0, -3);
  
    // Add commas after every two digits in the rest of the number
    if (restDigits !== "") {
      restDigits = restDigits?.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + ",";
    }
  
    // Combine the formatted parts
    integerPart = restDigits + lastThreeDigits;
  
    // Combine the integer part with the decimal part (if any)
    const formattedAmount = decimalPart
      ? `${integerPart}.${decimalPart}`
      : integerPart;
  
    // Return the formatted amount, adding the minus sign back if needed
    return isNegative ? `-${formattedAmount}` : formattedAmount;
  }
  