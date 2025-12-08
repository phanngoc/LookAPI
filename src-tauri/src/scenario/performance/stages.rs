use super::types::Stage;
use std::time::Instant;

/// StageScheduler - Manages VU ramping according to configured stages
/// 
/// Handles linear interpolation between stages to smoothly ramp VUs up/down.
/// For example, with stages:
///   - Stage 1: 2 minutes, target 50 VUs
///   - Stage 2: 10 minutes, target 50 VUs (maintain)
///   - Stage 3: 2 minutes, target 0 VUs (ramp down)
pub struct StageScheduler {
    stages: Vec<Stage>,
    start_time: Instant,
    total_duration_secs: u64,
}

impl StageScheduler {
    /// Create a new StageScheduler with the given stages
    pub fn new(stages: Vec<Stage>) -> Self {
        let total_duration_secs = stages.iter().map(|s| s.duration_secs).sum();
        Self {
            stages,
            start_time: Instant::now(),
            total_duration_secs,
        }
    }

    /// Create a scheduler for fixed VUs and duration (no ramping)
    pub fn fixed(vus: u32, duration_secs: u64) -> Self {
        Self::new(vec![Stage {
            duration_secs,
            target_vus: vus,
        }])
    }

    /// Get the total duration of all stages in seconds
    pub fn get_total_duration_secs(&self) -> u64 {
        self.total_duration_secs
    }

    /// Get elapsed time in seconds
    pub fn get_elapsed_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Check if all stages are completed
    pub fn is_completed(&self) -> bool {
        self.start_time.elapsed().as_secs() >= self.total_duration_secs
    }

    /// Get the current stage index (0-based)
    pub fn get_current_stage_index(&self) -> Option<usize> {
        if self.stages.is_empty() {
            return None;
        }

        let elapsed = self.start_time.elapsed().as_secs();
        let mut accumulated = 0u64;

        for (index, stage) in self.stages.iter().enumerate() {
            accumulated += stage.duration_secs;
            if elapsed < accumulated {
                return Some(index);
            }
        }

        // Past all stages
        None
    }

    /// Get the current stage
    pub fn get_current_stage(&self) -> Option<&Stage> {
        self.get_current_stage_index()
            .and_then(|i| self.stages.get(i))
    }

    /// Calculate the number of VUs that should be running at the current time
    /// Uses linear interpolation between stage targets
    pub fn get_current_vus(&self) -> u32 {
        if self.stages.is_empty() {
            return 0;
        }

        let elapsed = self.start_time.elapsed().as_secs();

        // If test hasn't started yet
        if elapsed == 0 {
            // Return first stage target or interpolate from 0
            return self.stages.first().map(|_| {
                // Start from 0 and ramp up
                0
            }).unwrap_or(0);
        }

        // Find which stage we're in
        let mut accumulated = 0u64;
        let mut prev_target_vus = 0u32; // Start from 0 VUs

        for stage in &self.stages {
            let stage_start = accumulated;
            let stage_end = accumulated + stage.duration_secs;

            if elapsed < stage_end {
                // We're in this stage - interpolate
                let stage_elapsed = elapsed - stage_start;
                let stage_progress = stage_elapsed as f64 / stage.duration_secs as f64;
                
                // Linear interpolation between prev target and current target
                let vus = prev_target_vus as f64 
                    + (stage.target_vus as f64 - prev_target_vus as f64) * stage_progress;
                
                return vus.round() as u32;
            }

            prev_target_vus = stage.target_vus;
            accumulated = stage_end;
        }

        // Past all stages - return last stage's target
        self.stages.last().map(|s| s.target_vus).unwrap_or(0)
    }

    /// Get the remaining time in seconds
    pub fn get_remaining_secs(&self) -> u64 {
        let elapsed = self.start_time.elapsed().as_secs();
        if elapsed >= self.total_duration_secs {
            0
        } else {
            self.total_duration_secs - elapsed
        }
    }

