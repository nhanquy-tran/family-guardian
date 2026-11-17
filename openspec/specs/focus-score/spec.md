# focus-score Specification

## Purpose
Compute one daily focus score per child from usage minutes and the family's homework domains: share of homework time minus a capped penalty for switching between homework and other sites.

## Requirements

### Requirement: Daily totals

The focus score function SHALL take one day's usage entries (minute, registrable domain, seconds) and a list of homework domains, and SHALL return `homeworkSeconds` (sum of seconds whose domain is exactly in the homework list), `totalSeconds` (sum of all seconds) and `switches`. Domains not in the homework list SHALL count as non-homework.

#### Scenario: Only homework
- **GIVEN** 30 consecutive minutes 08:00–08:29 on `khanacademy.org`
- **WHEN** the focus score is computed
- **THEN** the result is `{ score: 100, homeworkSeconds: 1800, totalSeconds: 1800, switches: 0 }`

#### Scenario: Empty homework list
- **GIVEN** the homework domains are `[]` and 10 minutes 08:00–08:09 on `khanacademy.org`
- **WHEN** the focus score is computed
- **THEN** the result is `{ score: 0, homeworkSeconds: 0, totalSeconds: 600, switches: 0 }`

### Requirement: Empty day

When there are no entries, or the total seconds are 0, the function SHALL return `{ score: null, homeworkSeconds: 0, totalSeconds: 0, switches: 0 }`.

#### Scenario: No entries
- **GIVEN** an empty list of entries
- **WHEN** the focus score is computed
- **THEN** the result is `{ score: null, homeworkSeconds: 0, totalSeconds: 0, switches: 0 }`

### Requirement: Minute classification

Entries SHALL be grouped by minute and minutes SHALL be processed in time order regardless of input order. A minute is a homework minute when its homework seconds are greater than or equal to its non-homework seconds; otherwise it is a non-homework minute.

#### Scenario: Mixed minute is classified by majority seconds
- **GIVEN** minute 08:00 with 40 s on `khanacademy.org` and 20 s on `youtube.com`, then minute 08:01 with 60 s on `youtube.com`
- **WHEN** the focus score is computed
- **THEN** the result is `{ score: 13, homeworkSeconds: 40, totalSeconds: 120, switches: 1 }`

#### Scenario: Tied minute counts as homework
- **GIVEN** minute 08:00 with 30 s on `khanacademy.org` and 30 s on `youtube.com`, then minute 08:01 with 60 s on `khanacademy.org`
- **WHEN** the focus score is computed
- **THEN** the result is `{ score: 75, homeworkSeconds: 90, totalSeconds: 120, switches: 0 }`

#### Scenario: Unordered input gives the same result
- **GIVEN** the entries of "One switch in one session" in reversed order
- **WHEN** the focus score is computed
- **THEN** the result equals the result for the ordered entries

### Requirement: Switch counting within sessions

Consecutive active minutes at most 5 minutes apart SHALL belong to the same session; a gap of more than 5 minutes SHALL start a new session. A switch SHALL be counted each time consecutive minutes in the same session differ in kind. A change of kind across a session break SHALL NOT count as a switch.

#### Scenario: One switch in one session
- **GIVEN** minutes 08:00–08:09 on `khanacademy.org` and minutes 08:10–08:19 on `youtube.com`
- **WHEN** the focus score is computed
- **THEN** the result is `{ score: 44, homeworkSeconds: 600, totalSeconds: 1200, switches: 1 }` (share 50, 20 active minutes, 3 switches per active hour, penalty 6)

#### Scenario: Gap over 5 minutes starts a new session
- **GIVEN** minute 08:00 on `khanacademy.org` and minute 08:06 on `youtube.com`
- **WHEN** the focus score is computed
- **THEN** `switches` is 0 and `score` is 50

#### Scenario: Gap of exactly 5 minutes stays in the session
- **GIVEN** minute 08:00 on `khanacademy.org` and minute 08:05 on `youtube.com`
- **WHEN** the focus score is computed
- **THEN** `switches` is 1 and `score` is 30 (2 active minutes, 30 switches per active hour, penalty capped at 20)

### Requirement: Score formula

The function SHALL compute `switchesPerActiveHour = switches / (activeMinutes / 60)`, where `activeMinutes` is the number of distinct minutes with entries, and `score = round(homeworkShare * 100 - min(20, switchesPerActiveHour * 2))` with `homeworkShare = homeworkSeconds / totalSeconds`, rounding half up, then clamped to the range 0..100.

#### Scenario: Penalty is capped at 20
- **GIVEN** 60 minutes 08:00–08:59 alternating every minute between `khanacademy.org` (even minutes) and `youtube.com` (odd minutes)
- **WHEN** the focus score is computed
- **THEN** the result is `{ score: 30, homeworkSeconds: 1800, totalSeconds: 3600, switches: 59 }`

#### Scenario: Negative score is clamped to 0
- **GIVEN** minute 08:00 with 6 s on `khanacademy.org` and minute 08:01 with 60 s on `youtube.com`
- **WHEN** the focus score is computed
- **THEN** `switches` is 1 and `score` is 0 (share about 9.1, penalty 20)
