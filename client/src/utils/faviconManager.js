// Favicon manager for dynamic pomodoro timer favicon
class FaviconManager {
  constructor() {
    this.currentLink = null;
    this.init();
  }

  init() {
    // Remove existing favicon and create new link element
    const existingLink = document.querySelector('link[rel="icon"]');
    if (existingLink) {
      existingLink.remove();
    }

    this.currentLink = document.createElement('link');
    this.currentLink.rel = 'icon';
    this.currentLink.type = 'image/svg+xml';
    document.head.appendChild(this.currentLink);
  }

  getColorForState(mode, isActive) {
    if (mode === 'pomodoro') {
      return isActive ? '#10b981' : '#f59e0b'; // Green when working, yellow when waiting
    } else if (mode === 'break') {
      return isActive ? '#3b82f6' : '#f59e0b'; // Blue when on break, yellow when waiting
    }
    return '#f59e0b'; // Default yellow for waiting
  }

  generateSVG(mode, isActive, progress = 1) {
    const color = this.getColorForState(mode, isActive);
    const radius = 50;
    
    // Create a pie slice path based on progress (1 = full circle, 0 = no slice)
    const angle = progress * 360;
    const radians = (angle - 90) * (Math.PI / 180); // Start from top (-90 degrees)
    
    let pathData = '';
    if (progress > 0) {
      if (progress >= 1) {
        // Full circle
        pathData = `M 50,50 m 0,-${radius} A ${radius},${radius} 0 1,1 0,${radius} A ${radius},${radius} 0 1,1 0,-${radius} Z`;
      } else {
        // Pie slice
        const x = 50 + radius * Math.cos(radians);
        const y = 50 + radius * Math.sin(radians);
        const largeArcFlag = progress > 0.5 ? 1 : 0;
        
        pathData = `M 50,50 L 50,0 A ${radius},${radius} 0 ${largeArcFlag},1 ${x},${y} Z`;
      }
    }

    return `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <!-- Background circle (light gray) -->
        <circle
          fill="#e5e7eb"
          r="${radius}"
          cx="50"
          cy="50"
        />
        <!-- Progress pie slice (colored based on state) -->
        ${pathData ? `<path fill="${color}" d="${pathData}" />` : ''}
      </svg>
    `.trim();
  }

  updateFavicon(timerState, settings) {
    if (!timerState) return;

    const { mode, isActive, timeLeft } = timerState;
    
    // Calculate progress based on current time left
    let totalTime;
    if (mode === 'pomodoro') {
      totalTime = (settings?.pomodoro || 25) * 60;
    } else if (mode === 'break') {
      totalTime = (settings?.break || 5) * 60;
    } else {
      totalTime = 25 * 60; // Default
    }

    // Progress from 1 (full) to 0 (empty)
    const progress = Math.max(0, Math.min(1, timeLeft / totalTime));

    const svgContent = this.generateSVG(mode, isActive, progress);
    const dataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;
    
    if (this.currentLink) {
      this.currentLink.href = dataUrl;
    }
  }

  // Method to set a static favicon (for initial load or disconnected state)
  setStaticFavicon() {
    const svgContent = this.generateSVG('pomodoro', false, 1);
    const dataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;
    
    if (this.currentLink) {
      this.currentLink.href = dataUrl;
    }
  }
}

// Create singleton instance
const faviconManager = new FaviconManager();

export default faviconManager; 