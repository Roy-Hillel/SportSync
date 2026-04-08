# Requirements: SportSync

**Defined:** 2026-03-27
**Core Value:** A subscribed user's calendar always shows accurate upcoming match times — automatically, without manual effort.

## v1 Requirements

Requirements for the current maintenance milestone. Focuses on fixing known data issues, verifying production health, and improving reliability.

### Data Integrity

- [ ] **DATA-01**: Israeli league teams (Maccabi Haifa, Maccabi Tel Aviv) are investigated — determine if competition-schedule endpoint returns future fixtures where competitor endpoint does not
- [ ] **DATA-02**: If competition-schedule endpoint works for Israeli league, sync engine falls back to it when competitor endpoint returns 0 future events
- [ ] **DATA-03**: Real Madrid subscription is verified to return LaLiga men's fixtures (not women's competition events) after fix — `competition_name` in DB confirmed correct
- [ ] **DATA-04**: `sport_events` rows with potentially incorrect `competition_name` from prior women's-team bug are identified and corrected if needed

### Production Health

- [ ] **PROD-01**: Production `subscribable_entities` table is confirmed seeded (1,265+ competitions, 10k+ teams) — verified via DB query
- [ ] **PROD-02**: Cron sync logs (`sync_log` table) are reviewed for recent errors or 429 patterns after production deploy
- [ ] **PROD-03**: Premier League subscription sync is verified — at least one future event returned after the next successful sync

### API Quota Safety

- [ ] **QUOTA-01**: SportRadar trial quota usage is visible — either a dashboard check or a log-based count so Roy can see daily usage before running manual syncs or bootstrap
- [ ] **QUOTA-02**: Bootstrap script (or a README warning) makes clear it should not be re-run on the same day as multiple manual syncs

### Code Quality

- [ ] **CODE-01**: ENGINEERING_NOTES.md open questions (sections 1–5) are each marked as resolved, in-progress, or deferred with current status
- [ ] **CODE-02**: Any orphaned `sport_events` rows (from subscriptions that were removed) are cleaned up or a cleanup script exists

## v2 Requirements

Deferred to a future milestone. Tracked but not in current roadmap.

### Multi-Sport Support

- **SPORT-01**: App supports a second sport (e.g., basketball) via a new SportsDataProvider implementation
- **SPORT-02**: User can subscribe to teams/competitions from multiple sports in a single feed

### UX Improvements

- **UX-01**: User can name or label their calendar subscriptions
- **UX-02**: User can see last-sync timestamp and next-sync time on the dashboard
- **UX-03**: User receives email notification when sync fails for a subscribed entity

### Paid API Tier

- **API-01**: App is migrated to SportRadar paid tier — unlocking higher rate limits and full fixture coverage (e.g., Israeli league)
- **API-02**: Rate limiting configuration is dynamic (env var), not hardcoded 1.1s delay

### Post-Match Score Updates

- **SCORE-01**: After a match ends, the calendar event is updated to include the final score in the event title or description (e.g., "Real Madrid 3–1 Barcelona")

### Per-Subscription Time Ahead Override

- **TIMEAHEAD-01**: Each subscription can override the user's global time-ahead setting — so a user can subscribe to Champions League events 3 months ahead but LaLiga only 2 weeks ahead

### Conditional Subscription Filters

- **FILTER-01**: User can subscribe to a competition starting from a specific stage (e.g., Champions League from Round of 16 onwards)
- **FILTER-02**: User can subscribe to a competition filtered by team rank (e.g., La Liga — top 10 teams only)

### Subscription Sharing

- **SHARE-01**: User can export a subscription as a shareable link or code that another user can import — no need to manually recreate the same subscription

## Out of Scope

| Feature | Reason |
|---------|--------|
| Google Calendar API write scope | iCal feed is simpler, universal, no OAuth calendar scope needed |
| Per-user `sport_events` storage | Global table is a deliberate O(entities) architecture decision |
| Real-time push to calendars | Google polls iCal on its own schedule; no API workaround |
| Mobile app | Personal web project; mobile not needed |
| Multiple calendar feeds per user | Single feed sufficient at current scale |
| Admin dashboard for multi-user management | Solo-user app; no multi-tenancy planned |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| DATA-01 | Phase 1 | Plan 1.1 | Pending |
| DATA-02 | Phase 1 | Plan 1.1 | Pending |
| DATA-03 | Phase 1 | Plan 1.2 | Pending |
| DATA-04 | Phase 1 | Plan 1.2 | Pending |
| PROD-01 | Phase 1 | Plan 1.3 | Pending |
| PROD-02 | Phase 1 | Plan 1.3 | Pending |
| PROD-03 | Phase 1 | Plan 1.3 | Pending |
| QUOTA-01 | Phase 2 | Plan 2.1 | Pending |
| QUOTA-02 | Phase 2 | Plan 2.3 | Pending |
| CODE-01 | Phase 2 | Plan 2.3 | Pending |
| CODE-02 | Phase 2 | Plan 2.2 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after initial definition*
