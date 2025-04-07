import pc from "picocolors";

/**
 * Display the process time in a formatted string.
 * @param hrtime process.hrtime() difference array
 * @returns Formatted time string
 */
export function displayProcessTime(hrtime: [number, number]): string {
  const seconds = hrtime[0];
  const nanoseconds = hrtime[1];
  const milliseconds = nanoseconds / 1000000;

  // Format time display more accurately and consistently
  let timeDisplay: string;

  if (seconds > 60) {
    // Format as minutes and seconds
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timeDisplay = `${minutes}m ${remainingSeconds.toFixed(2)}s`;
  } else if (seconds > 0) {
    // Format as seconds with 2 decimal places for milliseconds
    timeDisplay = `${seconds}.${Math.floor(milliseconds)
      .toString()
      .padStart(3, "0")}s`;
  } else {
    // Format as milliseconds only
    timeDisplay = `${Math.round(milliseconds)}ms`;
  }

  console.log(pc.green("\n✨ Done in ") + timeDisplay);
  return timeDisplay;
}

/**
 * Create a timer that can be used to track execution time
 * @returns Timer object with start and end methods
 */
export function createTimer() {
  const startTime = process.hrtime();

  return {
    /**
     * Get elapsed time since timer creation without stopping the timer
     * @returns Formatted time string
     */
    elapsed: (): string => {
      const elapsed = process.hrtime(startTime);
      return formatHrTime(elapsed);
    },

    /**
     * End the timer and get the elapsed time
     * @param showLog - Whether to show the elapsed time in console
     * @returns Elapsed time in [seconds, nanoseconds] format
     */
    end: (showLog = true): [number, number] => {
      const elapsed = process.hrtime(startTime);
      if (showLog) {
        displayProcessTime(elapsed);
      }
      return elapsed;
    },
  };
}

/**
 * Format a high-resolution time difference array to a readable string
 * @param hrtime - High-resolution time difference
 * @returns Formatted time string
 */
function formatHrTime(hrtime: [number, number]): string {
  const seconds = hrtime[0];
  const milliseconds = hrtime[1] / 1000000;

  if (seconds > 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(2)}s`;
  }

  if (seconds > 0) {
    return `${seconds}.${Math.floor(milliseconds)
      .toString()
      .padStart(3, "0")}s`;
  }

  return `${Math.round(milliseconds)}ms`;
}