    /// Get progress as percentage (0.0 - 100.0)
    pub fn get_progress_percent(&self) -> f64 {
        if self.total_duration_secs == 0 {
            return 100.0;
        }
        let elapsed = self.start_time.elapsed().as_secs();
        (elapsed as f64 / self.total_duration_secs as f64 * 100.0).min(100.0)
    }

    /// Check if we've transitioned to a new stage since last check
    /// Returns the new stage index if we just entered it
    pub fn check_stage_transition(&self, last_stage_index: Option<usize>) -> Option<usize> {
        let current = self.get_current_stage_index();
        match (last_stage_index, current) {
            (None, Some(idx)) => Some(idx),
            (Some(last), Some(current)) if current != last => Some(current),
            _ => None,
        }
    }
}

/// Create default stages for different test types
pub fn create_smoke_test_stages() -> Vec<Stage> {
    vec![
        Stage { duration_secs: 30, target_vus: 2 },
    ]
}

pub fn create_load_test_stages(target_vus: u32, sustain_minutes: u64) -> Vec<Stage> {
    vec![
        Stage { duration_secs: 120, target_vus },              // Ramp up 2 min
        Stage { duration_secs: sustain_minutes * 60, target_vus }, // Sustain
        Stage { duration_secs: 120, target_vus: 0 },           // Ramp down 2 min
    ]
}

pub fn create_stress_test_stages(max_vus: u32) -> Vec<Stage> {
    vec![
        Stage { duration_secs: 120, target_vus: max_vus / 4 },
        Stage { duration_secs: 120, target_vus: max_vus / 2 },
        Stage { duration_secs: 120, target_vus: max_vus * 3 / 4 },
        Stage { duration_secs: 120, target_vus: max_vus },
        Stage { duration_secs: 120, target_vus: 0 },
    ]
}

pub fn create_spike_test_stages(base_vus: u32, spike_vus: u32) -> Vec<Stage> {
    vec![
        Stage { duration_secs: 10, target_vus: base_vus },    // Warm up
        Stage { duration_secs: 10, target_vus: spike_vus },   // Spike up
        Stage { duration_secs: 30, target_vus: spike_vus },   // Hold spike
        Stage { duration_secs: 60, target_vus: base_vus },    // Recover
    ]
}

pub fn create_soak_test_stages(vus: u32, hours: u64) -> Vec<Stage> {
    vec![
        Stage { duration_secs: 300, target_vus: vus },           // Ramp up 5 min
        Stage { duration_secs: hours * 3600, target_vus: vus },  // Sustain
        Stage { duration_secs: 300, target_vus: 0 },             // Ramp down 5 min
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;
    use std::time::Duration;

    #[test]
    fn test_fixed_scheduler() {
        let scheduler = StageScheduler::fixed(10, 60);
        assert_eq!(scheduler.get_total_duration_secs(), 60);
        assert_eq!(scheduler.get_current_vus(), 0); // Starts from 0
    }

    #[test]
    fn test_is_completed() {
        let scheduler = StageScheduler::fixed(10, 1);
        assert!(!scheduler.is_completed());
        
        sleep(Duration::from_millis(1100));
        assert!(scheduler.is_completed());
    }

    #[test]
    fn test_stage_transition() {
        let stages = vec![
            Stage { duration_secs: 1, target_vus: 10 },
            Stage { duration_secs: 1, target_vus: 20 },
        ];
        let scheduler = StageScheduler::new(stages);
        
        // Initial state
        assert_eq!(scheduler.get_current_stage_index(), Some(0));
        
        // After first stage
        sleep(Duration::from_millis(1100));
        assert_eq!(scheduler.get_current_stage_index(), Some(1));
    }

    #[test]
    fn test_create_load_test_stages() {
        let stages = create_load_test_stages(50, 10);
        assert_eq!(stages.len(), 3);
        assert_eq!(stages[0].target_vus, 50);
        assert_eq!(stages[1].duration_secs, 600); // 10 minutes
    }
}
