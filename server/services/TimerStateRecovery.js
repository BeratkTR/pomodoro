class TimerStateRecovery {
  static recoverTimerState(user, userData) {
    if (!userData.timerState || !userData.timerState.lastSaveTime) {
      return; // No recovery needed
    }

    const now = Date.now();
    const lastSaveTime = userData.timerState.lastSaveTime;
    const timeSinceLastSave = (now - lastSaveTime) / 1000; // seconds
    
    // If more than 2 minutes have passed since last save, assume server was down
    // and the timer was likely running during that time
    const maxGapThreshold = 120; // 2 minutes
    
    if (timeSinceLastSave > maxGapThreshold) {
      console.log(`Potential server downtime detected for ${user.name}: ${Math.round(timeSinceLastSave)}s since last save`);
      
      // Check if timer was close to being active (less than full session time suggests it was running)
      const fullSessionTime = user.timerState.mode === 'pomodoro' 
        ? user.settings.pomodoro * 60 
        : user.settings.break * 60;
      
      const wasLikelyActive = user.timerState.timeLeft < fullSessionTime && user.timerState.timeLeft > 0;
      
      if (wasLikelyActive) {
        // Estimate how much time may have passed while timer was running
        // Use a conservative estimate: assume timer ran for half the downtime
        const estimatedRunTime = Math.min(timeSinceLastSave * 0.5, user.timerState.timeLeft);
        const newTimeLeft = Math.max(0, user.timerState.timeLeft - estimatedRunTime);
        
        console.log(`Recovering timer for ${user.name}: was at ${user.timerState.timeLeft}s, estimating ${estimatedRunTime}s elapsed, new time: ${newTimeLeft}s`);
        
        user.timerState.timeLeft = newTimeLeft;
        
        // If timer would have completed during downtime, handle completion
        if (newTimeLeft <= 0) {
          this.handleTimerCompletionDuringDowntime(user);
        }
        
        return {
          recovered: true,
          estimatedElapsedTime: estimatedRunTime,
          message: `Timer state recovered: estimated ${Math.round(estimatedRunTime)}s elapsed during server downtime`
        };
      }
    }
    
    return {
      recovered: false,
      message: 'No timer recovery needed'
    };
  }
  
  static handleTimerCompletionDuringDowntime(user) {
    console.log(`Timer completed during downtime for ${user.name}`);
    
    if (user.timerState.mode === 'pomodoro') {
      // Add completed pomodoro time
      user.totalWorkTime += user.settings.pomodoro;
      
      // Add to session history
      user.sessionHistory.push({
        type: 'pomodoro',
        completedAt: Date.now(),
        duration: user.settings.pomodoro,
        completedDuringDowntime: true
      });
      
      // Update completed sessions
      user.completedSessions++;
      user.currentSessionProgress = 0;

      // Switch to break
      user.timerState.mode = 'break';
      user.timerState.timeLeft = user.settings.break * 60;
      user.timerState.currentSession++;
    } else {
      // Add completed break time
      user.totalBreakTime += user.settings.break;
      
      // Add to session history
      user.sessionHistory.push({
        type: 'break',
        completedAt: Date.now(),
        duration: user.settings.break,
        completedDuringDowntime: true
      });
      
      // Switch to pomodoro
      user.timerState.mode = 'pomodoro';
      user.timerState.timeLeft = user.settings.pomodoro * 60;
      user.timerState.currentSession++;
      user.currentSessionProgress = 0;
    }
    
    return {
      sessionCompleted: true,
      newMode: user.timerState.mode,
      completedDuringDowntime: true
    };
  }
  
  static generateRecoveryReport(users) {
    const report = {
      totalUsers: users.length,
      usersWithRecovery: 0,
      timersRecovered: 0,
      sessionsCompletedDuringDowntime: 0,
      details: []
    };
    
    users.forEach(user => {
      if (user.recoveryInfo && user.recoveryInfo.recovered) {
        report.usersWithRecovery++;
        report.timersRecovered++;
        
        if (user.recoveryInfo.sessionCompleted) {
          report.sessionsCompletedDuringDowntime++;
        }
        
        report.details.push({
          userId: user.id,
          userName: user.name,
          estimatedElapsedTime: user.recoveryInfo.estimatedElapsedTime,
          sessionCompleted: user.recoveryInfo.sessionCompleted || false,
          message: user.recoveryInfo.message
        });
      }
    });
    
    return report;
  }
}

module.exports = TimerStateRecovery; 