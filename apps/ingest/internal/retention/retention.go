// Why: owns how long raw health samples are kept, enforced by a daily partition drop.
// Must not: know about HTTP or batch validation.
package retention

import "time"

const RawSampleRetention = 90 * 24 * time.Hour
