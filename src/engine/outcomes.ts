import type { OutcomeTier } from '../types/game'

// Shared glyph + label for every outcome tier, so color is never the only
// signal a colorblind player gets (red/amber/green is the single worst
// combination for red-green colorblindness, and it's exactly what critical
// hit/fail states use). Any UI that colors something by OutcomeTier should
// also render its glyph/label from here.
export const OUTCOME_DISPLAY: Record<OutcomeTier, { label: string; glyph: string }> = {
  critical_hit:  { label: 'CRITICAL HIT',  glyph: '⚡' },
  success:       { label: 'SUCCESS',        glyph: '✓'  },
  partial:       { label: 'PARTIAL',        glyph: '~'  },
  failure:       { label: 'FAILURE',        glyph: '✗'  },
  critical_fail: { label: 'CRITICAL FAIL',  glyph: '☠'  },
}
