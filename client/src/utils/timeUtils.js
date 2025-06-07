// Utility functions for time formatting

export const formatLastActive = (lastActivity) => {
  if (!lastActivity) return '';
  
  const now = new Date();
  const lastActiveTime = new Date(lastActivity);
  
  // Check if the last activity was today
  const isToday = now.getDate() === lastActiveTime.getDate() &&
                  now.getMonth() === lastActiveTime.getMonth() &&
                  now.getFullYear() === lastActiveTime.getFullYear();
  
  const hours = lastActiveTime.getHours().toString().padStart(2, '0');
  const minutes = lastActiveTime.getMinutes().toString().padStart(2, '0');
  
  if (isToday) {
    // If today, show only time (HH:MM)
    return `${hours}:${minutes}`;
  } else {
    // If not today, show full date and time (DD.MM.YYYY HH:MM)
    const day = lastActiveTime.getDate().toString().padStart(2, '0');
    const month = (lastActiveTime.getMonth() + 1).toString().padStart(2, '0');  
    const year = lastActiveTime.getFullYear();
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }
}; 